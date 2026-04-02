import { NextResponse } from 'next/server';
import { getBlogEntries } from '@/lib/notionBlog';

export async function GET() {
  try {
    const entries = await getBlogEntries();
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[GET /api/notion/blog]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al cargar el calendario editorial' },
      { status: 500 },
    );
  }
}
