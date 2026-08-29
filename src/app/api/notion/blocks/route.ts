import { NextRequest, NextResponse } from 'next/server';

// NOTION_CEO_TOKEN = token CEO (ntn_371355748712...) — acceso completo al workspace
// NOTION_TOKEN = token integración dashboard — acceso limitado a páginas compartidas
const NOTION_API_KEY = process.env.NOTION_CEO_TOKEN ?? process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? '';

// Misma lección que /api/cases (AER-215) y /api/notion/radar (AER-224): sin
// force-dynamic, Next puede tratar la ruta como estática y servir la Bandeja
// cacheada en el Edge. Una bandeja de acciones urgentes con minutos u horas de
// retraso es peor que no tenerla: se actúa sobre algo ya resuelto.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const { pageId, text } = await req.json();
  if (!pageId || !text) return NextResponse.json({ error: 'Missing pageId or text' }, { status: 400 });

  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!pageId) return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });

  // Se pagina hasta agotar la página: la Bandeja acumula entradas y el log de
  // "Pol actuó", y con page_size=100 fijo las últimas dejaban de leerse en
  // silencio — justo las más recientes, que son las que importan.
  const results: unknown[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);

    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data: { results?: unknown[]; has_more?: boolean; next_cursor?: string | null } = await res.json();
    results.push(...(data.results ?? []));
    cursor = data.has_more ? (data.next_cursor ?? null) : null;
  } while (cursor);

  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
  );
}
