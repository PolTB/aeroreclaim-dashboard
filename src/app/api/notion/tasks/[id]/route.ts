import { NextResponse } from 'next/server';
import { updateTask } from '@/lib/notion';
import type { UpdateTaskPayload } from '@/types';

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const body: UpdateTaskPayload = await request.json();
    await updateTask(params.id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[PATCH /api/notion/tasks/${params.id}]`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update task' },
      { status: 500 },
    );
  }
}
