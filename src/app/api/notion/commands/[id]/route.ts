import { NextResponse } from 'next/server';
import { updateCommand } from '@/lib/notionCommands';
import type { UpdateCommandPayload } from '@/types';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body: UpdateCommandPayload = await request.json();
    await updateCommand(params.id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/notion/commands/[id]]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update command' }, { status: 500 });
  }
}
