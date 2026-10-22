import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// ─── Bandeja de Pol (v2) — base de datos estructurada ────────────────────────
// Sustituye a la página de texto libre que se parseaba con expresiones
// regulares (lib/bandeja.ts). Aquella página mezclaba avisos, entradas ya
// resueltas y párrafos de 400 caracteres con jerga interna: Pol no entendía
// lo que tenía que hacer. Ahora cada fila es una tarea con campos fijos:
// qué hacer (una frase), por qué, cómo (pasos), caso, dinero y fecha límite.

const notion = new Client({ auth: process.env.NOTION_CEO_TOKEN ?? process.env.NOTION_TOKEN });

// El ID de una DB no es secreto: fallback al literal para no depender de una
// variable de entorno más en Vercel.
export const BANDEJA_DB_ID = process.env.BANDEJA_DATABASE_ID || '3ee8a573-e757-8196-abc6-f5d6626d8197';

export type BandejaEstado = 'Pendiente' | 'Hecho' | 'Descartado';

export interface BandejaTarea {
  id: string;
  tarea: string;
  porQue: string;
  como: string;
  caso: string;
  dineroEur: number | null;
  tipo: string | null;
  /** Etiqueta de tema (Casos, Leads, Contabilidad y gestoría, Instagram…). */
  tema: string | null;
  fechaLimite: string | null;
  estado: BandejaEstado;
  /** Fecha y hora del clic (las antiguas solo llevan fecha). */
  hechoEl: string | null;
  enlace: string | null;
  /** "CEO" si la tarea la hace el CEO (antes, una AER de Delegaciones); si no, de Pol. */
  para: 'Pol' | 'CEO';
  /** Encargo completo para el CEO; es lo que copia el botón "Copiar para Claude". */
  instrucciones: string;
  creada: string;
  editada: string;
}

type Props = PageObjectResponse['properties'];

const texto = (props: Props, key: string): string => {
  const p = props[key];
  if (p?.type === 'title') return p.title.map((t) => t.plain_text).join('');
  if (p?.type === 'rich_text') return p.rich_text.map((t) => t.plain_text).join('');
  return '';
};
const select = (props: Props, key: string): string | null => {
  const p = props[key];
  return p?.type === 'select' ? (p.select?.name ?? null) : null;
};
const fecha = (props: Props, key: string): string | null => {
  const p = props[key];
  return p?.type === 'date' ? (p.date?.start ?? null) : null;
};

function parse(page: PageObjectResponse): BandejaTarea {
  const p = page.properties;
  const num = p['Dinero en juego €'];
  const url = p['Enlace'];
  return {
    id: page.id,
    tarea: texto(p, 'Tarea'),
    porQue: texto(p, 'Por qué'),
    como: texto(p, 'Cómo'),
    caso: texto(p, 'Caso'),
    dineroEur: num?.type === 'number' ? num.number : null,
    tipo: select(p, 'Tipo'),
    tema: select(p, 'Tema'),
    fechaLimite: fecha(p, 'Fecha límite'),
    estado: (select(p, 'Estado') as BandejaEstado) ?? 'Pendiente',
    hechoEl: fecha(p, 'Hecho el'),
    enlace: url?.type === 'url' ? url.url : null,
    para: select(p, 'Para') === 'CEO' ? 'CEO' : 'Pol',
    instrucciones: texto(p, 'Instrucciones CEO'),
    creada: page.created_time,
    editada: page.last_edited_time,
  };
}

/** Pendientes (todas) + las resueltas en los últimos 14 días, para poder deshacer. */
export async function getBandeja(): Promise<BandejaTarea[]> {
  const desde = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const out: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: BANDEJA_DB_ID,
      filter: {
        or: [
          { property: 'Estado', select: { equals: 'Pendiente' } },
          { property: 'Estado', select: { is_empty: true } },
          { property: 'Hecho el', date: { on_or_after: desde } },
        ],
      },
      sorts: [{ property: 'Fecha límite', direction: 'ascending' }],
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...res.results.filter((r): r is PageObjectResponse => r.object === 'page' && 'properties' in r));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out.map(parse);
}

export async function setEstado(id: string, estado: BandejaEstado): Promise<void> {
  // Con hora: así las resueltas salen en el orden en que Pol las marcó y un
  // clic equivocado se encuentra arriba del todo.
  const ahora = new Date().toISOString();
  await notion.pages.update({
    page_id: id,
    properties: {
      Estado: { select: { name: estado } },
      'Hecho el': estado === 'Pendiente' ? { date: null } : { date: { start: ahora } },
    },
  });
}
