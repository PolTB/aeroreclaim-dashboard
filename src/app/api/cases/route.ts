import { NextResponse } from 'next/server';
import type { AeroCaso, PipelineStage } from '@/types';

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

// ─── Google Sheets reader ──────────────────────────────────────────────────────
// Uses headers from row 1 to locate columns dynamically — no hardcoded indices.
// Required env vars: GOOGLE_SHEETS_SPREADSHEET_ID + GOOGLE_SHEETS_API_KEY
// Reads ALL rows (excluding test cases).

async function fetchFromSheets(): Promise<AeroCaso[] | null> {
  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const apiKey  = process.env.GOOGLE_SHEETS_API_KEY;
  if (!sheetId || !apiKey) return null;

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;

  try {
    const [leadsRes, onboardingRes] = await Promise.all([
      fetch(`${base}/Leads!A:Z?key=${apiKey}`,            { next: { revalidate: 60 } }),
      fetch(`${base}/Onboarding_Queue!A:Z?key=${apiKey}`, { next: { revalidate: 60 } }),
    ]);
    if (!leadsRes.ok || !onboardingRes.ok) return null;

    const leadsData      = await leadsRes.json();
    const onboardingData = await onboardingRes.json();

    const leadsRows: string[][]      = leadsData.values      ?? [];
    const onboardingRows: string[][] = onboardingData.values ?? [];

    if (leadsRows.length < 2) return null;

    // Build header → column index maps (case-insensitive)
    const leadsHeaders: Record<string, number> = {};
    (leadsRows[0] ?? []).forEach((h, i) => { leadsHeaders[h.toLowerCase().trim()] = i; });

    const onboardingHeaders: Record<string, number> = {};
    (onboardingRows[0] ?? []).forEach((h, i) => { onboardingHeaders[h.toLowerCase().trim()] = i; });

    // Helper: get cell by header name with fallback aliases
    const col = (headers: Record<string, number>, ...names: string[]) =>
      names.find(n => headers[n.toLowerCase()] !== undefined)
        ? headers[names.find(n => headers[n.toLowerCase()] !== undefined)!.toLowerCase()]
        : -1;

    // Build onboarding lookup: caseId → row
    const onboardingById: Record<string, string[]> = {};
    const onboardingIdCol = col(onboardingHeaders, 'case_id', 'id', 'caso_id');
    for (const row of onboardingRows.slice(1)) {
      const id = row[onboardingIdCol]?.trim();
      if (id) onboardingById[id] = row;
    }

    const cases: AeroCaso[] = [];

    for (const row of leadsRows.slice(1)) {
      const nombre = row[col(leadsHeaders, 'nombre', 'nombre completo', 'name', 'pasajero')]?.trim() ?? '';
      if (!nombre || isTestCase(nombre)) continue;

      const caseId      = row[col(leadsHeaders, 'case_id', 'id', 'caso_id')]?.trim()
                       ?? `case-${nombre.toLowerCase().replace(/\s+/g, '-')}`;
      const vuelo       = row[col(leadsHeaders, 'vuelo', 'flight', 'codigo_vuelo')]?.trim() ?? '';
      const ruta        = row[col(leadsHeaders, 'ruta', 'route', 'origen_destino')]?.trim() ?? '';
      const fecha       = row[col(leadsHeaders, 'fecha_vuelo', 'fecha', 'flight_date')]?.trim() ?? '';
      const comp        = parseFloat(row[col(leadsHeaders, 'compensacion', 'compensation', 'importe')] ?? '0') || 0;
      const score       = parseFloat(row[col(leadsHeaders, 'score_legal', 'score', 'scoring')] ?? '0') || 0;
      const leadEstado  = row[col(leadsHeaders, 'estado', 'status', 'state')]?.trim() ?? '';

      // Merge onboarding data if available
      const onbRow      = onboardingById[caseId] ?? [];
      const onbEstado   = onbRow[col(onboardingHeaders, 'estado', 'status', 'state')]?.trim() ?? '';
      const welcomeDate = onbRow[col(onboardingHeaders, 'welcome_sent_date', 'welcome_date', 'onboarding_date')]?.trim() ?? null;

      const effectiveStatus = onbEstado || leadEstado;
      const { stageActual } = resolveStage(effectiveStatus);

      const stageDates: Partial<Record<PipelineStage, string>> = {};
      if (fecha)       stageDates['Lead'] = fecha;
      if (welcomeDate) stageDates['Aprobado'] = welcomeDate;

      cases.push({
        id:                   caseId,
        pasajero:             nombre,
        vuelo,
        ruta,
        fecha,
        compensacion:         comp,
        scoreLegal:           score,
        estadoActual:         stageActual,
        ultimaActualizacion:  new Date().toISOString().split('T')[0],
        pipeline:             buildPipeline(stageActual, stageDates),
        ...(welcomeDate ? { welcomeSentDate: welcomeDate } : {}),
      });
    }

    return cases.length > 0 ? cases : null;
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
