'use client';

import { useMemo, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ExternalLink, Inbox, Loader2, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import type { BandejaEstado, BandejaTarea } from '@/lib/bandejaDb';
import { diasHasta, eur } from '@/lib/casos';

// ─── Bandeja de Pol ───────────────────────────────────────────────────────────
// Una tarjeta por tarea, con lo justo para actuar sin abrir nada más:
//   · qué hacer, en una frase que empieza por verbo
//   · de qué caso y cuánto dinero hay en juego
//   · para cuándo, en lenguaje natural
//   · por qué importa y cómo hacerlo, paso a paso (desplegable)
// "Hecho" cambia el Estado de la fila en Notion: persiste en cualquier
// dispositivo y desaparece de la lista de pendientes.

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

function Pasos({ texto }: { texto: string }) {
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <ol className="flex flex-col gap-1.5">
      {lineas.map((l, i) => (
        <li key={i} className="text-xs text-ink-secondary leading-relaxed">
          {l}
        </li>
      ))}
    </ol>
  );
}

function Tarjeta({
  t, ocupada, onEstado,
}: { t: BandejaTarea; ocupada: boolean; onEstado: (estado: BandejaEstado) => void }) {
  const [abierta, setAbierta] = useState(false);
  const p = plazo(t.fechaLimite);

  return (
    <article className="bg-surface-card border border-edge/70 rounded-2xl p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink leading-snug">{t.tarea}</h3>
          <p className="text-[11px] text-ink-muted mt-1">
            {t.caso}
            {t.dineroEur != null && <span className="text-ink-secondary"> · {eur(t.dineroEur)} en juego</span>}
          </p>
        </div>
        <span className={clsx('shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg border', TONO[p.tono])}>
          {p.texto}
        </span>
      </div>

      {t.porQue && <p className="text-xs text-ink-secondary leading-relaxed mt-3">{t.porQue}</p>}

      {t.como && (
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
              <Pasos texto={t.como} />
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

export function BandejaPanel({ tareas, error, loading, onEstado }: Props) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [verResueltas, setVerResueltas] = useState(false);

  const pendientes = useMemo(
    () =>
      tareas
        .filter((t) => t.estado === 'Pendiente')
        .sort((a, b) => (a.fechaLimite ?? '9999') < (b.fechaLimite ?? '9999') ? -1 : 1),
    [tareas],
  );
  const resueltas = useMemo(() => tareas.filter((t) => t.estado !== 'Pendiente'), [tareas]);

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
          Lo que solo puedes hacer tú
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {pendientes.length === 0
            ? 'Nada pendiente. El resto lo llevan los agentes.'
            : `${pendientes.length} ${pendientes.length === 1 ? 'tarea' : 'tareas'}, la más urgente primero.`}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-xs text-danger">
          No se ha podido leer la bandeja: {error}
        </div>
      )}

      {pendientes.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-11 h-11 rounded-2xl bg-success/10 border border-success/25 flex items-center justify-center mb-3">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <p className="text-sm font-medium text-ink">Bandeja vacía</p>
          <p className="text-xs text-ink-muted mt-1 max-w-sm">
            Aquí solo aparece lo que ningún agente puede hacer por ti: enviar un email revisado, firmar, pagar, llamar o decidir.
          </p>
        </div>
      )}

      {pendientes.map((t) => (
        <Tarjeta key={t.id} t={t} ocupada={ocupada === t.id} onEstado={(e) => cambiar(t.id, e)} />
      ))}

      {resueltas.length > 0 && (
        <div className="border-t border-edge/60 pt-4">
          <button
            onClick={() => setVerResueltas((v) => !v)}
            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink-secondary"
          >
            <ChevronDown size={13} className={clsx('transition-transform', verResueltas && 'rotate-180')} />
            Resueltas en las últimas 2 semanas ({resueltas.length})
          </button>
          {verResueltas && (
            <div className="mt-3 flex flex-col gap-2">
              {resueltas.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 bg-surface-card border border-edge/50 rounded-xl px-3 py-2">
                  <p className="text-xs text-ink-muted line-through decoration-ink-faint min-w-0 truncate">{t.tarea}</p>
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
