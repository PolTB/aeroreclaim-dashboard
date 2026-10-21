import { NextResponse } from 'next/server';
import type { VisitasAgencias } from '@/lib/agencias';

// Protegida por el middleware (Basic Auth) como el resto de /api. Lee el
// contador de visitas por agencia (Apps Script de info@); la URL y la clave de
// lectura van en las variables VISITAS_AGENCIAS_URL y VISITAS_AGENCIAS_KEY.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const url = process.env.VISITAS_AGENCIAS_URL;
  const key = process.env.VISITAS_AGENCIAS_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Faltan VISITAS_AGENCIAS_URL o VISITAS_AGENCIAS_KEY' }, { status: 500 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${url}?leer=${encodeURIComponent(key)}`, { cache: 'no-store', signal: controller.signal });
    const datos = (await res.json()) as VisitasAgencias & { error?: string };
    if (datos.error) throw new Error(`Contador de visitas: ${datos.error}`);
    return NextResponse.json(
      { visitas: datos.visitas ?? {}, agencias: datos.agencias ?? {} },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? 'El contador de visitas no ha contestado' : (e as Error).message;
    console.error('[GET /api/agencias]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
