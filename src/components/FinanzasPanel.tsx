'use client';

import { useMemo, useState } from 'react';
import { ShieldAlert, TrendingDown, TrendingUp, PiggyBank, ChevronDown, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import type { RadarCaso } from '@/lib/notionRadar';
import {
  calcularFinanzas, euros, mesCorto, mesLargo, CATEGORIA_LLANA, TIPOS_GASTO, type FinanzasSnapshot, type TipoGasto,
} from '@/lib/finanzas';
import { medir } from '@/lib/prevision';
import { Tarjeta, Cifra, Opciones, conSigno } from './finanzasUi';
import { Prevision, Evolucion } from './FinanzasPrevision';

// ─── Finanzas ─────────────────────────────────────────────────────────────────
// Pensada para quien no vive entre números: cada bloque responde a una sola
// pregunta y la responde con una cifra y una frase. Nada de balances ni
// cuentas contables. Las cifras van sin IVA (el IVA es de Hacienda).
//  1. ¿Cómo vamos?          → entra, sale y resultado del año
//  2. ¿Qué pasará?          → previsión a 12 meses con mandos (FinanzasPrevision)
//  3. ¿Cómo evoluciona?     → leads, firmas, cobros y cuenta (FinanzasPrevision)
//  4. ¿Cuándo ganamos?      → pasajeros cobrados al mes para cubrir gastos
//  5. ¿Qué viene?           → casos en marcha y cómo acabaría el año
//  6. Mes a mes             → entra y sale cada mes
//  7. ¿En qué se va?        → cada mes o acumulado: fijos, publicidad, por caso y puntuales

// Un color por tipo de gasto (globals.css, validado para daltonismo); las clases
// viven aquí porque Tailwind no mira src/lib.
const COLOR_TIPO: Record<TipoGasto, string> = {
  fijo: 'bg-tipo-fijo', publicidad: 'bg-tipo-publicidad', caso: 'bg-tipo-caso', puntual: 'bg-tipo-puntual',
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ─── 1. Cómo vamos ────────────────────────────────────────────────────────────

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
        Cada mes se van unos <b className="text-ink">{euros(c.fijoMes)}</b>
        {c.publicidadMes > 0 && <> ({euros(c.fijoSinPublicidad)} de fijos y {euros(c.publicidadMes)} de publicidad)</>}; no cuentan
        los pagos de una sola vez. Cada pasajero cobrado deja de media <b className="text-ink">{euros(c.comisionMedia)}</b> (el
        25 % de su compensación).
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
            <>
              <span className="text-ink">ganas unos <b className="text-success">{euros(alMes)} al mes</b> ({euros(alMes * 12)} al año), antes de impuestos.</span>
              <span className="block text-[11px] text-ink-muted mt-0.5">De lo que ganes, aparta un 20 % para los pagos trimestrales del IRPF.</span>
            </>
          ) : (
            <span className="text-ink">pierdes unos <b className="text-danger">{euros(-alMes)} al mes</b>.</span>
          )}
        </p>
      </div>
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
        <p className="text-xs text-ink-secondary mt-3 min-h-4">
          <span className="capitalize text-ink font-medium">{mesLargo(m.mes)}</span>: entró <b className="text-ink">{euros(m.ingresos)}</b>, salió <b className="text-ink">{euros(m.gastos)}</b>
          {m.cobrados > 0 && <> ({plural(m.cobrados, 'pasajero cobrado', 'pasajeros cobrados')})</>}
        </p>
      )}
      {m?.por_tipo && m.gastos > 0 && (
        <p className="text-[11px] text-ink-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {TIPOS_GASTO.filter((t) => (m.por_tipo?.[t.key] ?? 0) > 0).map((t) => (
            <span key={t.key} className="inline-flex items-center gap-1">
              <span className={clsx('w-2 h-2 rounded-sm', COLOR_TIPO[t.key])} />
              {t.nombre.toLowerCase()} {euros(m.por_tipo![t.key])}
            </span>
          ))}
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

// ─── 5 bis. Fijos y variables ─────────────────────────────────────────────────
// Separa lo que se paga solo cada mes de lo que decide Pol (publicidad), de lo
// que solo aparece cuando hay un caso y de los pagos de una sola vez. Dos
// vistas: "Cada mes" (lo que cuesta hoy un mes normal) y "Desde marzo" (todo lo
// pagado, con cuántos pagos lleva cada cosa).

type Partida = { nombre: string; importe: number; nota?: string };

