'use client';

import { motion } from 'framer-motion';
import { Plane, Calendar, Euro } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import type { AeroCaso } from '@/types';
import { PIPELINE_STAGES } from '@/types';
import { CasePipeline } from './CasePipeline';

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const style =
    score >= 85 ? 'text-success bg-success/10 border-success/25'
    : score >= 60 ? 'text-warn bg-warn/10 border-warn/25'
    : 'text-danger bg-danger/10 border-danger/25';
  return (
    <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full border tabular-nums', style)}>
      {score}/100
    </span>
  );
}

// ─── Priority dot ─────────────────────────────────────────────────────────────

function PriorityDot({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-danger' : score >= 70 ? 'bg-warn' : 'bg-success';
  return <span className={clsx('inline-block w-2 h-2 rounded-full shrink-0', color)} />;
}

// ─── Case card ────────────────────────────────────────────────────────────────

export function CaseCard({ caso, index }: { caso: AeroCaso; index: number }) {
  const stageIndex = PIPELINE_STAGES.indexOf(caso.estadoActual);
  const progress   = Math.round(((stageIndex + 0.5) / PIPELINE_STAGES.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.06 }}
      className="bg-surface-card border border-edge/60 rounded-2xl p-5 flex flex-col gap-4 shadow-card"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PriorityDot score={caso.scoreLegal} />
            <h3 className="text-sm font-semibold text-ink truncate">{caso.pasajero}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            <span className="flex items-center gap-1">
              <Plane size={10} />
              <span className="font-mono font-semibold text-ink-secondary">{caso.vuelo}</span>
              <span className="text-ink-faint">·</span>
              <span>{caso.ruta}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {format(parseISO(caso.fecha), "d MMM ''yy", { locale: es })}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <ScoreBadge score={caso.scoreLegal} />
          <div className="flex items-center gap-0.5 text-success font-bold text-base tabular-nums">
            <Euro size={13} />
            {caso.compensacion.toLocaleString('es-ES')}
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
            Pipeline
          </span>
          <span className="text-[10px] text-ink-faint tabular-nums">{progress}%</span>
        </div>
        <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent via-blue-500 to-success"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: index * 0.06 + 0.15 }}
          />
        </div>
      </div>

      {/* ── Pipeline stepper ── */}
      <CasePipeline caso={caso} />

      {/* ── Footer ── */}
      <div className="flex items-center justify-between pt-2 border-t border-edge/40">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-faint">Estado:</span>
          <span className="text-[10px] font-semibold text-warn bg-warn/10 px-2 py-0.5 rounded-full border border-warn/20">
            {caso.estadoActual}
          </span>
          <span className="text-[10px] text-ink-faint">→ próximo:</span>
          <span className="text-[10px] text-ink-secondary">
            {PIPELINE_STAGES[stageIndex + 1] ?? '—'}
          </span>
        </div>
        <span className="text-[10px] text-ink-faint">
          {format(parseISO(caso.ultimaActualizacion), "d MMM ''yy", { locale: es })}
        </span>
      </div>
    </motion.div>
  );
}
