'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { RotateCcw } from 'lucide-react';
import type { RadarCaso } from '@/lib/notionRadar';
import { euros, mesCorto, mesLargo, type CalculoFinanzas, type FinanzasSnapshot } from '@/lib/finanzas';
import { proyectar, type Medicion, type Tramo } from '@/lib/prevision';
import { Tarjeta, Cifra, Columnas, BarraCeroVertical, Opciones, conSigno, posicionCero } from './finanzasUi';

// ─── Previsión y evolución ────────────────────────────────────────────────────
// Para quien no vive entre números: los mandos arrancan con lo medido en el
// Radar (o con un supuesto prudente, y lo dice) y cada resultado sale en una
// frase. Cuatro mandos, no más: leads al mes, cuántos firman, cuántos cobran y
// cuánto se tarda en cobrar.

const mesConAño = (ym: string) => `${mesLargo(ym)} de ${ym.slice(0, 4)}`;
const entero = (x: number) => Math.round(x).toLocaleString('de-DE');
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${Math.round(n) === 1 ? uno : varios}`;
/** Cifras previstas (medias): con un decimal si son pequeñas, para que cuadren con los euros. */
const aprox = (x: number) => (x >= 10 ? entero(x) : x.toLocaleString('de-DE', { maximumFractionDigits: 1 }));
const diaMes = (dia: string) => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`;
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const listaOrigenes = (o: Record<string, number>) =>
  Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');

function Mando({ id, etiqueta, valor, texto, min, max, onChange, pista }: {
  id: string; etiqueta: string; valor: number; texto: string; min: number; max: number;
  onChange: (v: number) => void; pista: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-ink-secondary">{etiqueta}</label>
        <span className="text-sm font-bold text-ink tabular-nums shrink-0">{texto}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 accent-[rgb(var(--accent))]"
      />
      <p className="text-[10px] text-ink-muted leading-snug">{pista}</p>
    </div>
  );
}

// ─── Previsión ────────────────────────────────────────────────────────────────

/** Valores de los mandos; "firman" y "cobran" van de 0 a 10 ("de cada 10"). */
interface Mandos { leads: number; firman: number; cobran: number; meses: number }

