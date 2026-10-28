'use client';

import { useMemo, useState } from 'react';
import { Bot, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Inbox, Loader2, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BandejaEstado, BandejaTarea } from '@/lib/bandejaDb';
import { diasHasta, eur } from '@/lib/casos';
import { cuentaEnBandeja, esDelCeo, textoParaClaude } from '@/lib/tareasCeo';

// ─── Bandeja de Pol ───────────────────────────────────────────────────────────
// Una tarjeta por tarea, con lo justo para actuar sin abrir nada más:
//   · qué hacer, en una frase que empieza por verbo
//   · de qué caso y cuánto dinero hay en juego
//   · para cuándo, en lenguaje natural
//   · por qué importa y cómo hacerlo, paso a paso (desplegable)
// "Hecho" cambia el Estado de la fila en Notion: persiste en cualquier
// dispositivo y desaparece de la lista de pendientes.
// Las tareas del CEO (antes, AERs de la pestaña Delegaciones) llevan la
// etiqueta "Para el CEO" y un botón que copia el encargo para pegarlo en
// Claude. Con fecha van en la lista principal; sin fecha, en un grupo aparte.

function plazo(iso: string | null): { texto: string; tono: 'danger' | 'warn' | 'muted' } {
  const d = diasHasta(iso);
  if (d === null) return { texto: 'Sin fecha', tono: 'muted' };
  if (d < 0) return { texto: d === -1 ? 'Era para ayer' : `Era para hace ${-d} días`, tono: 'danger' };
  if (d === 0) return { texto: 'Para hoy', tono: 'danger' };
  if (d === 1) return { texto: 'Para mañana', tono: 'warn' };
  if (d <= 3) return { texto: `En ${d} días`, tono: 'warn' };
  return { texto: `En ${d} días`, tono: 'muted' };
}

const TONO = {
  danger: 'text-danger bg-danger/10 border-danger/25',
  warn: 'text-warn bg-warn/10 border-warn/25',
  muted: 'text-ink-muted bg-surface-elevated border-edge/70',
};

/** "vie 16 oct", debajo del plazo relativo. */
function fechaExacta(iso: string | null): string | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'EEE d MMM', { locale: es }).replace(/\./g, '') : null;
}

// Un color por tema (propiedad "Tema" de la Bandeja en Notion). Un tema nuevo
// sin color aquí sale en gris.
const COLOR_TEMA: Record<string, string> = {
  'Casos': 'text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/25',
  'Leads': 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  'Contabilidad y gestoría': 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
  'Instagram': 'text-pink-700 dark:text-pink-300 bg-pink-500/10 border-pink-500/25',
  'Marketing': 'text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/25',
  'Agencias': 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/25',
};
const COLOR_TEMA_OTRO = 'text-ink-muted bg-surface-elevated border-edge/70';

function EtiquetaTema({ tema }: { tema: string }) {
  return (
    <span className={clsx('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md border', COLOR_TEMA[tema] ?? COLOR_TEMA_OTRO)}>
      {tema}
    </span>
  );
}

// ─── Texto para copiar ────────────────────────────────────────────────────────
// En "Cómo", lo que Pol tiene que copiar y pegar va entre « »:
//   · en una línea propia (o en varias: un email entero) → recuadro con botón Copiar
//   · dentro de una frase (un teléfono, un email, un importe) → etiqueta que se copia al pulsarla
// Se copia sin las comillas « ».

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Navegadores sin permiso de portapapeles: el método antiguo.
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

function useCopiado(): [boolean, (texto: string) => void] {
  const [copiado, setCopiado] = useState(false);
  return [
    copiado,
    (texto) => {
      copiar(texto).then((ok) => {
        if (!ok) return;
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      });
    },
  ];
}

