import { NextResponse } from 'next/server';
import { getFinanzas } from '@/lib/finanzasDb';

// Protegida por el middleware (Basic Auth) como el resto de /api: son las
// cuentas del negocio.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const finanzas = await getFinanzas();
    return NextResponse.json({ finanzas }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    console.error('[GET /api/finanzas]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
