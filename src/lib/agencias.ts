import type { RadarCaso } from '@/lib/notionRadar';

// ─── Agencias colaboradoras (21/10/2026) ──────────────────────────────────────
// Cada agencia reparte tarjetas con un QR a aeroreclaim.com/?ref=<codigo>.
//  · Visitas: las cuenta un Apps Script de info@ (gas/visitas-agencias en el repo
//    del CEO), que también guarda el nombre de cada agencia dada de alta. Nada de
//    eso vive en este repo, que es público.
//  · Leads y cobrados: filas del Radar con Origen "Agencia" y "Agencia: <codigo>"
//    en Notas (lo escribe el Motor diario). Una fila = un pasajero.
//  · Lo que les debemos: 25 € por pasajero cobrado, salvo que en Notas ponga
//    "Agencia pagada" (lo escribe el CEO al registrar el pago).

export const PAGO_POR_PASAJERO = 25;

export interface VisitasAgencias {
  visitas: Record<string, Record<string, number>>; // codigo → día → visitas
  agencias: Record<string, { nombre: string; desde: string }>;
}

export interface FilaAgencia {
  codigo: string;
  nombre: string;
  /** Día del alta en el contador (null si solo aparece en el Radar). */
  desde: string | null;
  visitas: number;
  visitas30: number;
  ultimaVisita: string | null;
  leads: number;
  enMarcha: number;
  cobrados: number;
  pagados: number;
  debemos: number;
}

const CODIGO_EN_NOTAS = /Agencia:\s*([a-z0-9-]{2,30})/i;
const PAGADA = /Agencia pagada/i;


/** Días que se dan a una agencia para empezar a repartir antes de avisar de que no tiene visitas. */
export const DIAS_DE_MARGEN = 14;

/** Código de agencia de una fila del Radar, o null si no viene de una agencia. */
export function codigoAgencia(c: RadarCaso): string | null {
  const m = c.notas.match(CODIGO_EN_NOTAS);
  if (m) return m[1].toLowerCase();
  return c.origen === 'Agencia' ? 'sin código' : null;
}

export function calcularAgencias(datos: VisitasAgencias | null, radar: RadarCaso[], hoy = new Date()): FilaAgencia[] {
  const visitas = datos?.visitas ?? {};
  const altas = datos?.agencias ?? {};
  const hace30 = new Date(hoy.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const filas = new Map<string, FilaAgencia>();
  const fila = (codigo: string) => {
    let f = filas.get(codigo);
    if (!f) {
      const dias = visitas[codigo] ?? {};
      const fechas = Object.keys(dias).sort();
      f = {
        codigo,
        nombre: altas[codigo]?.nombre ?? codigo,
        desde: altas[codigo]?.desde ?? null,
        visitas: Object.values(dias).reduce((a, b) => a + b, 0),
        visitas30: fechas.filter((d) => d >= hace30).reduce((a, d) => a + dias[d], 0),
        ultimaVisita: fechas.at(-1) ?? null,
        leads: 0, enMarcha: 0, cobrados: 0, pagados: 0, debemos: 0,
      };
      filas.set(codigo, f);
    }
    return f;
  };

  // Solo las agencias dadas de alta: así no salen visitas de códigos mal escritos.
  Object.keys(altas).forEach(fila);

  for (const c of radar) {
    const codigo = codigoAgencia(c);
    if (!codigo || codigo === 'prueba') continue;
    const f = fila(codigo);
    f.leads++;
    if (c.etapa === 'Cobrado') {
      f.cobrados++;
      if (PAGADA.test(c.notas)) f.pagados++;
    } else if (c.etapa !== 'Perdido' && c.etapa !== 'Lead — mandato enviado') {
      f.enMarcha++;
    }
  }
  const lista = Array.from(filas.values());
  for (const f of lista) f.debemos = (f.cobrados - f.pagados) * PAGO_POR_PASAJERO;

  return lista.sort(
    (a, b) => b.debemos - a.debemos || b.leads - a.leads || b.visitas - a.visitas || a.nombre.localeCompare(b.nombre, 'es'),
  );
}
