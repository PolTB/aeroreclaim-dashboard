import { NextResponse } from 'next/server';
import type { AeroCaso } from '@/types';

// ─── Hardcoded fallback (Alicia Zunzunegui – UX52 HAV→MAD 05/Feb/2026) ────────

const ALICIA_CASE: AeroCaso = {
  id: 'caso-alicia-ux52-2026',
  pasajero: 'Alicia Manuela Zunzunegui Garcia',
  vuelo: 'UX52',
  ruta: 'HAV → MAD',
  fecha: '2026-02-05',
  compensacion: 600,
  scoreLegal: 92,
  estadoActual: 'Docs Recibidos',
  ultimaActualizacion: '2026-03-17',
  welcome_sent_date: '2026-03-06',
  pipeline: {
    'Lead': {
      estado: 'completada',
      fecha: '2026-03-01',
      confirmacionAgente: true,
      confirmacionManual: true,
    },
    'Aprobado': {
      estado: 'completada',
      fecha: '2026-03-05',
      confirmacionAgente: true,
      confirmacionManual: true,
    },
    'Docs Recibidos': {
      estado: 'activa',
      fecha: '2026-03-10',
      confirmacionAgente: true,
      confirmacionManual: false,
    },
    'Extrajudicial': {
      estado: 'pendiente',
      fecha: null,
      confirmacionAgente: false,
      confirmacionManual: false,
    },
    'Respuesta Aerolínea': {
      estado: 'pendiente',
      fecha: null,
      confirmacionAgente: false,
      confirmacionManual: false,
    },
    'AESA': {
      estado: 'pendiente',
      fecha: null,
      confirmacionAgente: false,
      confirmacionManual: false,
    },
    'Cobro': {
      estado: 'pendiente',
      fecha: null,
      confirmacionAgente: false,
      confirmacionManual: false,
    },
    'Cerrado': {
      estado: 'pendiente',
      fecha: null,
      confirmacionAgente: false,
      confirmacionManual: false,
    },
  },
};

// ─── Optional: Google Sheets reader ──────────────────────────────────────────
// Requires env vars: GOOGLE_SHEETS_SPREADSHEET_ID + GOOGLE_SHEETS_API_KEY
// Sheet: "AeroReclaim — Registro Central del Proyecto"
//   · Leads tab        (gid: 519455070)  → row 16 = Alicia
//   · Onboarding_Queue (gid: 478894808)  → row 13 = Alicia

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
  // Onboarding
  DOCS_RECEIVED:          'Docs Recibidos',
  DOCUMENTACION_RECIBIDA: 'Docs Recibidos',
  // Extrajudicial letter
  EXTRAJUDICIAL:         'Extrajudicial',
  CARTA_ENVIADA:         'Extrajudicial',
  LETTER_SENT:           'Extrajudicial',
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
  // Collection
  COBRO:             'Cobro',
  COBRADO:           'Cobro',
  PAYMENT_RECEIVED:  'Cobro',
  // Closed
  CERRADO:           'Cerrado',
  CLOSED:            'Cerrado',
};

/**
 * Given a status string, return the active pipeline stage and the index up to
 * which all prior stages should be marked 'completada'.
 */
function resolveActiveStage(rawStatus: string): typeof STAGE_ORDER[number] | null {
  const normalized = rawStatus.toUpperCase().replace(/\s+/g, '_');
  // Check exact match first, then partial match
  for (const [key, stage] of Object.entries(STATUS_TO_STAGE)) {
    if (normalized === key || normalized.includes(key)) return stage;
  }
  return null;
}

async function fetchFromSheets(): Promise<AeroCaso[] | null> {
  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const apiKey  = process.env.GOOGLE_SHEETS_API_KEY;
  if (!sheetId || !apiKey) return null;

  try {
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;

    const [leadsRes, onboardingRes] = await Promise.all([
      fetch(`${base}/Leads!A:Z?key=${apiKey}`,            { next: { revalidate: 60 } }),
      fetch(`${base}/Onboarding_Queue!A:Z?key=${apiKey}`, { next: { revalidate: 60 } }),
    ]);

    if (!leadsRes.ok || !onboardingRes.ok) return null;

    const leadsData      = await leadsRes.json();
    const onboardingData = await onboardingRes.json();

    const leadsRows: string[][]      = leadsData.values      ?? [];
    const onboardingRows: string[][] = onboardingData.values ?? [];

    // Row 16 in Leads = index 15 (0-based); Row 13 in Onboarding_Queue = index 12
    const aliciaLead       = leadsRows[15]      ?? [];
    const aliciaOnboarding = onboardingRows[12] ?? [];

    // Read status from last column of each row
    const leadStatus       = String(aliciaLead[aliciaLead.length - 1]               ?? '').trim();
    const onboardingStatus = String(aliciaOnboarding[aliciaOnboarding.length - 1]   ?? '').trim();

    // Try to extract welcome_sent_date from onboarding row.
    // Convention: look for an ISO date string (YYYY-MM-DD) in any column of the onboarding row.
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const welcomeDateCol = aliciaOnboarding.find((cell, i) => i > 0 && ISO_DATE_RE.test(cell.trim()));
    const welcomeSentDate = welcomeDateCol?.trim() ?? ALICIA_CASE.welcome_sent_date ?? null;

    // The most advanced status wins — check onboarding row first (richer state),
    // then fall back to leads row.
    const activeStage =
      resolveActiveStage(onboardingStatus) ??
      resolveActiveStage(leadStatus)       ??
      'Lead';

    const activeIndex = STAGE_ORDER.indexOf(activeStage);

    // Build pipeline: stages before active are 'completada', active is 'activa', rest 'pendiente'
    const pipeline = { ...ALICIA_CASE.pipeline };
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const stage = STAGE_ORDER[i];
      if (i < activeIndex) {
        pipeline[stage] = {
          ...ALICIA_CASE.pipeline[stage],
          estado: 'completada',
          fecha: pipeline[stage].fecha ?? new Date().toISOString().split('T')[0],
          confirmacionAgente: true,
          confirmacionManual: true,
        };
      } else if (i === activeIndex) {
        pipeline[stage] = {
          ...ALICIA_CASE.pipeline[stage],
          estado: 'activa',
          fecha: pipeline[stage].fecha ?? new Date().toISOString().split('T')[0],
          confirmacionAgente: true,
          confirmacionManual: false,
        };
      } else {
        pipeline[stage] = {
          ...ALICIA_CASE.pipeline[stage],
          estado: 'pendiente',
          confirmacionAgente: false,
          confirmacionManual: false,
        };
      }
    }

    const liveCase: AeroCaso = {
      ...ALICIA_CASE,
      ultimaActualizacion: new Date().toISOString().split('T')[0],
      estadoActual: activeStage,
      welcome_sent_date: welcomeSentDate,
      pipeline,
    };

    return [liveCase];
  } catch (err) {
    console.error('[cases] Google Sheets fetch failed:', err);
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sheetsCases = await fetchFromSheets();
    const cases  = sheetsCases ?? [ALICIA_CASE];
    const source = sheetsCases ? 'sheets' : 'fallback';
    return NextResponse.json({ cases, source });
  } catch (err) {
    console.error('[cases] Route error:', err);
    return NextResponse.json({ cases: [ALICIA_CASE], source: 'fallback' });
  }
}
