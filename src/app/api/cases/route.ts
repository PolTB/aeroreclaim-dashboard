import { list, put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import type { AeroCaso, PipelineStage } from '@/types';
import { trackEvent } from '@/lib/analytics';

// ─── Pipeline stage order ─────────────────────────────────────────────────────

const STAGE_ORDER: PipelineStage[] = [
  'Lead', 'Aprobado', 'Docs Recibidos', 'Extrajudicial',
  'Respuesta Aerolínea', 'AESA', 'Cobro', 'Cerrado',
];

// ─── Test / internal filters ──────────────────────────────────────────────────

const TEST_CASE_PATTERNS = ['maria test', 'test final', 'prueba', 'test ', ' test', 'anonimo', 'verificacion'];
function isTestCase(nombre: string): boolean {
  const lower = nombre.toLowerCase();
  return TEST_CASE_PATTERNS.some(p => lower.includes(p));
}

const INTERNAL_EMAIL_PATTERNS = [
  '@aeroreclaim.com', 'ptusquets@gmail.com', '@curl.com', '@test.com', 'oldurl@', 'verify-old@',
];
function isInternalEmail(email: string): boolean {
  const e = email.toLowerCase();
  return INTERNAL_EMAIL_PATTERNS.some(p => e.includes(p.toLowerCase()));
}

// ─── Date normalizer: DD/MM/YYYY → YYYY-MM-DD ────────────────────────────────
function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) {
    const [d, m, y] = t.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return t;
}

// ─── Status → pipeline stage map ─────────────────────────────────────────────

const STATUS_TO_STAGE: Record<string, PipelineStage> = {
  APROBADO: 'Aprobado',  APPROVED: 'Aprobado',  ALERTED: 'Aprobado',
  BIENVENIDA_ENVIADA: 'Aprobado', ACCEPTED: 'Aprobado',
  DOCS_RECEIVED: 'Docs Recibidos', DOCUMENTACION_RECIBIDA: 'Docs Recibidos', MANDATE_SIGNED: 'Docs Recibidos',
  EXTRAJUDICIAL: 'Extrajudicial',  CARTA_ENVIADA: 'Extrajudicial',
  LETTER_SENT: 'Extrajudicial',    ENVIADO_EXTRAJUDICIAL: 'Extrajudicial',   PROCESADO_AESA: 'Extrajudicial',
  AIRLINE_RESPONSE: 'Respuesta Aerolínea',  AIRLINE_RESPONSE_RECEIVED: 'Respuesta Aerolínea',
  RESPUESTA_AEROLINEA: 'Respuesta Aerolínea', RESPUESTA_RECIBIDA: 'Respuesta Aerolínea',
  AIRLINE_ACCEPTED: 'Respuesta Aerolínea',  AIRLINE_REJECTED: 'Respuesta Aerolínea',
  AESA: 'AESA', AESA_FILED: 'AESA', ESCALADA_AESA: 'AESA', AESA_PRESENTADA: 'AESA',
  COBRO: 'Cobro', COBRADO: 'Cobro', PAYMENT_RECEIVED: 'Cobro',
  CERRADO: 'Cerrado', CLOSED: 'Cerrado',
};

function resolveActiveStage(rawStatus: string): PipelineStage | null {
  const normalized = rawStatus.toUpperCase().replace(/\s+/g, '_');
  for (const [key, stage] of Object.entries(STATUS_TO_STAGE)) {
    if (normalized === key || normalized.includes(key)) return stage;
  }
  return null;
}

// ─── Pipeline builders ────────────────────────────────────────────────────────

/** Used for hardcoded cases (named dates per stage). */
function buildPipeline(
  activeStage: PipelineStage,
  stageDates: Partial<Record<PipelineStage, string>> = {}
): AeroCaso['pipeline'] {
  const activeIdx = STAGE_ORDER.indexOf(activeStage);
  return Object.fromEntries(
    STAGE_ORDER.map((stage, i) => [
      stage,
      {
        estado:             (i < activeIdx ? 'completada' : i === activeIdx ? 'activa' : 'pendiente') as 'completada' | 'activa' | 'pendiente',
        fecha:              stageDates[stage] ?? null,
        confirmacionAgente: i <= activeIdx,
        confirmacionManual: i <= activeIdx,
      },
    ])
  ) as AeroCaso['pipeline'];
}