export function Prevision({ c, radar, m, fijos }: {
  c: CalculoFinanzas; radar: RadarCaso[]; m: Medicion; fijos: FinanzasSnapshot['fijos'];
}) {
  // Por defecto, lo más parecido a la realidad: lo medido, contando también lo que aún no ha
  // acabado (leads que ya no firmarán, casos que llevan meses sin cobrar).
  const inicial = useMemo<Mandos>(() => ({
    leads: Math.round(m.ritmoMes),
    firman: m.conversionReal != null ? Math.round(m.conversionReal * 10) : 5,
    cobran: 7, // supuesto prudente hasta que haya casos cerrados para medirlo
    meses: m.mesesCobroReal != null ? Math.min(12, Math.max(3, Math.round(m.mesesCobroReal))) : 6,
  }), [m]);
  // Mientras Pol no toque nada, los mandos siguen a los datos (que se refrescan solos).
  const [tocado, setTocado] = useState<Mandos | null>(null);
  const v = tocado ?? inicial;
  const cambia = (k: keyof Mandos) => (x: number) => setTocado({ ...v, [k]: x });
  const [sel, setSel] = useState(0);
  const [selAc, setSelAc] = useState(0);

  const p = useMemo(() => (c.comisionMedia == null ? null : proyectar(
    { leadsMes: v.leads, firman: v.firman / 10, cobran: v.cobran / 10, mesesCobro: v.meses },
    { radar, fijoMes: c.fijoMes, comisionMedia: c.comisionMedia, costePorPasajero: c.costePorPasajero ?? 0, resultadoHoy: c.resultado },
  )), [v, radar, c]);

  if (!p || c.comisionMedia == null) {
    return (
      <Tarjeta titulo="Previsión">
        <p className="text-sm text-ink-secondary mt-2">Faltan casos con importe en el Radar para calcularla.</p>
      </Tarjeta>
    );
  }

  const filas = p.filas;
  const x = filas[Math.min(sel, filas.length - 1)];
  const max = Math.max(1, ...filas.flatMap((f) => [f.ingresos, f.gastos]));
  const alto = (n: number) => (n > 0 ? `${Math.max(2, (n / max) * 100)}%` : '0');
  const acumulados = [c.resultado, ...filas.map((f) => f.acumulado)];
  const ac = posicionCero(acumulados);
  const google = m.google;

  return (
    <Tarjeta
      titulo="Previsión de los próximos 12 meses"
      subtitulo={`De ${mesLargo(filas[0].mes)} a ${mesConAño(filas[filas.length - 1].mes)} · sin IVA y antes de impuestos`}
      accion={tocado && (
        <button
          type="button"
          onClick={() => setTocado(null)}
          className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink shrink-0"
        >
          <RotateCcw size={11} /> Volver a mis números
        </button>
      )}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] mt-3">
        {/* Mandos */}
        <div className="flex flex-col gap-3.5 lg:pr-5 lg:border-r border-edge/50">
          <p className="text-[11px] text-ink-muted leading-relaxed">
            Empiezan con tus números reales. Muévelos para ver qué pasaría.
          </p>
          <Mando
            id="prev-leads" etiqueta="Leads al mes" valor={v.leads} texto={entero(v.leads)} min={0} max={60}
            onChange={cambia('leads')}
            pista={<>
              Medido: {plural(m.ult28, 'lead', 'leads')} en las últimas 4 semanas.
              {m.ult7 > 0 && Math.round(m.ritmoSemana) > Math.round(m.ritmoMes) && <> La última semana, a ritmo de {entero(m.ritmoSemana)} al mes.</>}
            </>}
          />
          <Mando
            id="prev-firman" etiqueta="De cada 10 leads, firman" valor={v.firman} texto={`${v.firman} de 10`} min={0} max={10}
            onChange={cambia('firman')}
            pista={m.conversionReal != null
              ? <>Medido: firmaron {m.firmados} de {m.decididos} leads{m.abiertosViejos > 0 && <>, contando como perdidos los {m.abiertosViejos} que llevan más de 14 días sin contestar</>}.
                {m.abiertos - m.abiertosViejos > 0 && <> Otros {m.abiertos - m.abiertosViejos} aún están a tiempo.</>}</>
              : <>Supuesto: aún no hay leads decididos.</>}
          />
          <Mando
            id="prev-cobran" etiqueta="De cada 10 que firman, cobran" valor={v.cobran} texto={`${v.cobran} de 10`} min={0} max={10}
            onChange={cambia('cobran')}
            pista={<>Supuesto prudente: con {plural(m.cobrados, 'cobro', 'cobros')} hasta ahora aún no se puede medir.</>}
          />
          <Mando
            id="prev-meses" etiqueta="Meses hasta cobrar" valor={v.meses} texto={plural(v.meses, 'mes', 'meses')} min={1} max={12}
            onChange={cambia('meses')}
            pista={m.mesesCobroReal != null
              ? <>Medido. {m.cobrados > 0 && <>{m.cobrados === 1 ? 'El cobro de este año llegó' : `Los ${m.cobrados} cobros de este año llegaron`} a los {entero(m.mesesCobroMedido ?? 0)} meses de entrar el lead.</>}
                {m.esperando > 0 && <> {m.esperando === 1 ? 'Hay 1 caso firmado que lleva' : `Hay ${m.esperando} casos firmados que llevan`} hasta {entero(m.esperandoMax ?? 0)} meses sin cobrar, y también cuentan.</>}</>
              : <>Supuesto: aún no hay cobros para medirlo.</>}
          />
        </div>

        {/* Resultados */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Cifra etiqueta="Pasajeros cobrados" valor={entero(p.total.cobran)} nota="en 12 meses" />
            <Cifra etiqueta="Entra" valor={euros(p.total.ingresos)} nota="de comisión" serie="entra" />
            <Cifra etiqueta="Sale" valor={euros(p.total.gastos)} nota="fijos, anuncios y burofax" serie="sale" />
            <Cifra
              etiqueta="Resultado"
              valor={conSigno(p.total.resultado)}
              nota={<span className={clsx('font-medium', p.total.resultado >= 0 ? 'text-success' : 'text-danger')}>
                {p.total.resultado >= 0 ? 'ganas' : 'pierdes'}
              </span>}
            />
          </div>

          <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink-secondary leading-relaxed list-disc pl-4 marker:text-ink-faint">
            <li>
              Cada lead deja de media <b className="text-ink">{euros(p.valorLead)}</b>: firman {v.firman} de cada 10, cobran {v.cobran} de cada 10
              de esos, y cada cobro son {euros(c.comisionMedia)} de comisión menos {euros(c.costePorPasajero ?? 0)} de burofax.
            </li>
            <li>
              {p.leadsEquilibrio == null
                ? <>Con estos números ningún lead deja dinero.</>
                : v.leads >= p.leadsEquilibrio
                  ? <>Para cubrir los gastos de cada mes ({euros(c.fijoMes)}) hacen falta unos <b className="text-ink">{p.leadsEquilibrio} leads al mes</b>. Con {v.leads} los cubres{p.mesCubre ? <> a partir de <b className="text-ink">{mesConAño(p.mesCubre)}</b></> : <> cuando empiecen a cobrarse</>}.</>
                  : <>Para cubrir los gastos de cada mes ({euros(c.fijoMes)}) hacen falta unos <b className="text-ink">{p.leadsEquilibrio} leads al mes</b>. Con {v.leads} no llegas.</>}
            </li>
            {c.resultado < 0 && (
              <li>
                {p.mesRecupera
                  ? <>Lo invertido hasta hoy ({euros(-c.resultado)}) se recupera en <b className="text-ink">{mesConAño(p.mesRecupera)}</b>.</>
                  : <>En 12 meses no se recupera lo invertido: quedarían <b className="text-ink">{euros(-p.final)}</b> por recuperar.</>}
              </li>
            )}
            {google && (
              <li>
                {google.costeLead != null
                  ? <>Google Ads: con el presupuesto de ahora llegan unos {entero(google.alMes)} leads de Google al mes (medido en {google.dias} días),
                    a unos <b className="text-ink">{euros(google.costeLead)} cada uno</b>.{' '}
                    {google.costeLead < p.valorLead ? 'Cada lead deja más de lo que cuesta: la publicidad se paga sola.' : 'Hoy cada lead cuesta más de lo que deja.'}
                    {google.leads < 5 && <span className="text-ink-muted"> Aún son pocos datos.</span>}</>
                  : <>Google Ads: en los últimos {google.dias} días no ha llegado ningún lead marcado como de Google.</>}
              </li>
            )}
          </ul>

          {/* Mes a mes previsto */}
          <div className="mt-4 pt-3 border-t border-edge/50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-ink">Mes a mes</p>
              <div className="flex gap-3 text-[11px] text-ink-secondary">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-serie-entra" />Entra</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-serie-sale" />Sale</span>
              </div>
            </div>
            <p className="text-xs text-ink-secondary mt-1.5 min-h-8 leading-relaxed">
              <span className="text-ink font-medium">{mayuscula(mesConAño(x.mes))}</span>: entran {plural(x.leads, 'lead', 'leads')}, firman {aprox(x.firman)} y
              se cobran {aprox(x.cobran)} {x.cobran === 1 ? 'pasajero' : 'pasajeros'}
              {x.cobranEnMarcha > 0 && (x.cobranEnMarcha < x.cobran - 0.05
                ? <> ({aprox(x.cobranEnMarcha)} de casos que ya existen)</>
                : <>, todos de casos que ya existen</>)}.
              Entra <b className="text-ink">{euros(x.ingresos)}</b>. Sale <b className="text-ink">{euros(x.gastos)}</b>: {euros(x.gastoFijo)} de
              gastos fijos{x.gastoBurofax >= 1 && <> y {euros(x.gastoBurofax)} de burofax de los que firman ({euros(c.costePorPasajero ?? 0)} cada uno)</>}.
            </p>
            <Columnas
              n={filas.length} sel={sel} onSel={setSel}
              etiqueta={(i) => mesCorto(filas[i].mes)}
              aria={(i) => `${mesConAño(filas[i].mes)}: entra ${euros(filas[i].ingresos)}, sale ${euros(filas[i].gastos)}`}
              pinta={(i) => <>
                <span className="w-2 sm:w-3 bg-serie-entra rounded-t" style={{ height: alto(filas[i].ingresos) }} />
                <span className="w-2 sm:w-3 bg-serie-sale rounded-t" style={{ height: alto(filas[i].gastos) }} />
              </>}
            />
            <p className="text-[10px] text-ink-muted mt-1.5 leading-relaxed">
              Gastos fijos de cada mes ({euros(c.fijoMes)}):{' '}
              {[...fijos].sort((a, b) => b.importe - a.importe).map((g) => `${g.nombre} ${euros(g.importe)}`).join(' · ')}.
              {' '}Los primeros meses solo cobran los casos que ya están en marcha: un lead nuevo tarda {plural(v.meses, 'mes', 'meses')} en cobrarse.
            </p>
          </div>

          {/* Acumulado */}
          <div className="mt-4 pt-3 border-t border-edge/50">
            <p className="text-[11px] font-medium text-ink">Cuándo recuperas lo invertido</p>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
              Cada barra es todo lo ganado menos todo lo gastado desde enero de 2026, hasta final de ese mes.{' '}
              {c.resultado < 0
                ? <>Hoy llevas {euros(-c.resultado)} invertidos.</>
                : <>Hoy llevas {euros(c.resultado)} ganados.</>}
              {p.fondo && <> Mientras los gastos superen a los cobros la barra baja: lo peor llega en {mesConAño(p.fondo.mes)} ({conSigno(p.fondo.acumulado)}).</>}
              {c.resultado < 0 && (p.mesRecupera
                ? <> Después remonta y en <b className="text-ink">{mesConAño(p.mesRecupera)}</b> ya has recuperado todo.</>
                : <> En estos 12 meses no llega a recuperarse.</>)}
            </p>
            <p className="text-xs text-ink-secondary mt-1.5 min-h-4">
              {selAc === 0
                ? <><span className="text-ink font-medium">Hoy</span>: {conSigno(c.resultado)} ({c.resultado < 0 ? 'lo invertido hasta ahora' : 'lo ganado este año'}).</>
                : <>A final de <span className="text-ink font-medium">{mesConAño(filas[selAc - 1].mes)}</span>: <b className="text-ink">{conSigno(filas[selAc - 1].acumulado)}</b>.</>}
            </p>
            <Columnas
              n={acumulados.length} sel={selAc} onSel={setSelAc} cero={ac.cero} alto="h-24" etiquetaCorta
              etiqueta={(i) => (i === 0 ? 'Hoy' : mesCorto(filas[i - 1].mes))}
              aria={(i) => `${i === 0 ? 'Hoy' : mesConAño(filas[i - 1].mes)}: ${conSigno(acumulados[i])}`}
              pinta={(i) => <BarraCeroVertical valor={acumulados[i]} lo={ac.lo} hi={ac.hi} className={i === 0 ? 'opacity-60' : undefined} />}
            />
            <p className="text-[10px] text-ink-muted mt-1.5">Naranja, por debajo de la raya: aún no has recuperado lo invertido. Azul, por encima: ya lo has recuperado y ganas.</p>
          </div>
        </div>
      </div>
    </Tarjeta>
  );
}

