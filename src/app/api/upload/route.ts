import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { trackEvent } from '@/lib/analytics';
import type { CommandArchivoTipo } from '@/types';

const ALLOWED_TYPES: Record<string, CommandArchivoTipo> = {
  'image/jpeg': 'imagen',
  'image/png': 'imagen',
  'image/gif': 'imagen',
  'image/webp': 'imagen',
  'application/pdf': 'PDF',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/html': 'HTML',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'otro',
  'text/plain': 'otro',
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 });
    }

    const detectedTipo: CommandArchivoTipo = ALLOWED_TYPES[file.type] ?? 'otro';

    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    // Funnel: letter_sent — fire when a PDF is uploaded (proxy for carta aerolínea)
    if (detectedTipo === 'PDF') {
      const airlineMatch = file.name.match(/^([A-Z]{2})/i);
      await trackEvent('letter_sent', {
        event_category: 'funnel',
        airline_code: airlineMatch ? airlineMatch[1].toUpperCase() : 'unknown',
        file_name: file.name,
      });
    }

    return NextResponse.json({ url: blob.url, tipo: detectedTipo });
  } catch (err) {
    console.error('[POST /api/upload]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
