import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// ─── Client — reutiliza el MISMO token que notion.ts (Tasks) y notionCommands.ts
// (Kanban/Delegaciones). AER-224: no se añade ninguna key nueva. ────────────────

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// DB ID no es secreto (a diferencia del token) — fallback al literal conocido
// si no se configura RADAR_DATABASE_ID en Vercel, para evitar fricción de deploy.
const DB_ID = process.env.RADAR_DATABASE_ID || '39a8a573-e757-81ac-be54-d5108ba2ec8d';

const ETAPAS_EXCLUIDAS = ['Perdido', 'Cobrado'];

export type RadarEtapa =
  | 'Lead — mandato enviado'
  | 'Cliente formalizado'
  | 'Reclamación extrajudicial'
  | 'AESA presentada'
  | 'Cobrado'
  | 'Perdido';

export interface RadarCaso {
  id: string;
  cliente: string;
  caseId: string;
  etapa: RadarEtapa | null;
  compensacionEur: number | null;
  comisionEstEur: number | null;
  vuelo: string;
  proximaAccion: string;
  responsable: string | null;
  fechaLimite: string | null; // ISO date, null si vacía
  ultimaActividad: string | null;
  expediente: string;
  notas: string;
  url: string;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

type Props = PageObjectResponse['properties'];

function getTitle(props: Props, key: string): string {
  const p = props[key];
  return p?.type === 'title' ? p.title.map((t) => t.plain_text).join('') : '';
}

function getSelect(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'select' ? (p.select?.name ?? null) : null;
}

function getDate(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'date' ? (p.date?.start ?? null) : null;
}

function getRichText(props: Props, key: string): string {
  const p = props[key];
  return p?.type === 'rich_text' ? p.rich_text.map((t) => t.plain_text).join('') : '';
}

function getNumber(props: Props, key: string): number | null {
  const p = props[key];
  return p?.type === 'number' ? (p.number ?? null) : null;
}

function parseRadarCaso(page: PageObjectResponse): RadarCaso {
  const props = page.properties;
  return {
    id: page.id,
    cliente: getTitle(props, 'Cliente'),
    caseId: getRichText(props, 'Case ID') || getTitle(props, 'Case ID'),
    etapa: getSelect(props, 'Etapa') as RadarEtapa | null,
    compensacionEur: getNumber(props, 'Compensacion EUR'),
    comisionEstEur: getNumber(props, 'Comision est EUR'),
    vuelo: getRichText(props, 'Vuelo'),
    proximaAccion: getRichText(props, 'Proxima accion'),
    responsable: getSelect(props, 'Responsable'),
    fechaLimite: getDate(props, 'Fecha limite'),
    ultimaActividad: getDate(props, 'Ultima actividad'),
    expediente: getRichText(props, 'Expediente/Tracking'),
    notas: getRichText(props, 'Notas'),
    url: page.url,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Devuelve los casos activos (Etapa ≠ Perdido y ≠ Cobrado), ordenados por
 * Fecha limite ascendente con los casos sin fecha al final.
 *
 * El sort se aplica dos veces: en la query de Notion (best-effort) y de nuevo
 * en JS tras recibir los resultados, porque el comportamiento exacto de Notion
 * al ordenar fechas vacías no está garantizado por la API — el segundo sort
 * es lo que realmente asegura "sin fecha al final".
 */
export async function getRadarCasos(): Promise<RadarCaso[]> {
  if (!DB_ID) throw new Error('RADAR_DATABASE_ID not set');

  const allPages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        and: ETAPAS_EXCLUIDAS.map((etapa) => ({
          property: 'Etapa',
          select: { does_not_equal: etapa },
        })),
      },
      sorts: [{ property: 'Fecha limite', direction: 'ascending' }],
      start_cursor: cursor,
      page_size: 100,
    });

    const pages = res.results.filter(
      (r): r is PageObjectResponse => r.object === 'page' && 'properties' in r,
    );
    allPages.push(...pages);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const casos = allPages.map(parseRadarCaso);

  // Sort defensivo en JS: fecha ascendente (ISO string compara bien con < >),
  // null siempre al final. No confiar solo en el sort de la API de Notion.
  casos.sort((a, b) => {
    if (a.fechaLimite === null && b.fechaLimite === null) return 0;
    if (a.fechaLimite === null) return 1;
    if (b.fechaLimite === null) return -1;
    return a.fechaLimite < b.fechaLimite ? -1 : a.fechaLimite > b.fechaLimite ? 1 : 0;
  });

  return casos;
}
