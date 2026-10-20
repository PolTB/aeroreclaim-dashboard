import type { RadarCaso } from '@/lib/notionRadar';
import { COMISION, type FinanzasSnapshot } from '@/lib/finanzas';

// ─── Previsión ────────────────────────────────────────────────────────────────
// Leads del Radar de Casos (en directo) + números de la contabilidad. Todo se
// calcula en el navegador: el repo es público y aquí no hay ninguna cifra.
//  · medir():    lo que ya ha pasado (ritmo de leads, cuántos firman, de dónde vienen)
//  · proyectar(): los próximos 12 meses con los supuestos que elija Pol
// Cada fila del Radar es un pasajero: un lead de una familia de 3 cuenta 3.

const LEAD = 'Lead — mandato enviado';
const DIA = 86_400_000;
/** Días de un mes medio. */
export const MES = 30.4;

export type EstadoLead = 'abierto' | 'firmado' | 'perdido';

export interface LeadMedido {
  fecha: string; // AAAA-MM-DD en que entró
  estado: EstadoLead;
  origen: string;
}

export interface Tramo {
  clave: string; // AAAA-MM o AAAA-MM-DD (lunes de la semana)
  leads: number;
  firmados: number;
  abiertos: number;
  perdidos: number;
  porOrigen: Record<string, number>;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dia = (s: string) => new Date(`${s}T12:00:00`);
const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function sumarMeses(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Día en que entró el lead: el Case ID lo lleva (AR-AAAAMMDD-…); si no, cuando se creó la ficha. */
export function fechaEntrada(c: RadarCaso): string {
  const m = /AR-(\d{4})(\d{2})(\d{2})/.exec(c.caseId);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : (c.creado ?? c.lastEdited).slice(0, 10);
}

function estadoDe(c: RadarCaso): EstadoLead {
  if (c.etapa === 'Perdido') return 'perdido';
  if (!c.etapa || c.etapa === LEAD) return 'abierto';
  return 'firmado';
}

/** Junta las variantes de Google (Search, Demand Gen, sin detalle…) en una sola. */
export function grupoOrigen(o: string | null): string {
  if (!o) return 'Sin dato';
  if (/google/i.test(o)) return 'Google Ads';
  return o;
}

function tramo(clave: string, ls: LeadMedido[]): Tramo {
  const porOrigen: Record<string, number> = {};
  ls.forEach((l) => { porOrigen[l.origen] = (porOrigen[l.origen] ?? 0) + 1; });
  return {
    clave,
    leads: ls.length,
    firmados: ls.filter((l) => l.estado === 'firmado').length,
    abiertos: ls.filter((l) => l.estado === 'abierto').length,
    perdidos: ls.filter((l) => l.estado === 'perdido').length,
    porOrigen,
  };
}

export function medir(radar: RadarCaso[], f: FinanzasSnapshot, hoy = new Date()) {
  const leads: LeadMedido[] = radar.map((c) => ({ fecha: fechaEntrada(c), estado: estadoDe(c), origen: grupoOrigen(c.origen) }));
  const hoyIso = iso(hoy);
  const hace = (dias: number) => iso(new Date(hoy.getTime() - dias * DIA));

  // Ritmo: últimos 28 días (4 semanas enteras) y última semana, pasados a "al mes".
  const ult28 = leads.filter((l) => l.fecha > hace(28) && l.fecha <= hoyIso);
  const ult7 = leads.filter((l) => l.fecha > hace(7) && l.fecha <= hoyIso);
  const ritmoMes = (ult28.length * MES) / 28;
  const ritmoSemana = (ult7.length * MES) / 7;
  const origen28 = Object.entries(tramo('', ult28).porOrigen).sort((a, b) => b[1] - a[1]);

  // Cuántos firman: de los leads ya decididos (firmados o perdidos), sin contar los que siguen abiertos.
  const firmados = leads.filter((l) => l.estado === 'firmado').length;
  const perdidos = leads.filter((l) => l.estado === 'perdido').length;
  const conversion = firmados + perdidos > 0 ? firmados / (firmados + perdidos) : null;

  // Cuánto se tarda en cobrar: de la entrada del lead a la última actividad de los ya cobrados.
  const cobrados = radar.filter((c) => c.etapa === 'Cobrado' && c.ultimaActividad);
  const mesesCobroMedido = cobrados.length
    ? suma(cobrados.map((c) => (dia(c.ultimaActividad!).getTime() - dia(fechaEntrada(c)).getTime()) / DIA / MES)) / cobrados.length
    : null;

  // Google Ads: cuánto cuesta cada lead de Google con el presupuesto de ahora. Solo cuenta los
  // días en que ya se pagaba ese importe (`desde`), como mucho 28; con menos de 7 no se mide.
  const ads = f.fijos.find((x) => x.tipo === 'publicidad');
  let google: { dias: number; leads: number; alMes: number; costeLead: number | null } | null = null;
  if (ads) {
    const inicio = ads.desde && ads.desde > hace(28) ? ads.desde : hace(28);
    const dias = Math.round((dia(hoyIso).getTime() - dia(inicio).getTime()) / DIA);
    const n = leads.filter((l) => l.origen === 'Google Ads' && l.fecha >= inicio && l.fecha <= hoyIso).length;
    if (dias >= 7) {
      const alMes = (n * MES) / dias;
      google = { dias, leads: n, alMes, costeLead: n > 0 ? ads.importe / alMes : null };
    }
  }

  // Serie por meses: desde el primer mes con leads o con contabilidad hasta el mes en curso.
  const ymHoy = hoyIso.slice(0, 7);
  const primero = [f.meses[0]?.mes, ...leads.map((l) => l.fecha.slice(0, 7))].filter(Boolean).sort()[0] ?? ymHoy;
  const meses: Tramo[] = [];
  for (let m = primero; m <= ymHoy; m = sumarMeses(m, 1)) {
    meses.push(tramo(m, leads.filter((l) => l.fecha.startsWith(m))));
  }

  // Serie por semanas (de lunes a domingo): las 12 últimas.
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const semanas: Tramo[] = [];
  for (let k = 11; k >= 0; k--) {
    const ini = new Date(lunes);
    ini.setDate(lunes.getDate() - 7 * k);
    const fin = new Date(ini);
    fin.setDate(ini.getDate() + 7);
    const a = iso(ini), b = iso(fin);
    semanas.push(tramo(a, leads.filter((l) => l.fecha >= a && l.fecha < b)));
  }

  return {
    total: leads.length, ult28: ult28.length, ult7: ult7.length, ritmoMes, ritmoSemana, origen28,
    firmados, perdidos, abiertos: leads.length - firmados - perdidos, conversion,
    cobrados: cobrados.length, mesesCobroMedido,
    google, meses, semanas,
  };
}

export type Medicion = ReturnType<typeof medir>;

// ─── Proyección ───────────────────────────────────────────────────────────────

export interface Supuestos {
  leadsMes: number;
  /** De cada lead, la parte que firma (0-1). */
  firman: number;
  /** De cada pasajero reclamado, la parte que acaba cobrando (0-1). */
  cobran: number;
  /** Meses desde que entra el lead hasta que se cobra. */
  mesesCobro: number;
}

export interface Base {
  radar: RadarCaso[];
  /** Gasto de cada mes: fijos + publicidad de ahora. */
  fijoMes: number;
  comisionMedia: number;
  /** Burofax y cartas por pasajero reclamado. */
  costePorPasajero: number;
  /** Resultado del año hasta hoy (lo invertido, si es negativo). */
  resultadoHoy: number;
}

export interface MesPrevisto {
  mes: string;
  leads: number;
  firman: number;
  cobran: number;
  /** De esos cobros, los que vienen de casos que ya están en marcha hoy. */
  cobranEnMarcha: number;
  ingresos: number;
  gastos: number;
  resultado: number;
  acumulado: number;
}

/** Los próximos `n` meses, empezando el mes que viene. */
export function proyectar(s: Supuestos, b: Base, hoy = new Date(), n = 12) {
  const ymHoy = iso(hoy).slice(0, 7);
  const M = Math.max(1, Math.round(s.mesesCobro));
  const filas: MesPrevisto[] = Array.from({ length: n }, (_, i) => ({
    mes: sumarMeses(ymHoy, i + 1), leads: 0, firman: 0, cobran: 0, cobranEnMarcha: 0, ingresos: 0, gastos: b.fijoMes, resultado: 0, acumulado: 0,
  }));
  // Un cobro no llega el mes exacto: se reparte entre el mes previsto (la mitad) y el de antes y
  // el de después (un cuarto cada uno). Si no, salen meses a 0 € que solo son un efecto del cálculo.
  const cobrar = (k: number, pasajeros: number, comision: number, enMarcha: boolean) => {
    const reparto: [number, number][] = k <= 1 ? [[1, 0.75], [2, 0.25]] : [[k - 1, 0.25], [k, 0.5], [k + 1, 0.25]];
    reparto.forEach(([j, parte]) => {
      if (j < 1 || j > n) return;
      filas[j - 1].cobran += pasajeros * parte;
      filas[j - 1].ingresos += pasajeros * parte * comision;
      if (enMarcha) filas[j - 1].cobranEnMarcha += pasajeros * parte;
    });
  };
  const comisionDe = (c: RadarCaso) => ((c.compensacionEur ?? 0) > 0 ? c.compensacionEur! * COMISION : b.comisionMedia);

  b.radar.filter((c) => !c.cerrado).forEach((c) => {
    const edad = (hoy.getTime() - dia(fechaEntrada(c)).getTime()) / DIA / MES;
    if (estadoDe(c) === 'firmado') {
      // Ya reclamando: cobra cuando cumpla los meses de cobro; si ya los ha pasado, va a juicio o
      // tarda más, y se le da la mitad del plazo otra vez.
      const resta = edad < M ? M - edad : M / 2;
      cobrar(Math.max(1, Math.round(resta)), s.cobran, comisionDe(c), true);
    } else {
      // Lead abierto: firma ahora (o no) y se reclama a partir del mes que viene.
      filas[0].firman += s.firman;
      filas[0].gastos += s.firman * b.costePorPasajero;
      cobrar(M, s.firman * s.cobran, comisionDe(c), true);
    }
  });

  // Leads nuevos de cada mes: firman ese mes (y se paga su burofax) y cobran M meses después.
  filas.forEach((x, i) => {
    const firman = s.leadsMes * s.firman;
    x.leads += s.leadsMes;
    x.firman += firman;
    x.gastos += firman * b.costePorPasajero;
    cobrar(i + 1 + M, firman * s.cobran, b.comisionMedia, false);
  });

  let acumulado = b.resultadoHoy;
  filas.forEach((x) => {
    x.resultado = x.ingresos - x.gastos;
    acumulado += x.resultado;
    x.acumulado = acumulado;
  });

  // Lo que deja cada lead cuando ya ha cobrado: firma, cobra y paga su burofax.
  const valorLead = s.firman * (s.cobran * b.comisionMedia - b.costePorPasajero);
  const leadsEquilibrio = valorLead > 0 ? Math.ceil(b.fijoMes / valorLead) : null;
  // Desde qué mes se cubren los gastos todos los meses (no solo uno suelto).
  const idxCubre = filas.findIndex((_, i) => filas.slice(i).every((x) => x.ingresos >= x.gastos));
  const idxRecupera = filas.findIndex((x) => x.acumulado >= 0);

  return {
    filas,
    total: {
      leads: suma(filas.map((x) => x.leads)),
      firman: suma(filas.map((x) => x.firman)),
      cobran: suma(filas.map((x) => x.cobran)),
      ingresos: suma(filas.map((x) => x.ingresos)),
      gastos: suma(filas.map((x) => x.gastos)),
      resultado: suma(filas.map((x) => x.resultado)),
    },
    valorLead, leadsEquilibrio,
    mesCubre: idxCubre >= 0 ? filas[idxCubre].mes : null,
    mesRecupera: b.resultadoHoy >= 0 ? null : idxRecupera >= 0 ? filas[idxRecupera].mes : null,
    final: acumulado,
  };
}
