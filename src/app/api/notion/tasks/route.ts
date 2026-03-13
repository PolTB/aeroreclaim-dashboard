import { NextResponse } from 'next/server';
import { getTasks, createTask } from '@/lib/notion';
import type { CreateTaskPayload } from '@/types';

export async function GET() {
  try {
    const data = await getTasks();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/notion/tasks]', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to fetch tasks',
        hint: 'Check NOTION_API_KEY and NOTION_DATABASE_ID in .env.local',
      },
      { status: 500 },
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
