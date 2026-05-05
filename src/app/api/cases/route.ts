import { list, put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import type { AeroCaso, PipelineStage } from '@/types';
import { trackEvent } from '@/lib/analytics';

// ─── Hardcoded fallback (Alicia Zunzunegui – UX52 HAV→MAD 05/Feb/2026) ────────

const ALICIA_CASE: AeroCaso = {
  id: 'AR-20260317-MANUAL-001',
  pasajero: 'Alicia Manuela Zunzunegui Garcia',
  vuelo: 'UX52',
  ruta: 'HAV → MAD',
  fecha: '2026-02-05',
  compensacion: 600,
  scoreLegal: 92,
  estadoActual: 'Extrajudicial',
  ultimaActualizacion: '2026-03-17',
  welcome_sent_date: '2026-03-06',
  pipeline: {
    'Lead':                { estado: 'completada', fecha: '2026-03-01', confirmacionAgente: true,  confirmacionManual: true  },
    'Aprobado':            { estado: 'completada', fecha: '2026-03-05', confirmacionAgente: true,  confirmacionManual: true  },
    'Docs Recibidos':      { estado: 'completada', fecha: '2026-03-10', confirmacionAgente: true,  confirmacionManual: true  },
    'Extrajudicial':       { estado: 'activa',     fecha: '2026-03-17', confirmacionAgente: true,  confirmacionManual: true  },
    'Respuesta Aerolínea': { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
    'AESA':                { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
    'Cobro':               { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
    'Cerrado':             { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
  },
};

// ─── Test cases to exclude from dashboard ─────────────────────────────────────
const TEST_CASE_PATTERNS = ['maria test', 'test final', 'prueba'];

function isTestCase(nombre: string): boolean {
  return TEST_CASE_PATTERNS.some(p => nombre.toLowerCase().includes(p));
}

// ─── Map sheet status string → pipeline stage + estado ────────────────────────
function resolveStage(status: string): { stage: PipelineStage; stageActual: PipelineStage } {
  const s = status.toUpperCase();
  if (s.includes('CERRADO') || s.includes('COBRADO'))        return { stage: 'Cerrado',             stageActual: 'Cerrado' };
  if (s.includes('COBRO') || s.includes('COLLECTION'))       return { stage: 'Cobro',               stageActual: 'Cobro' };
  if (s.includes('AESA'))                                    return { stage: 'AESA',                stageActual: 'AESA' };
  if (s.includes('RESPUESTA') || s.includes('AIRLINE_RESP')) return { stage: 'Respuesta Aerolínea', stageActual: 'Respuesta Aerolínea' };
  if (s.includes('EXTRAJUDICIAL') || s.includes('ENVIADO'))  return { stage: 'Extrajudicial',       stageActual: 'Extrajudicial' };
  if (s.includes('MANDATE_SIGNED') || s.includes('DOCS'))    return { stage: 'Docs Recibidos',      stageActual: 'Docs Recibidos' };
  if (s.includes('APROBADO') || s.includes('ONBOARDING'))    return { stage: 'Aprobado',            stageActual: 'Aprobado' };
  return { stage: 'Lead', stageActual: 'Lead' };
}

// Build pipeline record from the active stage
function buildPipeline(
  activeStage: PipelineStage,
  stageDates: Partial<Record<PipelineStage, string>>
): AeroCaso['pipeline'] {
  const ORDERED: PipelineStage[] = [
    'Lead', 'Aprobado', 'Docs Recibidos', 'Extrajudicial',
    'Respuesta Aerolínea', 'AESA', 'Cobro', 'Cerrado',
  ];
  const activeIdx = ORDERED.indexOf(activeStage);

  return Object.fromEntries(
    ORDERED.map((stage, i) => [
      stage,
      {
        estado:              i < activeIdx ? 'completada' : i === activeIdx ? 'activa' : 'pendiente',
        fecha:               stageDates[stage] ?? null,
        confirmacionAgente:  i <= activeIdx,
        confirmacionManual:  i <= activeIdx,
      },
    ])
  ) as AeroCaso['pipeline'];
}

// ─── Cases reader via GAS endpoint ──────────────────────────────────────────
// Calls GAS doGet endpoint (no API key, sheet stays private).
// Required env var: GAS_CASES_ENDPOINT (GAS web app URL)

// Emails/domains that identify internal / test rows
const INTERNAL_EMAIL_PATTERNS = [
  '@aeroreclaim.com',
  'ptusquets@gmail.com',
  '@curl.com',
  '@test.com',
  'oldurl@',
  'verify-old@',
];

function isInternalEmail(email: string): boolean {
  const e = email.toLowerCase();
  return INTERNAL_EMAIL_PATTERNS.some((p) => e.includes(p.toLowerCase()));
}

// ─── Pipeline stage order — used to derive active/completed stages ─────────────

const STAGE_ORDER = [
  'Lead',
  'Aprobado',
  'Docs Recibidos',
  'Extrajudicial',
  'Respuesta Aerolínea',
  'AESA',
  'Cobro',
  'Cerrado',
] as const;

/** Map Sheets status strings → the pipeline stage they represent */
const STATUS_TO_STAGE: Record<string, typeof STAGE_ORDER[number]> = {
  // Lead / approval
  APROBADO:          'Aprobado',
  APPROVED:          'Aprobado',
  ALERTED:           'Aprobado',
  BIENVENIDA_ENVIADA: 'Aprobado',
  ACCEPTED:          'Aprobado',
  // Onboarding
  DOCS_RECEIVED:          'Docs Recibidos',
  DOCUMENTACION_RECIBIDA: 'Docs Recibidos',
  MANDATE_SIGNED:         'Docs Recibidos',
  // Extrajudicial letter
  EXTRAJUDICIAL:          'Extrajudicial',
  CARTA_ENVIADA:          'Extrajudicial',
  LETTER_SENT:            'Extrajudicial',
  ENVIADO_EXTRAJUDICIAL:  'Extrajudicial',
  PROCESADO_AESA:         'Extrajudicial',
  // Airline response
  AIRLINE_RESPONSE:          'Respuesta Aerolínea',
  AIRLINE_RESPONSE_RECEIVED: 'Respuesta Aerolínea',
  RESPUESTA_AEROLINEA:       'Respuesta Aerolínea',
  RESPUESTA_RECIBIDA:        'Respuesta Aerolínea',
  AIRLINE_ACCEPTED:          'Respuesta Aerolínea',
  AIRLINE_REJECTED:          'Respuesta Aerolínea',
  // AESA escalation
  AESA:              'AESA',
  AESA_FILED:        'AESA',
  ESCALADA_AESA:     'AESA',
  // Collection
  COBRO:             'Cobro',
  COBRADO:           'Cobro',
  PAYMENT_RECEIVED:  'Cobro',
  // Closed
  CERRADO:           'Cerrado',
  CLOSED:            'Cerrado',
};

/**
 * Given a status string, return the active pipeline stage.
 */
function resolveActiveStage(rawStatus: string): typeof STAGE_ORDER[number] | null {
  const normalized = rawStatus.toUpperCase().replace(/\s+/g, '_');
  for (const [key, stage] of Object.entries(STATUS_TO_STAGE)) {
    if (normalized === key || normalized.includes(key)) return stage;
  }
  return null;
}

/**
 * Build an AeroCaso pipeline map from the active stage and optional known dates.
 */
function buildPipelineFromStage(
  activeStage: typeof STAGE_ORDER[number],
  stageDates: Partial<Record<string, string>> = {}
): AeroCaso['pipeline'] {
  const activeIdx = STAGE_ORDER.indexOf(activeStage);
  return Object.fromEntries(
    STAGE_ORDER.map((stage, i) => [
      stage,
      {
        estado:             i < activeIdx ? 'completada' : i === activeIdx ? 'activa' : 'pendiente',
        fecha:              stageDates[stage] ?? null,
        confirmacionAgente: i <= activeIdx,
        confirmacionManual: i <= activeIdx,
      },
    ])
  ) as AeroCaso['pipeline'];
}

async function fetchFromSheets(): Promise<AeroCaso[] | null> {
  const gasUrl = process.env.GAS_CASES_ENDPOINT;
  if (!gasUrl) return null;

  try {
    const obRes = await fetch(gasUrl, { next: { revalidate: 60 } });
    if (!obRes.ok) {
      console.error('[cases] GAS endpoint failed:', obRes.status, await obRes.text());
      return null;
    }

    const obData = await obRes.json();
    if (obData.error) {
      console.error('[cases] GAS error:', obData.error);
      return null;
    }
    const rows: string[][] = obData.values ?? [];
    if (rows.length < 2) return null;

    // Build a header → column index map from row 0
    const headers = rows[0].map((h: string) => h.trim().toLowerCase());
    const col = (name: string): number => headers.indexOf(name.toLowerCase());

    const colCaseId      = col('case_id');
    const colName        = col('passenger_name');
    const colEmail       = col('passenger_email');
    const colFlight      = col('flight_number');
    const colDate        = col('flight_date');
    const colAirline     = col('airline_name');
    const colOrigin      = col('origin_iata');
    const colDest        = col('destination_iata');
    const colComp        = col('compensation_eur');
    const colScore       = col('score');
    const colStatus      = col('status');
    const colWelcome     = col('welcome_sent_date');

    const cases: AeroCaso[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const get = (c: number): string => (c >= 0 && c < row.length ? String(row[c] ?? '').trim() : '');

      const caseId  = get(colCaseId);
      const email   = get(colEmail);
      const nombre  = get(colName);
      const status  = get(colStatus);

      if (!caseId || !email || !nombre) continue;
      if (isInternalEmail(email))        continue;
      if (isTestCase(nombre))            continue;
      if (!status || status === 'TEST_CLOSED' || status === 'CANCELADO') continue;

      const rawDate = get(colDate);
      const flightDate = rawDate.includes('/') // "30/05/2024" → "2024-05-30"
        ? rawDate.split('/').reverse().join('-')
        : rawDate;

      const activeStage  = resolveActiveStage(status) ?? 'Lead';
      const welcomeDate  = get(colWelcome) || null;

      const pipeline = buildPipelineFromStage(activeStage, {
        'Lead':    flightDate,
        'Aprobado': welcomeDate ?? undefined,
      });

      const caso: AeroCaso = {
        id:                  caseId,
        pasajero:            nombre,
        vuelo:               get(colFlight),
        ruta:                `${get(colOrigin) || '?'} → ${get(colDest) || '?'}`,
        fecha:               flightDate,
        compensacion:        parseInt(get(colComp), 10) || 0,
        scoreLegal:          parseInt(get(colScore), 10) || 0,
        estadoActual:        activeStage,
        ultimaActualizacion: new Date().toISOString().split('T')[0],
        welcome_sent_date:   welcomeDate,
        pipeline,
      };

      cases.push(caso);
    }

    return cases.length > 0 ? cases : null;

  } catch (err) {
    console.error('[cases] Google Sheets fetch failed:', err);
    return null;
  }
}

// ─── State diffing via Vercel Blob ────────────────────────────────────────────

const STATE_BLOB_PATH = 'analytics/cases-state.json';

type CaseSnapshot = Record<string, { estadoActual: string }>;

/** Returns airline IATA code from flight number (first 2 uppercase letters). */
function airlineCode(vuelo: string): string {
  return vuelo.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
}

async function loadPreviousState(): Promise<CaseSnapshot> {
  try {
    const { blobs } = await list({ prefix: STATE_BLOB_PATH });
    if (!blobs.length) return {};
    const res = await fetch(blobs[0].url);
    if (!res.ok) return {};
    return (await res.json()) as CaseSnapshot;
  } catch {
    return {};
  }
}

async function saveState(cases: AeroCaso[]): Promise<void> {
  try {
    const snapshot: CaseSnapshot = Object.fromEntries(
      cases.map((c) => [c.id, { estadoActual: c.estadoActual }]),
    );
    await put(STATE_BLOB_PATH, JSON.stringify(snapshot), {
      access: 'public',
      addRandomSuffix: false,
    });
  } catch (err) {
    console.error('[cases] saveState failed:', err);
  }
}

async function diffAndTrack(prev: CaseSnapshot, current: AeroCaso[]): Promise<void> {
  for (const caso of current) {
    const prevState = prev[caso.id];

    if (!prevState) {
      // New case
      await trackEvent('case_created', {
        event_category: 'funnel',
        case_id: caso.id,
        airline_code: airlineCode(caso.vuelo),
        flight_number: caso.vuelo,
      });
      continue;
    }

    if (prevState.estadoActual === caso.estadoActual) continue;

    if (caso.estadoActual === 'Respuesta Aerolínea') {
      // Determine outcome from pipeline confirmation
      const stage = caso.pipeline['Respuesta Aerolínea'];
      const outcome = stage?.confirmacionAgente ? 'accept' : 'no_response';
      await trackEvent('airline_response', {
        event_category: 'funnel',
        case_id: caso.id,
        airline_code: airlineCode(caso.vuelo),
        outcome,
      });
    }

    if (caso.estadoActual === 'Cobro' || caso.estadoActual === 'Cerrado') {
      await trackEvent('case_closed', {
        event_category: 'funnel',
        case_id: caso.id,
        airline_code: airlineCode(caso.vuelo),
        compensation_amount: caso.compensacion,
        stage: caso.estadoActual,
      });
    }
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sheetsCases = await fetchFromSheets();
    const cases  = sheetsCases ?? [ALICIA_CASE];
    const source = sheetsCases ? 'sheets' : 'fallback';

    // Fire-and-forget: diff state and send GA4 events — never blocks response
    void loadPreviousState().then((prev) => diffAndTrack(prev, cases)).catch(() => {});

    return NextResponse.json({ cases, source });
  } catch (err) {
    console.error('[cases] Route error:', err);
    return NextResponse.json({ cases: [ALICIA_CASE], source: 'fallback' });
  }
}