function BloqueCopiar({ texto }: { texto: string }) {
  const [copiado, onCopiar] = useCopiado();
  // Un email o un asunto caben en una fila con el botón al lado.
  const corto = texto.length <= 60 && !texto.includes('\n');
  return (
    <div className={clsx('rounded-lg border border-accent/30 bg-surface-card', corto && 'flex items-center justify-between gap-2')}>
      <p className={clsx('px-3 text-xs text-ink leading-relaxed whitespace-pre-wrap break-words', corto ? 'py-2 min-w-0' : 'pt-2.5 pb-2')}>{texto}</p>
      <div className={clsx('flex justify-end px-2', corto ? 'shrink-0' : 'pb-2')}>
        <button
          onClick={() => onCopiar(texto)}
          className={clsx(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border',
            copiado
              ? 'text-success bg-success/10 border-success/30'
              : 'text-accent bg-accent/10 border-accent/30 hover:bg-accent/20',
          )}
        >
          {copiado ? <Check size={11} /> : <Copy size={11} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

function EtiquetaCopiar({ texto }: { texto: string }) {
  const [copiado, onCopiar] = useCopiado();
  return (
    <button
      onClick={() => onCopiar(texto)}
      title="Copiar"
      className={clsx(
        'inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md border font-medium align-baseline',
        copiado
          ? 'text-success bg-success/10 border-success/30'
          : 'text-ink bg-accent/10 border-accent/30 hover:bg-accent/20',
      )}
    >
      {texto}
      {copiado ? <Check size={10} /> : <Copy size={10} className="text-accent" />}
    </button>
  );
}

/** Una línea de pasos con los «…» de dentro convertidos en etiquetas para copiar. */
function LineaPaso({ texto }: { texto: string }) {
  const partes = texto.split(/«([^»]+)»/);
  return (
    <>
      {partes.map((p, i) => (i % 2 === 1 ? <EtiquetaCopiar key={i} texto={p.trim()} /> : p))}
    </>
  );
}

type Trozo = { tipo: 'paso'; texto: string } | { tipo: 'copiar'; texto: string };

/** Separa el "Cómo" en pasos y bloques «…» que ocupan su propia línea (o varias). */
function trocear(texto: string): Trozo[] {
  const trozos: Trozo[] = [];
  const pasos = (t: string) =>
    t.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => trozos.push({ tipo: 'paso', texto: l }));
  const bloque = /^[ \t]*«([\s\S]*?)»[ \t]*$/gm;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = bloque.exec(texto)) !== null) {
    pasos(texto.slice(ultimo, m.index));
    trozos.push({ tipo: 'copiar', texto: m[1].trim() });
    ultimo = m.index + m[0].length;
  }
  pasos(texto.slice(ultimo));
  return trozos;
}

function Pasos({ texto }: { texto: string }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {trocear(texto).map((t, i) =>
        t.tipo === 'copiar' ? (
          <li key={i}><BloqueCopiar texto={t.texto} /></li>
        ) : (
          <li key={i} className="text-xs text-ink-secondary leading-relaxed">
            <LineaPaso texto={t.texto} />
          </li>
        ),
      )}
    </ol>
  );
}

const PASOS_CEO =
  '1. Abre Claude en el ordenador, en la carpeta aeroreclaim-ceo.\n' +
  '2. Pulsa Ejecutar en la franja Hoy, encima de la caja de texto. O pulsa Copiar para Claude en esta tarjeta y pégalo.\n' +
  '3. El CEO la marca Hecho al terminar.';

function BotonCopiarClaude({ t }: { t: BandejaTarea }) {
  const [copiado, onCopiar] = useCopiado();
  return (
    <button
      onClick={() => onCopiar(textoParaClaude(t))}
      className={clsx(
        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border',
        copiado
          ? 'text-success bg-success/10 border-success/30'
          : 'text-accent bg-accent/10 border-accent/30 hover:bg-accent/20',
      )}
      title="Copia el encargo para pegarlo en Claude Code"
    >
      {copiado ? <Check size={11} /> : <Copy size={11} />}
      {copiado ? 'Copiado' : 'Copiar para Claude'}
    </button>
  );
}

