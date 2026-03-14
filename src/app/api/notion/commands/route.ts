import { NextResponse } from 'next/server';
import { getCommands, createCommand } from '@/lib/notionCommands';
import type { CreateCommandPayload } from '@/types';

export async function GET() {
  try {
    const commands = await getCommands();
    return NextResponse.json({ commands });
  } catch (err) {
    console.error('[GET /api/notion/commands]', err);
    const msg = err instanceof Error ? err.message : 'Failed to fetch commands';
    const isSetup = msg.includes('COMMANDS_DATABASE_ID');
    return NextResponse.json({ error: msg, needsSetup: isSetup }, { status: 500 });
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