/** Used for GAS-derived cases. */
function buildPipelineFromStage(
  activeStage: PipelineStage,
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

// ─── Hardcoded fallback cases (all real cases — updated 2026-05-16) ───────────
// Used when GAS_CASES_ENDPOINT is not configured or returns 0 cases.

const ALL_CASES: AeroCaso[] = [

  // 1. Alicia Zunzunegui — UX52 HAV→MAD — AESA presentada
  {
    id: 'AR-20260317-MANUAL-001',
    pasajero: 'Alicia Manuela Zunzunegui Garcia',
    vuelo: 'UX52',
    ruta: 'HAV → MAD',
    fecha: '2026-02-05',
    compensacion: 600,
    scoreLegal: 92,
    estadoActual: 'AESA',
    ultimaActualizacion: '2026-05-16',
    welcome_sent_date: '2026-03-06',
    notaInterna: 'Expediente AESA 2026/ADR02/011029 · Reg. 2026118177 · Plazo resolución: 24/07/2026',
    pipeline: buildPipeline('AESA', {
      'Lead':                '2026-03-01',
      'Aprobado':            '2026-03-05',
      'Docs Recibidos':      '2026-03-10',
      'Extrajudicial':       '2026-03-17',
      'Respuesta Aerolínea': '2026-04-23',
      'AESA':                '2026-04-24',
    }),
  },

  // 2. Eduardo Robledo — TU607 MAD→TUN — Extrajudicial enviada a Tunisair
  {
    id: 'AR-20260507-193739-001',
    pasajero: 'Eduardo Robledo',
    vuelo: 'TU607',
    ruta: 'MAD → TUN',
    fecha: '2025-11-14',
    compensacion: 400,
    scoreLegal: 85,
    estadoActual: 'Extrajudicial',
    ultimaActualizacion: '2026-05-16',
    welcome_sent_date: '2026-05-07',
    notaInterna: 'Carta enviada a Tunisair 12/05/2026 · Plazo respuesta: ~12/06/2026',
    pipeline: buildPipeline('Extrajudicial', {
      'Lead':           '2026-05-07',
      'Aprobado':       '2026-05-07',
      'Docs Recibidos': '2026-05-10',
      'Extrajudicial':  '2026-05-12',
    }),
  },

  // 3. Irene Rodríguez — TU607 MAD→TUN — Docs recibidos, carta extrajudicial pendiente
  {
    id: 'AR-20260515-MANUAL-002',
    pasajero: 'Irene Rodríguez Rodríguez',
    vuelo: 'TU607',
    ruta: 'MAD → TUN',
    fecha: '2025-11-14',
    compensacion: 400,
    scoreLegal: 85,
    estadoActual: 'Docs Recibidos',
    ultimaActualizacion: '2026-05-16',
    welcome_sent_date: '2026-05-15',
    notaInterna: 'ACEPTO + DNI + boarding pass recibidos 15/05/2026 · Carta extrajudicial a Tunisair pendiente',
    pipeline: buildPipeline('Docs Recibidos', {
      'Lead':           '2026-05-07',
      'Aprobado':       '2026-05-07',
      'Docs Recibidos': '2026-05-15',
    }),
  },

  // 4. Keily Rivera — Aprobado, mandato pendiente firma (1 reminder enviado)
  {
    id: 'AR-20260504-072923-972',
    pasajero: 'Keily Rivera',
    vuelo: '—',
    ruta: '—',
    fecha: '2026-05-04',
    compensacion: 0,
    scoreLegal: 75,
    estadoActual: 'Aprobado',
    ultimaActualizacion: '2026-05-16',
    welcome_sent_date: '2026-05-04',
    notaInterna: 'Mandato enviado 05/05/2026 · 1 reminder enviado · Sin respuesta aún',
    pipeline: buildPipeline('Aprobado', {
      'Lead':     '2026-05-04',
      'Aprobado': '2026-05-05',
    }),
  },

  // 5. Matheus — Lead frío, welcome + 2 reminders sin respuesta
  {
    id: 'AR-20260501-092925-116',
    pasajero: 'Matheus',
    vuelo: '—',
    ruta: '—',
    fecha: '2026-05-01',
    compensacion: 0,
    scoreLegal: 70,
    estadoActual: 'Lead',
    ultimaActualizacion: '2026-05-16',
    welcome_sent_date: '2026-05-01',
    notaInterna: 'Lead frío — Welcome + 2 reminders sin respuesta · No crear más AERs',
    pipeline: buildPipeline('Lead', { 'Lead': '2026-05-01' }),
  },

  // 6. Lucas Tébar — Rechazado (retraso 1h < umbral CE 261 de 3h)
  {
    id: 'AR-20260503-212922-112',
    pasajero: 'Lucas Tébar',
    vuelo: 'VY2017',
    ruta: '—',
    fecha: '2026-05-03',
    compensacion: 0,
    scoreLegal: 10,
    estadoActual: 'Cerrado',
    ultimaActualizacion: '2026-05-16',
    welcome_sent_date: null,
    notaInterna: 'RECHAZADO — retraso 1h (umbral CE 261: 3h) · Email rechazo enviado 04/05/2026',
    pipeline: {
      'Lead':                { estado: 'completada', fecha: '2026-05-03', confirmacionAgente: true,  confirmacionManual: true  },
      'Aprobado':            { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
      'Docs Recibidos':      { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
      'Extrajudicial':       { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
      'Respuesta Aerolínea': { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
      'AESA':                { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
      'Cobro':               { estado: 'pendiente',  fecha: null,          confirmacionAgente: false, confirmacionManual: false },
      'Cerrado':             { estado: 'activa',     fecha: '2026-05-04',  confirmacionAgente: true,  confirmacionManual: true  },
    },
  },
];

const FALLBACK_CASES = ALL_CASES.filter(c => !isTestCase(c.pasajero));

// ─── GAS endpoint reader (dynamic — all cases from Google Sheet) ──────────────
// Required env var: GAS_CASES_ENDPOINT (GAS web app URL).
// Reads header row dynamically — no hardcoded column indices.

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

    const headers    = rows[0].map((h: string) => h.trim().toLowerCase());
    const col = (name: string) => headers.indexOf(name.toLowerCase());

    const colCaseId  = col('case_id');
    const colName    = col('passenger_name');
    const colEmail   = col('passenger_email');
    const colFlight  = col('flight_number');
    const colDate    = col('flight_date');
    const colOrigin  = col('origin_iata');
    const colDest    = col('destination_iata');
    const colComp    = col('compensation_eur');
    const colScore   = col('score');
    const colStatus  = col('status');
    const colWelcome = col('welcome_sent_date');

    const cases: AeroCaso[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const get = (c: number): string => (c >= 0 && c < row.length ? String(row[c] ?? '').trim() : '');

      const caseId = get(colCaseId);
      const email  = get(colEmail);
      const nombre = get(colName);
      const status = get(colStatus);

      if (!caseId || !email || !nombre)                                    continue;
      if (isInternalEmail(email))                                          continue;
      if (isTestCase(nombre))                                              continue;
      if (!status || status === 'TEST_CLOSED' || status === 'CANCELADO')  continue;

      const flightDate  = normalizeDate(get(colDate)) ?? '';
      const activeStage = resolveActiveStage(status) ?? 'Lead';
      const welcomeDate = normalizeDate(get(colWelcome));

      cases.push({
        id:                  caseId,
        pasajero:            nombre,
        vuelo:               get(colFlight),
        ruta:                `${get(colOrigin) || '?'} → ${get(colDest) || '?'}`,
        fecha:               flightDate || new Date().toISOString().split('T')[0],
        compensacion:        parseInt(get(colComp), 10) || 0,
        scoreLegal:          parseInt(get(colScore), 10) || 0,
        estadoActual:        activeStage,
        ultimaActualizacion: new Date().toISOString().split('T')[0],
        welcome_sent_date:   welcomeDate,
        pipeline:            buildPipelineFromStage(activeStage, { 'Lead': flightDate || undefined, 'Aprobado': welcomeDate ?? undefined }),
      });
    }

    return cases.length > 0 ? cases : null;

  } catch (err) {
    console.error('[cases] GAS fetch failed:', err);
    return null;
  }
}

// ─── State diffing via Vercel Blob ────────────────────────────────────────────

const STATE_BLOB_PATH = 'analytics/cases-state.json';
type CaseSnapshot = Record<string, { estadoActual: string }>;

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
      cases.map(c => [c.id, { estadoActual: c.estadoActual }])
    );
    await put(STATE_BLOB_PATH, JSON.stringify(snapshot), { access: 'public', addRandomSuffix: false });
  } catch (err) {
    console.error('[cases] saveState failed:', err);
  }
}

async function diffAndTrack(prev: CaseSnapshot, current: AeroCaso[]): Promise<void> {
  for (const caso of current) {
    const prevState = prev[caso.id];
    if (!prevState) {
      await trackEvent('case_created', { event_category: 'funnel', case_id: caso.id, airline_code: airlineCode(caso.vuelo), flight_number: caso.vuelo });
      continue;
    }
    if (prevState.estadoActual === caso.estadoActual) continue;
    if (caso.estadoActual === 'Respuesta Aerolínea') {
      const stage = caso.pipeline['Respuesta Aerolínea'];
      await trackEvent('airline_response', { event_category: 'funnel', case_id: caso.id, airline_code: airlineCode(caso.vuelo), outcome: stage?.confirmacionAgente ? 'accept' : 'no_response' });
    }
    if (caso.estadoActual === 'Cobro' || caso.estadoActual === 'Cerrado') {
      await trackEvent('case_closed', { event_category: 'funnel', case_id: caso.id, airline_code: airlineCode(caso.vuelo), compensation_amount: caso.compensacion, stage: caso.estadoActual });
    }
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sheetsCases = await fetchFromSheets();
    const cases  = sheetsCases ?? FALLBACK_CASES;
    const source = sheetsCases ? 'sheets' : 'fallback';

    void loadPreviousState().then(prev => diffAndTrack(prev, cases)).catch(() => {});
    void saveState(cases).catch(() => {});

    return NextResponse.json({ cases, source });
  } catch (err) {
    console.error('[cases] Route error:', err);
    return NextResponse.json({ cases: FALLBACK_CASES, source: 'fallback' });
  }
}