function FilaTipo({ tipo, nombre, importe, sufijo, explicacion, partidas }: {
  tipo: TipoGasto; nombre: string; importe: React.ReactNode; sufijo?: React.ReactNode;
  explicacion: React.ReactNode; partidas: Partida[];
}) {
  return (
    <li>
      <details className="group">
        <summary className="list-none cursor-pointer">
          <div className="flex justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-ink font-medium">
              <span className={clsx('w-2.5 h-2.5 rounded-sm shrink-0', COLOR_TIPO[tipo])} />
              {nombre}
              {partidas.length > 0 && <ChevronDown size={11} className="text-ink-muted transition-transform group-open:rotate-180" />}
            </span>
            <span className="text-ink tabular-nums shrink-0"><b>{importe}</b>{sufijo && <span className="text-ink-muted"> {sufijo}</span>}</span>
          </div>
          <p className="text-[11px] text-ink-secondary mt-0.5 ml-4 leading-relaxed">{explicacion}</p>
        </summary>
        {partidas.length > 0 && (
          <ul className="mt-1.5 ml-4 pl-2 border-l border-edge/60 flex flex-col gap-0.5">
            {partidas.map((x) => (
              <li key={x.nombre} className="flex justify-between gap-2 text-[11px]">
                <span className="text-ink-secondary">{x.nombre}{x.nota && <span className="text-ink-muted"> · {x.nota}</span>}</span>
                <span className="text-ink tabular-nums shrink-0">{euros(x.importe)}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

/** Barra apilada: cada tramo es un tipo de gasto, separados por 2 px de fondo. */
function BarraTipos({ tramos }: { tramos: { key: TipoGasto; nombre: string; importe: number }[] }) {
  const visibles = tramos.filter((t) => t.importe > 0);
  const total = visibles.reduce((s, x) => s + x.importe, 0) || 1;
  return (
    <div className="flex h-3 mt-3 gap-0.5" role="img" aria-label={visibles.map((t) => `${t.nombre}: ${euros(t.importe)}`).join(', ')}>
      {visibles.map((t, i) => (
        <span
          key={t.key}
          title={`${t.nombre}: ${euros(t.importe)} (${Math.round((t.importe / total) * 100)} %)`}
          className={clsx(COLOR_TIPO[t.key], i === 0 && 'rounded-l', i === visibles.length - 1 && 'rounded-r')}
          style={{ width: `${(t.importe / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function CadaMes({ f, c }: { f: FinanzasSnapshot; c: ReturnType<typeof calcularFinanzas> }) {
  const pagadas = new Set(f.tipos?.flatMap((t) => t.partidas.map((x) => x.nombre)) ?? []);
  const deTipo = (tipo: TipoGasto) => f.fijos
    .filter((x) => (x.tipo ?? 'fijo') === tipo)
    .sort((a, b) => b.importe - a.importe)
    .map((x) => ({ nombre: x.nombre, importe: x.importe, nota: pagadas.has(x.nombre) ? undefined : 'empieza ahora, aún sin pagar' }));
  // Burofax y cartas: media de los 3 últimos meses enteros (el mes en curso va a medias).
  const enteros = f.meses.slice(0, -1).slice(-3);
  const casoMes = enteros.length ? enteros.reduce((s, m) => s + (m.por_tipo?.caso ?? 0), 0) / enteros.length : 0;
  const puntual = f.tipos?.find((x) => x.tipo === 'puntual')?.importe ?? 0;
  const totalMes = c.fijoSinPublicidad + c.publicidadMes + casoMes;
  return (
    <>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-ink tabular-nums">{euros(totalMes)}</span>
        <span className="text-xs text-ink-secondary">en un mes normal</span>
      </p>
      <BarraTipos tramos={[
        { key: 'fijo', nombre: 'Fijos', importe: c.fijoSinPublicidad },
        { key: 'publicidad', nombre: 'Publicidad', importe: c.publicidadMes },
        { key: 'caso', nombre: 'Por caso', importe: casoMes },
      ]} />
      <ul className="flex flex-col gap-2.5 mt-4">
        <FilaTipo
          tipo="fijo" nombre="Fijos" importe={euros(c.fijoSinPublicidad)} sufijo="al mes" partidas={deTipo('fijo')}
          explicacion={<>Se pagan cada mes, haya casos o no.</>}
        />
        <FilaTipo
          tipo="publicidad" nombre="Publicidad" importe={euros(c.publicidadMes)} sufijo="al mes" partidas={deTipo('publicidad')}
          explicacion={<>Lo decides tú.{c.publicidadMes > 0 && <> Hoy son unos {euros(c.publicidadMes / 30.4)} al día.</>}</>}
        />
        <FilaTipo
          tipo="caso" nombre="Por caso" importe={euros(casoMes)} sufijo="al mes" partidas={[]}
          explicacion={<>Burofax y cartas: solo se gastan cuando hay un caso
            {c.costePorPasajero != null && <>, unos {euros(c.costePorPasajero)} por pasajero reclamado</>}. Es la media de los últimos 3 meses.</>}
        />
        <FilaTipo
          tipo="puntual" nombre="Puntuales" importe="no cada mes" partidas={[]}
          explicacion={<>Pagos de una sola vez, como las altas en Hacienda y la Seguridad Social: {euros(puntual)} desde {mesLargo(f.meses[0]?.mes ?? '2026-01')}. No se repiten.</>}
        />
      </ul>
    </>
  );
}

function Acumulado({ f, c }: { f: FinanzasSnapshot; c: ReturnType<typeof calcularFinanzas> }) {
  const tipos = TIPOS_GASTO.map((t) => ({ ...t, ...(f.tipos?.find((x) => x.tipo === t.key) ?? { importe: 0, partidas: [] }) }));
  const total = tipos.reduce((s, x) => s + x.importe, 0) || 1;
  const explicacion: Record<TipoGasto, React.ReactNode> = {
    fijo: <>Se pagan cada mes, haya casos o no.</>,
    publicidad: <>Lo decides tú: es lo que inviertes para conseguir clientes.</>,
    caso: <>Burofax y cartas: solo se gastan cuando hay un caso.</>,
    puntual: <>Pagos de una sola vez, como las altas en Hacienda y la Seguridad Social. No se repiten.</>,
  };
  return (
    <>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-ink tabular-nums">{euros(c.gastos)}</span>
        <span className="text-xs text-ink-secondary">pagados en total</span>
      </p>
      <BarraTipos tramos={tipos} />
      <ul className="flex flex-col gap-2.5 mt-4">
        {tipos.map((t) => (
          <FilaTipo
            key={t.key}
            tipo={t.key}
            nombre={t.nombre}
            importe={euros(t.importe)}
            sufijo={`· ${Math.round((t.importe / total) * 100)} %`}
            explicacion={explicacion[t.key]}
            partidas={t.partidas.map((x) => ({ nombre: x.nombre, importe: x.importe, nota: x.veces > 1 ? `${x.veces} pagos` : undefined }))}
          />
        ))}
      </ul>
    </>
  );
}

function FijosYVariables({ f, c }: { f: FinanzasSnapshot; c: ReturnType<typeof calcularFinanzas> }) {
  const [vista, setVista] = useState<'mes' | 'total'>('mes');
  const primero = f.meses[0]?.mes ?? '2026-01';
  return (
    <Tarjeta
      titulo="En qué se va el dinero"
      subtitulo={vista === 'mes' ? 'Lo que cuesta un mes con lo que pagas hoy, sin IVA' : `Todo lo pagado desde ${mesLargo(primero)}, sin IVA`}
      accion={
        <Opciones
          etiqueta="Cómo verlo"
          valor={vista}
          onChange={setVista}
          opciones={[{ key: 'mes', nombre: 'Cada mes' }, { key: 'total', nombre: `Desde ${mesLargo(primero)}` }]}
        />
      }
    >
      {vista === 'mes' ? <CadaMes f={f} c={c} /> : <Acumulado f={f} c={c} />}

      {c.quedaPorPasajero != null && c.comisionMedia != null && c.costePorPasajero != null && (
        <p className="text-xs text-ink-secondary mt-4 pt-3 border-t border-edge/50 leading-relaxed">
          De cada pasajero cobrado te quedan unos <b className="text-ink">{euros(c.quedaPorPasajero)}</b>: su comisión
          ({euros(c.comisionMedia)} de media) menos lo que cuesta reclamarlo ({euros(c.costePorPasajero)}). Con eso se pagan los fijos.
        </p>
      )}
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
  const m = useMemo(() => (finanzas ? medir(radar, finanzas) : null), [finanzas, radar]);

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
  if (loading || !finanzas || !c || !m) {
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
      <Prevision c={c} radar={radar} m={m} />
      <Evolucion f={finanzas} m={m} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ParaNoPerder f={finanzas} c={c} />
        <LoQueViene c={c} hayRadar={!radarError || radar.length > 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MesAMes f={finanzas} media={c.mediaMensual} />
        {finanzas.tipos ? <FijosYVariables f={finanzas} c={c} /> : <EnQueSeVa f={finanzas} />}
      </div>
      <p className="text-[10px] text-ink-muted text-center">
        Contabilidad del {fechaCorta(finanzas.generado)} · casos del Radar en directo · cifras sin IVA y aproximadas: los impuestos los calcula la gestoría.
      </p>
    </div>
  );
}
