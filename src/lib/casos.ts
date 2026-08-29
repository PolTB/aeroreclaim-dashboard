import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RadarCaso } from '@/lib/notionRadar';
import type { AeroCaso } from '@/types';

// ─── Reglas de lectura de un caso ─────────────────────────────────────────────
// Compartidas entre la pestaña Casos y el resumen "Hoy" de la cabecera, para
// que las dos digan exactamente lo mismo sobre el mismo caso.

export const ETAPAS = [
  { key: 'Lead — mandato enviado',    short: 'Mandato enviado' },
  { key: 'Cliente formalizado',       short: 'Formalizado' },
  { key: 'Reclamación extrajudicial', short: 'Reclamando' },
  { key: 'AESA presentada',           short: 'AESA' },
] as const;

export type Urgencia = 'vencida' | 'urgente' | 'proxima' | 'tranquila';

export const URGENCIA_RANK: Record<Urgencia, number> = {
  vencida: 0, urgente: 1, proxima: 2, tranquila: 3,
};

/** Días naturales hasta la fecha (negativo si ya pasó), null si no hay fecha válida. */
export function diasHasta(iso: string | null): number | null {
  if (!iso) return null;
  const d = parseISO(iso);
  if (!isValid(d)) return null;
  return differenceInCalendarDays(d, new Date());
}

export function urgenciaDe(caso: RadarCaso): Urgencia {
  const dias = diasHasta(caso.fechaLimite);
  if (dias === null) return 'tranquila';
  if (dias < 0) return 'vencida';
  if (dias <= 3) return 'urgente';
  if (dias <= 7) return 'proxima';
  return 'tranquila';
}

/** Fecha límite en lenguaje natural — "vence en 3 días" se entiende; "12 sep" no. */
export function textoLimite(iso: string | null): string {
  const dias = diasHasta(iso);
  if (dias === null) return 'Sin fecha límite';
  if (dias < -1) return `Vencida hace ${Math.abs(dias)} días`;
  if (dias === -1) return 'Vencida ayer';
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  if (dias <= 14) return `Vence en ${dias} días`;
  return `Vence el ${format(parseISO(iso as string), "d 'de' MMMM", { locale: es })}`;
}

/** Días desde el último movimiento real del caso (campo manual o edición en Notion). */
export function diasSinMovimiento(caso: RadarCaso): number {
  const fechas = [caso.ultimaActividad, caso.lastEdited]
    .filter(Boolean)
    .map((f) => parseISO(f as string))
    .filter(isValid);
  if (!fechas.length) return 999;
  const ultima = new Date(Math.max(...fechas.map((f) => f.getTime())));
  return Math.abs(differenceInCalendarDays(ultima, new Date()));
}

export const eur = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('es-ES')} €`;

/** Nombre comparable entre fuentes: sin acentos, sin dobles espacios, en minúsculas. */
export function normalizarNombre(n: string): string {
  return n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function mismoCliente(a: string, b: string): boolean {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  // Cada fuente escribe el nombre a su manera: el Radar guarda "Alicia
  // Zunzunegui" y el Sheet "Alicia Manuela Zunzunegui Garcia". Comparar el
  // nombre y el token siguiente daba un falso "lead sin ficha" en cuanto había
  // un segundo nombre por medio. Se exige coincidencia del nombre de pila más
  // al menos un apellido en común, en cualquier posición.
  const ta = na.split(' ');
  const tb = nb.split(' ');
  if (ta[0] !== tb[0]) return false;
  return ta.slice(1).some((t) => t.length > 2 && tb.slice(1).includes(t));
}

/**
 * Leads que el pipeline del Sheet conoce y el Radar no. Son los que nadie
 * vigila: ningún control diario mira el Sheet, y el Radar es lo que barre
 * EL VIGÍA. Así se perdió el caso de Javier Montes en julio de 2026.
 */
export function leadsSinFicha(sheetCases: AeroCaso[], radar: RadarCaso[]): AeroCaso[] {
  if (!sheetCases.length || !radar.length) return [];
  return sheetCases.filter(
    (s) => s.estadoActual !== 'Cerrado' && !radar.some((r) => mismoCliente(r.cliente, s.pasajero)),
  );
}

export const casosActivos = (radar: RadarCaso[]) => radar.filter((c) => !c.cerrado);
