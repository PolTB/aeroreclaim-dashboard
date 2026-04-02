import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { BlogEntry, BlogEstado } from '@/types';

// ─── Client singleton ─────────────────────────────────────────────────────────

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const BLOG_DB_ID = process.env.BLOG_CALENDAR_DB_ID!;

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

function getUrl(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'url' ? (p.url ?? null) : null;
}

function getRichText(props: Props, key: string): string {
  const p = props[key];
  return p?.type === 'rich_text' ? p.rich_text.map((t) => t.plain_text).join('') : '';
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseBlogEntry(page: PageObjectResponse): BlogEntry {
  const props = page.properties;
  const rawEstado = getSelect(props, 'Estado');
  const validEstados: BlogEstado[] = ['Publicado', 'Listo', 'Redactando', 'Pendiente DEL', 'Cancelado'];
  const estado: BlogEstado = validEstados.includes(rawEstado as BlogEstado)
    ? (rawEstado as BlogEstado)
    : 'Pendiente DEL';

  return {
    id: page.id,
    titulo: getTitle(props, 'Titulo'),
    fechaPublicacion: getDate(props, 'Fecha_Publicacion'),
    estado,
    tag: getSelect(props, 'Tag'),
    urlBlog: getUrl(props, 'URL_Blog'),
    keyword: getRichText(props, 'Keyword'),
    notas: getRichText(props, 'Notas'),
    url: page.url,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getBlogEntries(): Promise<BlogEntry[]> {
  const allPages: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.databases.query({
      database_id: BLOG_DB_ID,
      sorts: [{ property: 'Fecha_Publicacion', direction: 'ascending' }],
      start_cursor: cursor,
      page_size: 100,
    });

    const pages = response.results.filter(
      (r): r is PageObjectResponse => r.object === 'page' && 'properties' in r,
    );
    allPages.push(...pages);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return allPages.map(parseBlogEntry);
}
