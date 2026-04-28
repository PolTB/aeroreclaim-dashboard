import { NextResponse } from 'next/server';
import { getCommands, createCommand } from '@/lib/notionCommands';
import type { CreateCommandPayload } from '@/types';

// Cache en Vercel edge — comandos cambian con menos frecuencia que tasks
export const revalidate = 30;

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const commands = await getCommands();
    clearTimeout(timeoutId);

    return NextResponse.json({ commands }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error('[GET /api/notion/commands]', isTimeout ? 'TIMEOUT (8s)' : err);
    const msg = isTimeout ? 'Notion API timeout' : (err instanceof Error ? err.message : 'Failed to fetch commands');
    const isSetup = msg.includes('COMMANDS_DATABASE_ID');
    return NextResponse.json({ error: msg, needsSetup: isSetup }, { status: isTimeout ? 504 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateCommandPayload = await request.json();
    if (!body.titulo?.trim()) return NextResponse.json({ error: 'Titulo is required' }, { status: 400 });
    await createCommand(body);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/notion/commands]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create command' }, { status: 500 });
  }
}
