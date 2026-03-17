'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, RefreshCw, AlertCircle, Database, Info } from 'lucide-react';
import clsx from 'clsx';
import type { AeroCaso } from '@/types';
import { CaseCard } from './CaseCard';

// ─── Case Tracker ─────────────────────────────────────────────────────────────

export function CaseTracker() {
  const [cases, setCases]       = useState<AeroCaso[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [source, setSource]     = useState<'sheets' | 'fallback'>('fallback');
  const [refreshing, setRefreshing] = useState(false);

  const fetchCases = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/cases');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { cases: AeroCaso[]; source: 'sheets' | 'fallback' } = await res.json();
      setCases(data.cases);
      setSource(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando casos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    const interval = setInterval(() => fetchCases(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCases]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-ink-muted">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando casos...</span>
        </div>
      </div>
    );
  }

  const activeCases  = cases.filter(c => c.estadoActual !== 'Cerrado');
  const closedCases  = cases.filter(c => c.estadoActual === 'Cerrado');
  const totalRevenue = cases.reduce((s, c) => s + c.compensacion, 0);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
            <Briefcase size={15} className="text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Case Tracker</h2>
            <p className="text-xs text-ink-muted">
              {activeCases.length} caso{activeCases.length !== 1 ? 's' : ''} activo{activeCases.length !== 1 ? 's' : ''}
              {closedCases.length > 0 && ` · ${closedCases.length} cerrado${closedCases.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Revenue summary */}
          {totalRevenue > 0 && (
            <div className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-3 py-1 rounded-full">
              {totalRevenue.toLocaleString('es-ES')} € en gestión
            </div>
          )}

          {/* Data source badge */}
          <div className={clsx(
            'flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border',
            source === 'sheets'
              ? 'text-success bg-success/8 border-success/20'
              : 'text-ink-muted bg-surface-elevated border-edge/60',
          )}>
            <Database size={9} />
            {source === 'sheets' ? 'Google Sheets' : 'Datos locales'}
          </div>

          <button
            onClick={() => fetchCases(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
            title="Actualizar"
          >
            <RefreshCw size={13} className={clsx(refreshing && 'animate-spin text-accent')} />
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 p-3 bg-danger/8 border border-danger/20 rounded-xl text-sm text-danger"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Error cargando casos</p>
              <p className="text-xs mt-0.5 opacity-70">{error}</p>
              <button onClick={() => fetchCases()} className="text-xs mt-2 underline underline-offset-2 hover:no-underline">
                Reintentar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Google Sheets setup hint (only when using fallback) ── */}
      {source === 'fallback' && (
        <div className="flex items-start gap-2 p-3 bg-accent/5 border border-accent/15 rounded-xl text-xs text-ink-muted">
          <Info size={13} className="text-accent mt-0.5 shrink-0" />
          <span>
            <span className="text-ink-secondary font-medium">Datos en tiempo real:</span>{' '}
            añade{' '}
            <code className="font-mono text-accent bg-surface-elevated px-1 rounded">GOOGLE_SHEETS_SPREADSHEET_ID</code>
            {' '}y{' '}
            <code className="font-mono text-accent bg-surface-elevated px-1 rounded">GOOGLE_SHEETS_API_KEY</code>
            {' '}en Vercel para sincronizar con el Google Sheet central.
          </span>
        </div>
      )}

      {/* ── Cases grid ── */}
      {cases.length === 0 ? (
        <div className="text-center py-16 text-ink-faint text-sm">
          No hay casos activos
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {cases.map((caso, i) => (
            <CaseCard key={caso.id} caso={caso} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
