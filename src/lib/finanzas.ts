import type { RadarCaso } from '@/lib/notionRadar';
import { ETAPAS } from '@/lib/casos';

// ─── Finanzas ─────────────────────────────────────────────────────────────────
// Dos fuentes:
//  · La foto de la contabilidad que publica `contabilidad/tools/registro.js` en
//    una página privada de Notion cada vez que se toca el libro registro. Solo
//    cifras agregadas: el repo del dashboard es público y nunca lleva números.
//  · El Radar de Casos, en directo, para lo que viene (casos en marcha).
// Todo sin IVA: el IVA no es del negocio, se cobra y se paga a Hacienda.

export interface FinanzasSnapshot {
  version: number;
  generado: string;
  ejercicio: number;
  ultima_revision: string;
  meses: { mes: string; ingresos: number; gastos: number; cobrados: number; por_tipo?: Record<TipoGasto, number> }[];
  categorias: { nombre: string; importe: number }[];
  /** Gasto del año por tipo, con sus partidas (desde la versión 2 del resumen). */
  tipos?: { tipo: TipoGasto; importe: number; partidas: { nombre: string; importe: number; veces: number }[] }[];
  /** Lo que cuesta cada mes a partir de hoy, sin IVA recuperable. */
  fijos: { nombre: string; importe: number; tipo?: TipoGasto }[];
  dinero_clientes: number;
  impuestos: { trimestre: string; iva: number; irpf: number; plazo?: string };
}

/** Cómo se comporta cada gasto: solo, por decisión de Pol, por caso o una sola vez. */
export type TipoGasto = 'fijo' | 'publicidad' | 'caso' | 'puntual';

export const TIPOS_GASTO: { key: TipoGasto; nombre: string }[] = [
  { key: 'fijo', nombre: 'Fijos' },
  { key: 'publicidad', nombre: 'Publicidad' },
  { key: 'caso', nombre: 'Por caso' },
  { key: 'puntual', nombre: 'Puntuales' },
];

/** Etapas en las que el caso ya se ha reclamado (y ha podido gastar burofax). */
const RECLAMADO = ['Reclamación extrajudicial', 'AESA presentada', 'Cobrado'];

/** Nuestra comisión: 25 % de la compensación, sin IVA. */
export const COMISION = 0.25;

const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const comisionDe = (c: RadarCaso) => (c.compensacionEur ?? 0) * COMISION;
const LEAD = 'Lead — mandato enviado';

export function calcularFinanzas(f: FinanzasSnapshot, radar: RadarCaso[], hoy = new Date()) {
  const ingresos = suma(f.meses.map((m) => m.ingresos));
  const gastos = suma(f.meses.map((m) => m.gastos));
  const resultado = ingresos - gastos;
  const fijoMes = suma(f.fijos.map((x) => x.importe));

  // Comisión media por pasajero: casos cobrados y vivos con importe (los perdidos no pagan).
  const conImporte = radar.filter((c) => c.etapa !== 'Perdido' && (c.compensacionEur ?? 0) > 0);
  const comisionMedia = conImporte.length ? suma(conImporte.map(comisionDe)) / conImporte.length : null;
  const equilibrio = comisionMedia ? Math.ceil(fijoMes / comisionMedia) : null;

  const ym = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const cobradosMes = f.meses.find((m) => m.mes === ym)?.cobrados ?? 0;
  const ultimos3 = f.meses.slice(-3);
  const mediaMensual = ultimos3.length ? suma(ultimos3.map((m) => m.ingresos)) / ultimos3.length : 0;

  // Lo que viene: casos ya formalizados que todavía no han cobrado.
  const enMarcha = radar.filter((c) => !c.cerrado && c.etapa !== LEAD && (c.compensacionEur ?? 0) > 0);
  const comisionEnMarcha = suma(enMarcha.map(comisionDe));
  const porEtapa = ETAPAS.filter((e) => e.key !== LEAD)
    .map((e) => {
      const cs = enMarcha.filter((c) => c.etapa === e.key);
      return { etapa: e.short, pasajeros: cs.length, comision: suma(cs.map(comisionDe)) };
    })
    .filter((x) => x.pasajeros > 0);
  const leads = radar.filter((c) => !c.cerrado && c.etapa === LEAD).length;

  // Lo que cuesta reclamar un pasajero (burofax y cartas) y lo que deja después.
  const gastoPorCaso = f.tipos?.find((t) => t.tipo === 'caso')?.importe ?? 0;
  const reclamados = radar.filter((c) => c.etapa && RECLAMADO.includes(c.etapa)).length;
  const costePorPasajero = reclamados ? gastoPorCaso / reclamados : null;
  const quedaPorPasajero = comisionMedia != null && costePorPasajero != null ? comisionMedia - costePorPasajero : null;
  // Gasto mensual comprometido a partir de hoy, separando la publicidad (la decide Pol).
  const fijoSinPublicidad = suma(f.fijos.filter((x) => x.tipo !== 'publicidad').map((x) => x.importe));
  const publicidadMes = fijoMes - fijoSinPublicidad;

  // Previsión a 31/12: lo de hoy, menos los gastos fijos que quedan, más lo que está en marcha.
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const mesesQueQuedan = 11 - hoy.getMonth() + (diasMes - hoy.getDate()) / diasMes;
  const finSinNada = resultado - fijoMes * mesesQueQuedan;
  const finConMarcha = finSinNada + comisionEnMarcha;
  const pasajerosParaCero = finConMarcha < 0 && comisionMedia ? Math.ceil(-finConMarcha / comisionMedia) : 0;

  return {
    ingresos, gastos, resultado, fijoMes,
    comisionMedia, equilibrio, cobradosMes, mediaMensual,
    enMarcha: enMarcha.length, comisionEnMarcha, porEtapa, leads,
    costePorPasajero, quedaPorPasajero, reclamados, fijoSinPublicidad, publicidadMes,
    mesesCubiertos: fijoMes ? comisionEnMarcha / fijoMes : 0,
    finSinNada, finConMarcha, pasajerosParaCero,
  };
}

/** 1.176 €, con punto de miles también en 4 cifras (es-ES no lo pone). */
export function euros(n: number, decimales = 0): string {
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} €`;
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const mesCorto = (ym: string) => MESES_CORTOS[Number(ym.slice(5, 7)) - 1];
export const mesLargo = (ym: string) => MESES_LARGOS[Number(ym.slice(5, 7)) - 1];

/** Nombres de categoría del libro registro, en lenguaje de andar por casa. */
export const CATEGORIA_LLANA: Record<string, string> = {
  'Software y suscripciones': 'Herramientas (Claude, email)',
  'Comunicaciones certificadas': 'Burofax y cartas certificadas',
  'Dominio y hosting web': 'Web y dominios',
  'Gestoría': 'Gestoría y altas',
  'Publicidad': 'Publicidad',
};
