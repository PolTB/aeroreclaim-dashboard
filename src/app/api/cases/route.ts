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
