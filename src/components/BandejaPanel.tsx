'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, Info, Inbox, Loader2, XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { differenceInCalendarDays } from 'date-fns';
import type { BandejaEntry, BandejaItem, BandejaTipo } from '@/lib/bandeja';
import { BANDEJA_PAGE_ID } from '@/lib/useDashboardData';

// ─── Bandeja de Pol ───────────────────────────────────────────────────────────
// Sólo lo que requiere la mano de Pol. Dos cambios de fondo respecto a la
// versión anterior:
//
// 1. "Hecho" ahora se escribe en Notion con una clave estable y se vuelve a
//    leer al cargar (ver lib/bandeja.ts). Antes vivía sólo en localStorage:
//    marcar algo en el móvil dejaba la entrada viva en el portátil.
// 2. Las entradas se ordenan por fecha real y se agrupan por urgencia, en vez
//    de salir en el orden en que estén escritos los bloques en la página.

const TIPO_ORDEN: Record<BandejaTipo, number> = { urgent: 0, warning: 1, ok: 2, info: 3 };

const TIPO_ESTILO: Record<BandejaTipo, { icono: React.ReactNode; caja: string; texto: string; etiqueta: string }> = {
  urgent:  { icono: <XCircle size={13} />,      caja: 'bg-danger/10 border-danger/25',  texto: 'text-danger',  etiqueta: 'Urgente' },
  warning: { icono: <AlertTriangle size={13} />, caja: 'bg-warn/10 border-warn/25',      texto: 'text-warn',    etiqueta: 'Revisa' },
  ok:      { icono: <CheckCircle2 size={13} />,  caja: 'bg-success/10 border-success/25', texto: 'text-success', etiqueta: 'Listo para enviar' },
  info:    { icono: <Info size={13} />,          caja: 'bg-accent/10 border-accent/25',   texto: 'text-accent',  etiqueta: 'Para saberlo' },
};

function antiguedad(fecha: Date | null): string | null {
  if (!fecha) return null;
  const dias = Math.abs(differenceInCalendarDays(fecha, new Date()));
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

interface Props {
  entries: BandejaEntry[];
  done: Set<string>;
  error?: string;
  loading: boolean;
  onMarkDone: (key: string) => void;
}

export function BandejaPanel({ entries, done, error, loading, onMarkDone }: Props) {
  const [marcando, setMarcando] = useState<string | null>(null);
  const [verResueltas, setVerResueltas] = useState(false);

  const pendientes = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, items: entry.items.filter((i) => !done.has(i.key)) }))
        .filter((g) => g.items.length > 0)
        .map((g) => ({
          ...g,
          items: [...g.items].sort((a, b) => TIPO_ORDEN[a.type] - TIPO_ORDEN[b.type]),
        })),
    [entries, done],
  );

  const resueltas = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, items: entry.items.filter((i) => done.has(i.key)) }))
        .filter((g) => g.items.length > 0),
    [entries, done],
  );

  const totalPendientes = pendientes.reduce((s, g) => s + g.items.length, 0);
  const urgentes = pendientes.reduce((s, g) => s + g.items.filter((i) => i.type === 'urgent').length, 0);

  async function marcarHecho(item: BandejaItem) {
    setMarcando(item.key);
    const ahora = new Date();
    const sello =
      ahora.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    try {
      // La clave viaja en el propio texto del log: es lo que permite volver a
      // reconocer el ítem como hecho desde cualquier dispositivo.
      await fetch('/api/notion/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: BANDEJA_PAGE_ID,
          text: `✅ Pol actuó — key:${item.key} — ${item.ref || item.message.slice(0, 40)} — ${sello}`,
        }),
      });
    } catch {
      /* si Notion falla, al menos queda marcado en este navegador */
    }
    onMarkDone(item.key);
    setMarcando(null);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-surface-card border border-edge/70 rounded-xl animate-pulse-soft" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Inbox size={15} className="text-accent" />
          Lo que sólo puedes hacer tú
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {totalPendientes === 0
            ? 'Nada pendiente. El resto lo llevan los agentes.'
            : `${totalPendientes} ${totalPendientes === 1 ? 'cosa pendiente' : 'cosas pendientes'}${urgentes ? ` · ${urgentes} urgente${urgentes > 1 ? 's' : ''}` : ''}`}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-xs text-danger">
          No se ha podido leer la bandeja: {error}
        </div>
      )}

      {totalPendientes === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-11 h-11 rounded-2xl bg-success/10 border border-success/25 flex items-center justify-center mb-3">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <p className="text-sm font-medium text-ink">Bandeja vacía</p>
          <p className="text-xs text-ink-muted mt-1 max-w-sm">
            Aquí sólo aparece lo que ningún agente puede hacer por ti: firmar, pagar, llamar o decidir.
          </p>
        </div>
      )}

      {pendientes.map(({ entry, items }) => (
        <section key={entry.id} className="bg-surface-card border border-edge/70 rounded-2xl p-4 shadow-card">
          <p className="text-[11px] font-semibold text-ink-muted mb-2.5">
            {entry.date}
            {antiguedad(entry.parsed) && <span className="font-normal"> · {antiguedad(entry.parsed)}</span>}
          </p>
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const estilo = TIPO_ESTILO[item.type];
              const ocupado = marcando === item.key;
              return (
                <div key={item.key} className={clsx('flex items-start gap-2.5 rounded-xl px-3 py-2.5 border', estilo.caja)}>
                  <span className={clsx('mt-0.5 shrink-0', estilo.texto)}>{estilo.icono}</span>
                  <div className="flex-1 min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className={clsx('text-[10px] font-semibold uppercase tracking-wide', estilo.texto)}>
                        {estilo.etiqueta}
                      </span>
                      {item.ref && <span className="text-[11px] font-mono font-semibold text-ink">{item.ref}</span>}
                      {item.contact && <span className="text-[11px] text-ink-muted">{item.contact}</span>}
                    </p>
                    <p className="text-xs text-ink-secondary leading-relaxed mt-1">{item.message}</p>
                  </div>
                  <button
                    onClick={() => marcarHecho(item)}
                    disabled={ocupado}
                    className="ml-1 shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-surface-elevated border border-edge/70 text-ink-muted hover:text-ink hover:border-edge-bright disabled:opacity-50"
                    title="Marcar como hecho"
                  >
                    {ocupado ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                    Hecho
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {resueltas.length > 0 && (
        <div className="border-t border-edge/60 pt-4">
          <button
            onClick={() => setVerResueltas((v) => !v)}
            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink-secondary"
          >
            <ChevronDown size={13} className={clsx('transition-transform', verResueltas && 'rotate-180')} />
            Ya resueltas ({resueltas.reduce((s, g) => s + g.items.length, 0)})
          </button>
          {verResueltas && (
            <div className="mt-3 flex flex-col gap-2">
              {resueltas.map(({ entry, items }) => (
                <div key={entry.id} className="bg-surface-card border border-edge/50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">{entry.date}</p>
                  {items.map((item) => (
                    <p key={item.key} className="text-xs text-ink-muted line-through decoration-ink-faint">
                      {item.ref ? `${item.ref} — ` : ''}
                      {item.message}
                    </p>
                  ))}
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
