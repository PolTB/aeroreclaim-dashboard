'use client';

import { useMemo, useState } from 'react';
import { ShieldAlert, TrendingDown, TrendingUp, PiggyBank, ChevronDown, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import type { RadarCaso } from '@/lib/notionRadar';
import {
  calcularFinanzas, euros, mesCorto, mesLargo, CATEGORIA_LLANA, type FinanzasSnapshot,
} from '@/lib/finanzas';

// ─── Finanzas ─────────────────────────────────────────────────────────────────
// Pensada para quien no vive entre números: cada bloque responde a una sola
// pregunta y la responde con una cifra y una frase. Nada de balances ni
// cuentas contables. Las cifras van sin IVA (el IVA es de Hacienda).
//  1. ¿Cómo vamos?          → entra, sale y resultado del año
//  2. ¿Cuándo ganamos?      → pasajeros cobrados al mes para cubrir gastos
//  3. ¿Qué viene?           → casos en marcha y cómo acabaría el año
//  4. ¿Cómo evoluciona?     → mes a mes y facturación media
//  5. ¿En qué se va?        → gastos por tipo

const conSigno = (n: number) => (n > 0 ? `+${euros(n)}` : euros(n));
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

function Tarjeta({ titulo, subtitulo, children, className }: {
  titulo: string; subtitulo?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={clsx('bg-surface-card border border-edge/70 rounded-2xl p-4 sm:p-5 shadow-card', className)}>
      <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
      {subtitulo && <p className="text-[11px] text-ink-muted mt-0.5">{subtitulo}</p>}
      {children}
    </section>
  );
}

// ─── 1. Cómo vamos ────────────────────────────────────────────────────────────

function Cifra({ etiqueta, valor, nota, serie }: {
  etiqueta: string; valor: string; nota: React.ReactNode; serie?: 'entra' | 'sale';
}) {
  return (
    <div className="bg-surface-elevated/60 border border-edge/60 rounded-xl px-3 py-2.5 min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        {serie && <span className={clsx('w-2 h-2 rounded-sm shrink-0', serie === 'entra' ? 'bg-serie-entra' : 'bg-serie-sale')} />}
        {etiqueta}
      </p>
      <p className="text-lg sm:text-2xl font-bold text-ink tabular-nums mt-0.5 truncate">{valor}</p>
      <div className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5">{nota}</div>
    </div>
  );
}

function ComoVamos({ f, c }: { f: FinanzasSnapshot; c: ReturnType<typeof calcularFinanzas> }) {
  const desde = mesLargo(f.meses[0]?.mes ?? '2026-01');
  const gana = c.resultado >= 0;
  const hucha = f.impuestos.iva + f.impuestos.irpf;
  return (
    <Tarjeta titulo={`Cómo vamos en ${f.ejercicio}`} subtitulo={`Desde ${desde}, sin IVA`}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
        <Cifra etiqueta="Ha entrado" valor={euros(c.ingresos)} nota="comisiones cobradas" serie="entra" />
        <Cifra etiqueta="Ha salido" valor={euros(c.gastos)} nota="gastos del negocio" serie="sale" />
        <Cifra
          etiqueta="Resultado"
          valor={conSigno(c.resultado)}
          nota={
            <span className={clsx('inline-flex items-center gap-1 font-medium', gana ? 'text-success' : 'text-danger')}>
              {gana ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {gana ? 'ganas' : 'pierdes'}
            </span>
          }
        />
      </div>
      <p className="text-sm text-ink-secondary mt-3 leading-relaxed">
        {gana
          ? <>Desde {desde} el negocio ha ganado <b className="text-ink">{euros(c.resultado)}</b>.</>
          : <>Desde {desde} el negocio ha gastado <b className="text-ink">{euros(-c.resultado)}</b> más de lo que ha ingresado. Es lo que llevas invertido.</>}
      </p>
      {(hucha > 0 || f.dinero_clientes > 0) && (
        <div className="flex items-start gap-2 mt-3 p-2.5 rounded-xl bg-surface-elevated/60 border border-edge/60 text-xs text-ink-secondary leading-relaxed">
          <PiggyBank size={14} className="mt-0.5 shrink-0 text-ink-muted" />
          <div>
            {hucha > 0 && (
              <p>
                Aparta <b className="text-ink">{euros(hucha)}</b> para Hacienda
                {f.impuestos.plazo && <> (se paga hasta el {fechaCorta(f.impuestos.plazo)})</>}: es el IVA
                {f.impuestos.irpf > 0 && ' y el IRPF'} de este trimestre, no es tuyo. Cifra orientativa: la calcula la gestoría.
              </p>
            )}
            {f.dinero_clientes > 0 && (
              <p className={clsx(hucha > 0 && 'mt-1')}>
                En la cuenta hay <b className="text-ink">{euros(f.dinero_clientes)}</b> de clientes: hay que transferírselos.
              </p>
            )}
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

// ─── 2. Para no perder dinero ─────────────────────────────────────────────────

function ParaNoPerder({ f, c }: { f: FinanzasSnapshot; c: ReturnType<typeof calcularFinanzas> }) {
  const [simulados, setSimulados] = useState(10);
  if (!c.equilibrio || !c.comisionMedia) {
    return (
      <Tarjeta titulo="Para no perder dinero">
        <p className="text-sm text-ink-secondary mt-2">Faltan casos con importe en el Radar para calcularlo.</p>
      </Tarjeta>
    );
  }
  const puntos = Math.max(c.equilibrio, c.cobradosMes);
  const alMes = simulados * c.comisionMedia - c.fijoMes;
  return (
    <Tarjeta titulo="Para no perder dinero">
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-ink tabular-nums">{c.equilibrio}</span>
        <span className="text-sm text-ink-secondary">pasajeros cobrados al mes</span>
      </p>
      <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
        Cada mes el negocio cuesta unos <b className="text-ink">{euros(c.fijoMes)}</b>. Cada pasajero cobrado
        deja de media <b className="text-ink">{euros(c.comisionMedia)}</b> (el 25 % de su compensación).
      </p>

      <div className="mt-3">
        <div className="flex flex-wrap gap-1.5" aria-hidden>
          {Array.from({ length: puntos }, (_, i) => (
            <span
              key={i}
              className={clsx('w-4 h-4 rounded-full', i < c.cobradosMes ? 'bg-success' : 'border-2 border-edge-bright')}
            />
          ))}
        </div>
        <p className="text-xs text-ink-secondary mt-1.5">
          Este mes llevas <b className="text-ink">{c.cobradosMes} de {c.equilibrio}</b>
          {c.cobradosMes >= c.equilibrio ? ': este mes ya cubres gastos.' : '.'}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-edge/50">
        <label htmlFor="simulador" className="text-xs text-ink-secondary">
          Prueba: si cobras <b className="text-ink tabular-nums">{simulados}</b> {simulados === 1 ? 'pasajero' : 'pasajeros'} al mes
        </label>
        <input
          id="simulador"
          type="range"
          min={0}
          max={20}
          value={simulados}
          onChange={(e) => setSimulados(Number(e.target.value))}
          className="w-full mt-2 accent-[rgb(var(--accent))]"
        />
        <p className="text-sm mt-1">
          {Math.abs(alMes) < 5 ? (
            <span className="text-ink">quedas a cero.</span>
          ) : alMes > 0 ? (
            <span className="text-ink">ganas unos <b className="text-success">{euros(alMes)} al mes</b> ({euros(alMes * 12)} al año).</span>
          ) : (
            <span className="text-ink">pierdes unos <b className="text-danger">{euros(-alMes)} al mes</b>.</span>
          )}
        </p>
      </div>

      <details className="group mt-3 pt-3 border-t border-edge/50">
        <summary className="flex items-center gap-1 text-xs text-ink-muted cursor-pointer list-none hover:text-ink">
          <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
          Qué pagas cada mes
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {[...f.fijos].sort((a, b) => b.importe - a.importe).map((x) => (
            <li key={x.nombre} className="flex justify-between text-xs">
              <span className="text-ink-secondary">{x.nombre}</span>
              <span className="text-ink tabular-nums">{euros(x.importe)}</span>
            </li>
          ))}
          <li className="flex justify-between text-xs font-semibold pt-1 mt-0.5 border-t border-edge/50">
            <span className="text-ink">Total</span>
            <span className="text-ink tabular-nums">{euros(c.fijoMes)}</span>
          </li>
        </ul>
      </details>
    </Tarjeta>
  );
}

// ─── 3. Lo que viene ──────────────────────────────────────────────────────────

// El cero se coloca donde toque: si todo es pérdida, a la derecha del todo, y
// las barras usan el ancho entero en vez de media tarjeta vacía.
function BarraCero({ etiqueta, valor, lo, hi }: { etiqueta: string; valor: number; lo: number; hi: number }) {
  const rango = hi - lo || 1;
  const cero = (-lo / rango) * 100;
  const ancho = Math.max(0.5, (Math.abs(valor) / rango) * 100);
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-ink-secondary">{etiqueta}</span>
        <span className="text-ink font-semibold tabular-nums shrink-0">{conSigno(valor)}</span>
      </div>
      <div className="relative h-2.5 mt-1">
        <span
          className={clsx('absolute top-0 bottom-0', valor < 0 ? 'bg-serie-sale rounded-l' : 'bg-serie-entra rounded-r')}
          style={valor < 0 ? { right: `${100 - cero}%`, width: `${ancho}%` } : { left: `${cero}%`, width: `${ancho}%` }}
        />
        <span className="absolute -top-1 -bottom-1 w-0.5 bg-ink-muted" style={{ left: `calc(${cero}% - 1px)` }} />
      </div>
    </div>
  );
}

function LoQueViene({ c, hayRadar }: { c: ReturnType<typeof calcularFinanzas>; hayRadar: boolean }) {
  const filas = [
    { etiqueta: 'Hoy', valor: c.resultado },
    { etiqueta: 'A 31/12, si no se cobra nada más', valor: c.finSinNada },
    { etiqueta: 'A 31/12, si se cobra todo lo que está en marcha', valor: c.finConMarcha },
  ];
  const lo = Math.min(0, ...filas.map((x) => x.valor));
  const hi = Math.max(0, ...filas.map((x) => x.valor));
  const meses = c.mesesCubiertos.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return (
    <Tarjeta titulo="Lo que viene" subtitulo="Casos del Radar en directo">
      {!hayRadar ? (
        <p className="text-sm text-ink-secondary mt-2">No se ha podido leer el Radar de Casos.</p>
      ) : (
        <>
          <p className="text-sm text-ink-secondary mt-2 leading-relaxed">
            En marcha: <b className="text-ink">{plural(c.enMarcha, 'pasajero', 'pasajeros')}</b> que dejarían{' '}
            <b className="text-ink">{euros(c.comisionEnMarcha)}</b> de comisión si se cobran.
            {c.comisionEnMarcha > 0 && <> Eso paga unos <b className="text-ink">{meses} meses</b> de gastos.</>}
          </p>
          {c.porEtapa.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.porEtapa.map((e) => (
                <span key={e.etapa} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated border border-edge/60 text-ink-secondary">
                  {e.etapa}: {e.pasajeros} · {euros(e.comision)}
                </span>
              ))}
              {c.leads > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-edge-bright text-ink-muted">
                  y {plural(c.leads, 'lead', 'leads')} por confirmar
                </span>
              )}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-edge/50 flex flex-col gap-3">
            <p className="text-[11px] text-ink-muted">
              Cómo acabaría el año (aprox.). La raya es el cero: a su izquierda, pierdes; a su derecha, ganas.
            </p>
            {filas.map((x) => <BarraCero key={x.etiqueta} {...x} lo={lo} hi={hi} />)}
          </div>

          <p className="text-sm text-ink mt-4 leading-relaxed">
            {c.finConMarcha >= 0
              ? <>Si se cobra lo que está en marcha, el año acaba ganando <b>{euros(c.finConMarcha)}</b>.</>
              : <>Para acabar el año a cero harían falta unos <b>{plural(c.pasajerosParaCero, 'pasajero cobrado', 'pasajeros cobrados')}</b> más, aparte de los que ya están en marcha.</>}
          </p>
        </>
      )}
    </Tarjeta>
  );
}

// ─── 4. Mes a mes ─────────────────────────────────────────────────────────────

function MesAMes({ f, media }: { f: FinanzasSnapshot; media: number }) {
  const ultimo = f.meses[f.meses.length - 1]?.mes;
  const [sel, setSel] = useState(ultimo);
  const max = Math.max(1, ...f.meses.flatMap((m) => [m.ingresos, m.gastos]));
  const m = f.meses.find((x) => x.mes === sel) ?? f.meses[f.meses.length - 1];
  const alto = (v: number) => (v > 0 ? `${Math.max(2, (v / max) * 100)}%` : '0');
  return (
    <Tarjeta titulo="Mes a mes">
      <div className="flex items-end justify-between gap-3 mt-2">
        <div>
          <p className="text-[11px] text-ink-muted">Facturación media (últimos 3 meses)</p>
          <p className="text-xl font-bold text-ink tabular-nums">{euros(media)} <span className="text-xs font-normal text-ink-muted">al mes</span></p>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[11px] text-ink-secondary">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-serie-entra" />Entra</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-serie-sale" />Sale</span>
        </div>
      </div>

      {m && (
        <p className="text-xs text-ink-secondary mt-3 h-4">
          <span className="capitalize text-ink font-medium">{mesLargo(m.mes)}</span>: entró <b className="text-ink">{euros(m.ingresos)}</b>, salió <b className="text-ink">{euros(m.gastos)}</b>
          {m.cobrados > 0 && <> ({plural(m.cobrados, 'pasajero cobrado', 'pasajeros cobrados')})</>}
        </p>
      )}

      <div className="flex items-stretch gap-1 sm:gap-1.5 h-36 mt-2 border-b border-edge-bright">
        {f.meses.map((x) => (
          <button
            key={x.mes}
            type="button"
            onMouseEnter={() => setSel(x.mes)}
            onFocus={() => setSel(x.mes)}
            onClick={() => setSel(x.mes)}
            aria-label={`${mesLargo(x.mes)}: entró ${euros(x.ingresos)}, salió ${euros(x.gastos)}`}
            className={clsx('flex-1 flex items-end justify-center gap-0.5 rounded-t-md px-0.5', x.mes === sel && 'bg-surface-hover')}
          >
            <span className="w-2.5 sm:w-3.5 bg-serie-entra rounded-t" style={{ height: alto(x.ingresos) }} />
            <span className="w-2.5 sm:w-3.5 bg-serie-sale rounded-t" style={{ height: alto(x.gastos) }} />
          </button>
        ))}
      </div>
      <div className="flex gap-1 sm:gap-1.5 mt-1">
        {f.meses.map((x) => (
          <span key={x.mes} className={clsx('flex-1 text-center text-[10px]', x.mes === sel ? 'text-ink font-semibold' : 'text-ink-muted')}>
            {mesCorto(x.mes)}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-ink-muted mt-2">El mes en curso va incompleto: algunas facturas llegan a final de mes.</p>
    </Tarjeta>
  );
}

// ─── 5. En qué se va el dinero ────────────────────────────────────────────────

function EnQueSeVa({ f }: { f: FinanzasSnapshot }) {
  const total = f.categorias.reduce((s, x) => s + x.importe, 0);
  const max = Math.max(1, ...f.categorias.map((x) => x.importe));
  return (
    <Tarjeta titulo="En qué se va el dinero" subtitulo={`Desde ${mesLargo(f.meses[0]?.mes ?? '2026-01')}, sin IVA`}>
      <ul className="flex flex-col gap-3 mt-3">
        {f.categorias.map((x) => (
          <li key={x.nombre}>
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-ink-secondary">{CATEGORIA_LLANA[x.nombre] ?? x.nombre}</span>
              <span className="text-ink tabular-nums shrink-0">
                <b>{euros(x.importe)}</b> <span className="text-ink-muted">· {Math.round((x.importe / total) * 100)} %</span>
              </span>
            </div>
            <div className="h-2 mt-1 rounded-r bg-serie-sale" style={{ width: `${Math.max(1, (x.importe / max) * 100)}%` }} />
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function FinanzasPanel({ finanzas, radar, error, radarError, loading }: {
  finanzas: FinanzasSnapshot | null;
  radar: RadarCaso[];
  error?: string;
  radarError?: string;
  loading: boolean;
}) {
  const c = useMemo(() => (finanzas ? calcularFinanzas(finanzas, radar) : null), [finanzas, radar]);

  if (error && !finanzas) {
    return (
      <div className="flex items-start gap-2.5 p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">No se han podido leer los números de la contabilidad</p>
          <p className="text-xs mt-0.5 opacity-80">{error}</p>
        </div>
      </div>
    );
  }
  if (loading || !finanzas || !c) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-surface-card border border-edge/70 rounded-2xl animate-pulse-soft" />
        ))}
      </div>
    );
  }

  const dias = (Date.now() - new Date(finanzas.generado).getTime()) / 86400000;
  return (
    <div className="flex flex-col gap-4">
      {dias > 40 && (
        <div className="flex items-start gap-2.5 p-3 bg-warn/10 border border-warn/25 rounded-xl text-xs text-ink-secondary">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warn" />
          Los números de la contabilidad son del {fechaCorta(finanzas.generado)}: puede faltar lo último.
        </div>
      )}
      <ComoVamos f={finanzas} c={c} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ParaNoPerder f={finanzas} c={c} />
        <LoQueViene c={c} hayRadar={!radarError || radar.length > 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MesAMes f={finanzas} media={c.mediaMensual} />
        <EnQueSeVa f={finanzas} />
      </div>
      <p className="text-[10px] text-ink-muted text-center">
        Contabilidad del {fechaCorta(finanzas.generado)} · casos del Radar en directo · cifras sin IVA y aproximadas: los impuestos los calcula la gestoría.
      </p>
    </div>
  );
}
