import { NextResponse } from 'next/server';

/**
 * /api/health — keep-warm endpoint
 *
 * Llamado por el cron de Vercel cada 10 min para mantener la función caliente.
 * Elimina los cold starts de >1s que causan el "DOWN" en el weekly audit.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, ts: Date.now(), service: 'aeroreclaim-dashboard' },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
