import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// AER-215 — endpoint de refresco manual bajo demanda.
// Uso: GET /api/revalidate?secret=XXXX
//
// /api/cases ya es 'force-dynamic' (ver fix en route.ts), así que en la
// práctica basta con esperar ≤60s tras editar el Sheet para ver el cambio.
// Este endpoint existe para el caso en que el CEO quiera verlo al instante
// (p.ej. justo después de corregir un dato y antes de una demo).
//
// Requiere la variable de entorno REVALIDATE_SECRET en el proyecto Vercel.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'REVALIDATE_SECRET no configurado en el proyecto Vercel' },
      { status: 500 }
    );
  }

  if (secret !== expected) {
    return NextResponse.json({ error: 'Secret inválido' }, { status: 401 });
  }

  revalidateTag('gas-cases');

  return NextResponse.json({
    revalidated: true,
    tag: 'gas-cases',
    ts: new Date().toISOString(),
  });
}
