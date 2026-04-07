import { list, put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { trackEvent } from '@/lib/analytics';
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

    // Derive live stages from sheet statuses
    const leadStatus       = String(aliciaLead[aliciaLead.length - 1]       ?? '').trim();
    const onboardingStatus = String(aliciaOnboarding[aliciaOnboarding.length - 1] ?? '').trim();

    const isApproved = leadStatus.includes('APROBADO');
    const isDocs     = onboardingStatus.includes('DOCS_RECEIVED');

    const liveCase: AeroCaso = {
      ...ALICIA_CASE,
      ultimaActualizacion: new Date().toISOString().split('T')[0],
      estadoActual: isDocs ? 'Docs Recibidos' : isApproved ? 'Aprobado' : 'Lead',
      pipeline: {
        ...ALICIA_CASE.pipeline,
        'Lead': {
          ...ALICIA_CASE.pipeline['Lead'],
          estado: 'completada',
          confirmacionAgente: isApproved,
          confirmacionManual: isApproved,
        },
        'Aprobado': {
          ...ALICIA_CASE.pipeline['Aprobado'],
          estado: isApproved ? 'completada' : 'pendiente',
          confirmacionAgente: isApproved,
          confirmacionManual: isApproved,
        },
        'Docs Recibidos': {
          ...ALICIA_CASE.pipeline['Docs Recibidos'],
          estado: isDocs ? 'activa' : 'pendiente',
          confirmacionAgente: isDocs,
          confirmacionManual: false,
        },
      },
    };

    return [liveCase];
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

    // State diffing: detect new/changed cases and fire GA4 events
    const prev = await loadPreviousState();
    await diffAndTrack(prev, cases);
    await saveState(cases);

    return NextResponse.json({ cases, source });
  } catch (err) {
    console.error('[cases] Route error:', err);
    return NextResponse.json({ cases: [ALICIA_CASE], source: 'fallback' });
  }
}
