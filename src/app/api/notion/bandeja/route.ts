import { NextRequest, NextResponse } from 'next/server';
import { getBandeja, setEstado, type BandejaEstado } from '@/lib/bandejaDb';

// Sin caché: una bandeja de acciones con minutos de retraso hace actuar sobre
// algo ya resuelto (misma lección que /api/notion/radar).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const tareas = await getBandeja();
    return NextResponse.json({ tareas }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const ESTADOS: BandejaEstado[] = ['Pendiente', 'Hecho', 'Descartado'];

export async function PATCH(req: NextRequest) {
  const { id, estado } = (await req.json().catch(() => ({}))) as { id?: string; estado?: BandejaEstado };
  if (!id || !estado || !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Faltan id o estado válido' }, { status: 400 });
  }
  try {
    await setEstado(id, estado);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
