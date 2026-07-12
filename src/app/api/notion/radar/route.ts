import { NextResponse } from 'next/server';
import { getRadarCasos } from '@/lib/notionRadar';

// AER-224: force-dynamic — lección AER-221 (/api/cases). Sin esto, Next.js
// puede tratar la ruta como estática/ISR y cachear la respuesta completa en
// el Edge de Vercel, sirviendo datos obsoletos del Radar indefinidamente.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // Timeout de 8s — mismo patrón que /api/notion/tasks y /api/notion/commands
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const casos = await getRadarCasos();
    clearTimeout(timeoutId);

    return NextResponse.json(
      { casos },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
    );
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error('[GET /api/notion/radar]', isTimeout ? 'TIMEOUT (8s)' : err);

    const msg = isTimeout
      ? 'Notion API timeout'
      : err instanceof Error
        ? err.message
        : 'Failed to fetch radar casos';

    // Detecta específicamente falta de acceso de la integración a la DB,
    // para que la UI pueda mostrar un mensaje honesto en vez de un error genérico.
    const isAccessError =
      /unauthorized|restricted|could not find database|does not have access/i.test(msg);

    return NextResponse.json(
      { error: msg, needsAccess: isAccessError },
      { status: isTimeout ? 504 : isAccessError ? 403 : 500 },
    );
  }
}
