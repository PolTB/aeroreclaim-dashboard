import { NextResponse } from 'next/server';
import { getTasks, createTask } from '@/lib/notion';
import type { CreateTaskPayload } from '@/types';

// Cache en Vercel edge para 30s — reduce llamadas a Notion en picos de tráfico.
// El dashboard refresca cada 5 min, así que 30s de stale es transparente para el usuario.
export const revalidate = 30;

export async function GET() {
  // Timeout de 8s — Notion SDK no tiene timeout por defecto y puede colgar la función
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const data = await getTasks();
    clearTimeout(timeoutId);

    return NextResponse.json(data, {
      headers: {
        // Cache en el cliente 30s, en Vercel CDN 60s con stale-while-revalidate 120s
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error('[GET /api/notion/tasks]', isTimeout ? 'TIMEOUT (8s)' : err);
    return NextResponse.json(
      {
        error: isTimeout ? 'Notion API timeout — reintentando en el siguiente ciclo' : (err instanceof Error ? err.message : 'Failed to fetch tasks'),
        hint: 'Check NOTION_API_KEY and NOTION_DATABASE_ID in .env.local',
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateTaskPayload = await request.json();

    if (!body.tarea?.trim()) {
      return NextResponse.json({ error: 'Task name is required' }, { status: 400 });
    }

    await createTask(body);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/notion/tasks]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create task' },
      { status: 500 },
    );
  }
}