function Tarjeta({
  t, ocupada, onEstado,
}: { t: BandejaTarea; ocupada: boolean; onEstado: (estado: BandejaEstado) => void }) {
  const [abierta, setAbierta] = useState(false);
  const p = plazo(t.fechaLimite);
  const exacta = fechaExacta(t.fechaLimite);
  const ceo = esDelCeo(t);
  const como = t.como || (ceo ? PASOS_CEO : '');

  return (
    <article className="bg-surface-card border border-edge/70 rounded-2xl p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {(t.tema || ceo) && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {ceo && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/25">
                  <Bot size={10} /> Para el CEO
                </span>
              )}
              {t.tema && <EtiquetaTema tema={t.tema} />}
            </div>
          )}
          <h3 className="text-sm font-semibold text-ink leading-snug">{t.tarea}</h3>
          <p className="text-[11px] text-ink-muted mt-1">
            {t.caso}
            {t.dineroEur != null && <span className="text-ink-secondary"> · {eur(t.dineroEur)} en juego</span>}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={clsx('text-[10px] font-semibold px-2 py-1 rounded-lg border', TONO[p.tono])}>
            {p.texto}
          </span>
          {exacta && <span className="text-[10px] text-ink-muted">{exacta}</span>}
        </div>
      </div>

      {t.porQue && <p className="text-xs text-ink-secondary leading-relaxed mt-3">{t.porQue}</p>}

      {como && (
        <div className="mt-3">
          <button
            onClick={() => setAbierta((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-accent hover:underline"
          >
            <ChevronDown size={12} className={clsx('transition-transform', abierta && 'rotate-180')} />
            {abierta ? 'Ocultar los pasos' : 'Cómo hacerlo'}
          </button>
          {abierta && (
            <div className="mt-2 p-3 rounded-xl bg-surface-elevated border border-edge/60">
              <Pasos texto={como} />
              {ceo && t.instrucciones && (
                <div className="mt-3 pt-3 border-t border-edge/50">
                  <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">Encargo para el CEO</p>
                  <p className="text-[11px] text-ink-muted leading-relaxed whitespace-pre-wrap break-words">{t.instrucciones}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-edge/50">
        {t.enlace ? (
          <a
            href={t.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-accent"
          >
            <ExternalLink size={11} /> Abrir
          </a>
        ) : <span />}
        <div className="flex items-center gap-2">
          {ceo && <BotonCopiarClaude t={t} />}
          <button
            onClick={() => onEstado('Descartado')}
            disabled={ocupada}
            className="px-2.5 py-1.5 rounded-lg text-[11px] text-ink-muted hover:text-ink disabled:opacity-50"
            title="Ya no hace falta"
          >
            No aplica
          </button>
          <button
            onClick={() => onEstado('Hecho')}
            disabled={ocupada}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-success/15 border border-success/30 text-success hover:bg-success/25 disabled:opacity-50"
          >
            {ocupada ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Hecho
          </button>
        </div>
      </div>
    </article>
  );
}

interface Props {
  tareas: BandejaTarea[];
  error?: string;
  loading: boolean;
  onEstado: (id: string, estado: BandejaEstado) => Promise<void>;
}

// Momento en que se resolvió: "Hecho el" con hora; en las antiguas, que solo
// llevan fecha, la última edición de la fila.
const cuando = (t: BandejaTarea): string => (t.hechoEl?.includes('T') ? t.hechoEl : t.editada);

function etiquetaCuando(iso: string): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const dia = (x: Date) => x.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
  if (dia(d) === dia(new Date())) return `hoy ${hora}`;
  if (dia(d) === dia(new Date(Date.now() - 86400000))) return `ayer ${hora}`;
  return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })} ${hora}`;
}

export function BandejaPanel({ tareas, error, loading, onEstado }: Props) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [verResueltas, setVerResueltas] = useState(false);

  const pendientes = useMemo(
    () =>
      tareas
        .filter(cuentaEnBandeja)
        .sort((a, b) => (a.fechaLimite ?? '9999') < (b.fechaLimite ?? '9999') ? -1 : 1),
    [tareas],
  );
  // Tareas del CEO sin día fijo: no son urgentes para Pol, pero se ven.
  const ceoSinFecha = useMemo(
    () => tareas.filter((t) => t.estado === 'Pendiente' && esDelCeo(t) && !t.fechaLimite),
    [tareas],
  );
  // La última marcada, primero: si un "Hecho" fue un error, está arriba.
  const resueltas = useMemo(
    () => tareas.filter((t) => t.estado !== 'Pendiente').sort((a, b) => (cuando(b) > cuando(a) ? 1 : -1)),
    [tareas],
  );

  async function cambiar(id: string, estado: BandejaEstado) {
    setOcupada(id);
    try {
      await onEstado(id, estado);
    } finally {
      setOcupada(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 bg-surface-card border border-edge/70 rounded-2xl animate-pulse-soft" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Inbox size={15} className="text-accent" />
          Tu bandeja
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {error && pendientes.length === 0
            ? 'Ahora mismo no se puede saber qué hay pendiente.'
            : pendientes.length === 0
            ? 'Nada pendiente. El resto lo llevan los agentes.'
            : `${pendientes.length} ${pendientes.length === 1 ? 'tarea' : 'tareas'}, la más urgente primero. Las que dicen "Para el CEO" las hace Claude: solo tienes que abrirlo.`}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-xs text-danger">
          {/rate limit/i.test(error)
            ? 'Notion está recibiendo demasiadas peticiones y no ha dejado leer la bandeja. Se vuelve a intentar solo cada 3 minutos, o pulsa Actualizar dentro de un minuto.'
            : `No se ha podido leer la bandeja: ${error}`}
        </div>
      )}

      {pendientes.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-11 h-11 rounded-2xl bg-success/10 border border-success/25 flex items-center justify-center mb-3">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <p className="text-sm font-medium text-ink">Bandeja vacía</p>
          <p className="text-xs text-ink-muted mt-1 max-w-sm">
            Aquí aparece lo que solo puedes hacer tú (enviar un email revisado, firmar, pagar, llamar o decidir) y lo que el CEO tiene que hacer un día concreto cuando abras Claude.
          </p>
        </div>
      )}

      {pendientes.map((t) => (
        <Tarjeta key={t.id} t={t} ocupada={ocupada === t.id} onEstado={(e) => cambiar(t.id, e)} />
      ))}

      {ceoSinFecha.length > 0 && (
        <div className="border-t border-edge/60 pt-4 flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Bot size={13} className="text-accent" />
              Para el CEO, sin fecha ({ceoSinFecha.length})
            </h3>
            <p className="text-[11px] text-ink-muted mt-0.5">Las hace la próxima vez que abras Claude. No tienes que hacer nada más.</p>
          </div>
          {ceoSinFecha.map((t) => (
            <Tarjeta key={t.id} t={t} ocupada={ocupada === t.id} onEstado={(e) => cambiar(t.id, e)} />
          ))}
        </div>
      )}

      {resueltas.length > 0 && (
        <div className="border-t border-edge/60 pt-4">
          <button
            onClick={() => setVerResueltas((v) => !v)}
            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink-secondary"
          >
            <ChevronDown size={13} className={clsx('transition-transform', verResueltas && 'rotate-180')} />
            Resueltas en las últimas 2 semanas ({resueltas.length}), la última primero
          </button>
          {verResueltas && (
            <div className="mt-3 flex flex-col gap-2">
              {resueltas.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 bg-surface-card border border-edge/50 rounded-xl px-3 py-2">
                  <div className="min-w-0 flex items-baseline gap-2">
                    <span className="shrink-0 text-[10px] text-ink-faint tabular-nums">{etiquetaCuando(cuando(t))}</span>
                    <p className="text-xs text-ink-muted line-through decoration-ink-faint min-w-0 truncate">{t.tarea}</p>
                    {t.estado === 'Descartado' && <span className="shrink-0 text-[10px] text-ink-faint">No aplica</span>}
                  </div>
                  <button
                    onClick={() => cambiar(t.id, 'Pendiente')}
                    disabled={ocupada === t.id}
                    className="shrink-0 flex items-center gap-1 text-[10px] text-ink-muted hover:text-ink"
                    title="Volver a pendiente"
                  >
                    <RotateCcw size={10} /> Deshacer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BandejaPanel;