// ─── Evolución ────────────────────────────────────────────────────────────────

type Metrica = 'leads' | 'firman' | 'cobrados' | 'cuenta';

const METRICAS: { key: Metrica; nombre: string }[] = [
  { key: 'leads', nombre: 'Leads' },
  { key: 'firman', nombre: 'Firman' },
  { key: 'cobrados', nombre: 'Cobrados' },
  { key: 'cuenta', nombre: 'Cuenta' },
];

export function Evolucion({ f, m }: { f: FinanzasSnapshot; m: Medicion }) {
  const [metrica, setMetrica] = useState<Metrica>('leads');
  const [grano, setGrano] = useState<'semanas' | 'meses'>('semanas');
  const [sel, setSel] = useState<number | null>(null);
  const porSemana = grano === 'semanas' && (metrica === 'leads' || metrica === 'firman');
  const tramos: Tramo[] = porSemana ? m.semanas : m.meses;

  const elige = (fn: () => void) => { fn(); setSel(null); };

  // Cuenta acumulada del año, mes a mes (lo que ha entrado menos lo que ha salido).
  const cuenta = useMemo(() => {
    let s = 0;
    return f.meses.map((x) => (s += x.ingresos - x.gastos));
  }, [f]);

  const n = metrica === 'cobrados' || metrica === 'cuenta' ? f.meses.length : tramos.length;
  const i = Math.min(sel ?? n - 1, n - 1);
  const nombreTramo = (t: Tramo) => (porSemana ? `Semana del ${diaMes(t.clave)}` : mayuscula(mesLargo(t.clave)));
  const etiqueta = (k: number) =>
    metrica === 'cobrados' || metrica === 'cuenta' ? mesCorto(f.meses[k].mes) : porSemana ? diaMes(tramos[k].clave) : mesCorto(tramos[k].clave);

  let cabecera: React.ReactNode;
  let detalle: React.ReactNode;
  let leyenda: React.ReactNode = null;
  let pinta: (k: number) => React.ReactNode;
  let aria: (k: number) => string;
  let cero: number | undefined;

  if (metrica === 'leads' || metrica === 'firman') {
    const max = Math.max(1, ...tramos.map((t) => t.leads));
    const pct = (v: number) => `${(v / max) * 100}%`;
    const t = tramos[i];
    if (metrica === 'leads') {
      cabecera = <>Últimas 4 semanas: <b className="text-ink">{plural(m.ult28, 'lead', 'leads')}</b>, unos {entero(m.ritmoMes)} al mes.
        {m.origen28.length > 0 && <span className="block text-ink-muted mt-0.5">De dónde: {listaOrigenes(Object.fromEntries(m.origen28))}</span>}</>;
      detalle = <><span className="text-ink font-medium">{nombreTramo(t)}</span>: {plural(t.leads, 'lead', 'leads')}{t.leads > 0 && <> ({listaOrigenes(t.porOrigen)})</>}</>;
      pinta = (k) => <span className="w-2.5 sm:w-4 bg-accent rounded-t" style={{ height: tramos[k].leads ? pct(tramos[k].leads) : 0 }} />;
      aria = (k) => `${nombreTramo(tramos[k])}: ${plural(tramos[k].leads, 'lead', 'leads')}`;
    } else {
      cabecera = m.conversion != null
        ? <>Firman <b className="text-ink">{Math.round(m.conversion * 10)} de cada 10</b> leads ({m.firmados} de {m.firmados + m.perdidos} ya decididos).</>
        : <>Aún no hay leads decididos.</>;
      detalle = t.leads === 0
        ? <><span className="text-ink font-medium">{nombreTramo(t)}</span>: no entró ningún lead.</>
        : <><span className="text-ink font-medium">{nombreTramo(t)}</span>: de {plural(t.leads, 'lead', 'leads')}, firmaron {t.firmados}
          {t.abiertos > 0 && <>, {t.abiertos} {t.abiertos === 1 ? 'sigue pendiente' : 'siguen pendientes'}</>}
          {t.perdidos > 0 && <> y {t.perdidos} {t.perdidos === 1 ? 'se perdió' : 'se perdieron'}</>}.</>;
      leyenda = <>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-accent" />Firmaron</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-accent/40" />Pendientes</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-edge-bright" />Perdidos</span>
      </>;
      // Columna apilada: firmados abajo, pendientes, perdidos arriba; 2 px de fondo entre tramos.
      pinta = (k) => {
        const tk = tramos[k];
        if (!tk.leads) return null;
        return (
          <span className="w-2.5 sm:w-4 flex flex-col-reverse gap-0.5" style={{ height: pct(tk.leads) }}>
            {[
              { v: tk.firmados, c: 'bg-accent' },
              { v: tk.abiertos, c: 'bg-accent/40' },
              { v: tk.perdidos, c: 'bg-edge-bright' },
            ].filter((s) => s.v > 0).map((s, j, arr) => (
              <span key={j} className={clsx(s.c, j === arr.length - 1 && 'rounded-t')} style={{ flexGrow: s.v, flexBasis: 0 }} />
            ))}
          </span>
        );
      };
      aria = (k) => `${nombreTramo(tramos[k])}: ${tramos[k].leads} leads, ${tramos[k].firmados} firmaron`;
    }
  } else if (metrica === 'cobrados') {
    const total = f.meses.reduce((s, x) => s + x.cobrados, 0);
    const max = Math.max(1, ...f.meses.map((x) => x.cobrados));
    const x = f.meses[i];
    cabecera = <>Este año: <b className="text-ink">{plural(total, 'pasajero cobrado', 'pasajeros cobrados')}</b>.</>;
    detalle = <><span className="text-ink font-medium">{mayuscula(mesLargo(x.mes))}</span>: {plural(x.cobrados, 'pasajero cobrado', 'pasajeros cobrados')}{x.cobrados > 0 && <>, {euros(x.ingresos)} de comisión</>}.</>;
    pinta = (k) => <span className="w-2.5 sm:w-4 bg-serie-entra rounded-t" style={{ height: f.meses[k].cobrados ? `${(f.meses[k].cobrados / max) * 100}%` : 0 }} />;
    aria = (k) => `${mesLargo(f.meses[k].mes)}: ${plural(f.meses[k].cobrados, 'pasajero cobrado', 'pasajeros cobrados')}`;
  } else {
    const z = posicionCero(cuenta);
    cero = z.cero;
    const ultimo = i === f.meses.length - 1;
    cabecera = <>Lo que ha entrado menos lo que ha salido desde {mesLargo(f.meses[0]?.mes ?? '2026-01')}, mes a mes.</>;
    detalle = <>A final de <span className="text-ink font-medium">{mesLargo(f.meses[i].mes)}</span>{ultimo && ' (va por la mitad)'}: <b className="text-ink">{conSigno(cuenta[i])}</b>.</>;
    pinta = (k) => <BarraCeroVertical valor={cuenta[k]} lo={z.lo} hi={z.hi} />;
    aria = (k) => `${mesLargo(f.meses[k].mes)}: ${conSigno(cuenta[k])}`;
    leyenda = <span>Por encima de la raya, ganas; por debajo, pierdes.</span>;
  }

  return (
    <Tarjeta titulo="Cómo evoluciona" subtitulo="Leads del Radar en directo; cobros y cuenta, de la contabilidad">
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <Opciones etiqueta="Qué ver" valor={metrica} opciones={METRICAS} onChange={(k) => elige(() => setMetrica(k))} />
        {(metrica === 'leads' || metrica === 'firman') && (
          <Opciones
            etiqueta="Agrupar por"
            valor={grano}
            opciones={[{ key: 'semanas', nombre: 'Semanas' }, { key: 'meses', nombre: 'Meses' }]}
            onChange={(k) => elige(() => setGrano(k))}
          />
        )}
      </div>
      <p className="text-xs text-ink-secondary mt-3 leading-relaxed">{cabecera}</p>
      <p className="text-xs text-ink-secondary mt-2 min-h-4">{detalle}</p>
      <Columnas n={n} sel={i} onSel={setSel} etiqueta={etiqueta} aria={aria} pinta={pinta} cero={cero} etiquetaCorta={n > 8} />
      {leyenda && <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-ink-secondary">{leyenda}</div>}
    </Tarjeta>
  );
}
