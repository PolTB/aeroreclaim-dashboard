'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, RefreshCw, AlertCircle, ShieldAlert } from 'lucide-react';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import type { RadarCaso } from '@/lib/notionRadar';

// ─── Radar de Casos (AER-224) ──────────────────────────────────────────────────
// Sección aditiva en la pestaña Casos: lee la DB Notion "📡 Casos Activos —
// Radar" vía /api/notion/radar (mismo NOTION_TOKEN que el Kanban/Delegaciones).
// No sustituye a Mandatos firmados / Pipeline leads — es una vista adicional.

type Urgency = 'red' | 'yellow' | 'green';

function getUrgency(fechaLimite: string | null): Urgency {
  if (!fechaLimite) return 'green';
  const d = parseISO(fechaLimite);
  if (!isValid(d)) return 'green';
  const days = differenceInCalendarDays(d, new Date());
  if (days <= 3) return 'red';   // incluye vencidos (days negativos)
  if (days <= 7) return 'yellow';
  return 'green';
}

const URGENCY_STYLES: Record<Urgency, { dot: string; text: string; label: string }> = {
  red:    { dot: 'bg-danger',  text: 'text-danger',  label: '🔴' },
  yellow: { dot: 'bg-warn',    text: 'text-warn',    label: '🟡' },
  green:  { dot: 'bg-success', text: 'text-success', label: '🟢' },
};

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  if (!isValid(d)) return '—';
  return format(d, "d MMM", { locale: es });
}

export function RadarPanel() {
  const [casos, setCasos]           = useState<RadarCaso[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [needsAccess, setNeedsAccess] = useState(false);

  const fetchRadar = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setNeedsAccess(false);

    try {
      const res = await fetch('/api/notion/radar');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setNeedsAccess(Boolean(data.needsAccess));
        setCasos([]);
        return;
      }

      setCasos(data.casos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el radar');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRadar();
    const interval = setInterval(() => fetchRadar(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRadar]);

  const totalComision = casos.reduce((s, c) => s + (c.comisionEstEur ?? 0), 0);

  return (
    <div className="flex flex-col gap-3 bg-surface-card border border-edge/60 rounded-2xl p-4 shadow-card">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
            <Radar size={15} className="text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">📡 Radar de Casos</h2>
            <p className="text-xs text-ink-muted">
              {loading ? 'Cargando…' : `${casos.length} caso${casos.length !== 1 ? 's' : ''} activo${casos.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalComision > 0 && (
            <div className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-3 py-1 rounded-full">
              {totalComision.toLocaleString('es-ES')} € comisión en juego
            </div>
          )}
          <button
            onClick={() => fetchRadar(true)}
            disabled={refreshing || loading}
            className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-elevated border border-transparent hover:border-edge/40 transition-all"
            title="Actualizar"
          >
            <RefreshCw size={13} className={clsx(refreshing && 'animate-spin text-accent')} />
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center gap-3 text-ink-muted py-8 justify-center">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando radar…</span>
        </div>
      )}

      {/* ── Error / sin acceso ── */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 p-3 bg-danger/8 border border-danger/20 rounded-xl text-sm text-danger"
          >
            {needsAccess ? <ShieldAlert size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <div>
              <p className="font-medium">
                {needsAccess ? 'La integración no tiene acceso a la DB Radar' : 'Error cargando el radar'}
              </p>
              <p className="text-xs mt-0.5 opacity-70">
                {needsAccess
                  ? 'Compartir la DB "📡 Casos Activos — Radar" con la integración de Notion desde Notion → Connections. No se puede resolver desde el dashboard.'
                  : error}
              </p>
              <button onClick={() => fetchRadar()} className="text-xs mt-2 underline underline-offset-2 hover:no-underline">
                Reintentar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {!loading && !error && casos.length === 0 && (
        <p className="text-xs text-ink-muted py-6 text-center">
          Sin casos activos en el Radar (todos en Perdido/Cobrado, o la DB está vacía).
        </p>
      )}

      {/* ── Tabla de casos ── */}
      {!loading && casos.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-edge/60 text-ink-faint">
                <th className="text-left font-medium px-2 py-2 w-6"></th>
                <th className="text-left font-medium px-2 py-2">Cliente</th>
                <th className="text-left font-medium px-2 py-2">Etapa</th>
                <th className="text-right font-medium px-2 py-2">Compensación</th>
                <th className="text-left font-medium px-2 py-2">Fecha límite</th>
                <th className="text-left font-medium px-2 py-2">Próxima acción</th>
                <th className="text-left font-medium px-2 py-2">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {casos.map((c) => {
                const urgency = getUrgency(c.fechaLimite);
                const style = URGENCY_STYLES[urgency];
                return (
                  <tr key={c.id} className="border-b border-edge/30 last:border-0 hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-2 py-2.5">
                      <span className={clsx('inline-block w-2 h-2 rounded-full', style.dot)} title={urgency} />
                    </td>
                    <td className="px-2 py-2.5">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink hover:text-accent transition-colors"
                      >
                        {c.cliente || '(sin nombre)'}
                      </a>
                      {c.vuelo && <p className="text-ink-faint text-[10px] mt-0.5">{c.vuelo}</p>}
                    </td>
                    <td className="px-2 py-2.5 text-ink-secondary">{c.etapa ?? '—'}</td>
                    <td className="px-2 py-2.5 text-right text-ink-secondary tabular-nums">
                      {c.compensacionEur != null ? `${c.compensacionEur.toLocaleString('es-ES')} €` : '—'}
                    </td>
                    <td className={clsx('px-2 py-2.5 font-medium tabular-nums', style.text)}>
                      {formatFecha(c.fechaLimite)}
                    </td>
                    <td className="px-2 py-2.5 text-ink-secondary max-w-[220px] truncate" title={c.proximaAccion}>
                      {c.proximaAccion || '—'}
                    </td>
                    <td className="px-2 py-2.5 text-ink-muted">{c.responsable ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RadarPanel;
