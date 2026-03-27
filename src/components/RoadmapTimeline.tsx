'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Circle } from 'lucide-react';

// ─── Phase data ──────────────────────────────────────────────────────────────

export interface Phase {
  id: string;
  name: string;
  start: string;
  end: string;
  color: string;
}

export const PHASES: Phase[] = [
  { id: 'infra',     name: 'Infraestructura',       start: '2026-03-24', end: '2026-03-31', color: '#22c55e' },
  { id: 'mvp',       name: 'MVP & Pipeline',        start: '2026-03-25', end: '2026-04-15', color: '#3b82f6' },
  { id: 'marketing', name: 'Pre-launch Marketing',  start: '2026-04-15', end: '2026-05-01', color: '#f59e0b' },
  { id: 'beta',      name: 'Beta Launch',            start: '2026-05-01', end: '2026-05-15', color: '#8b5cf6' },
  { id: 'launch',    name: 'Public Launch',          start: '2026-05-15', end: '2026-06-01', color: '#ec4899' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

function toDateLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

type PhaseStatus = 'completed' | 'active' | 'upcoming';

function getPhaseStatus(phase: Phase, today: string): PhaseStatus {
  if (today >= phase.end) return 'completed';
  if (today >= phase.start) return 'active';
  return 'upcoming';
}

function getPhaseProgress(phase: Phase, today: string): number {
  const status = getPhaseStatus(phase, today);
  if (status === 'completed') return 100;
  if (status === 'upcoming') return 0;
  const total = daysBetween(phase.start, phase.end);
  const elapsed = daysBetween(phase.start, today);
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onSelectPhase?: (phase: Phase) => void;
  activePhaseId?: string;
}

export function RoadmapTimeline({ onSelectPhase, activePhaseId }: Props) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Overall timeline bounds
  const timelineStart = PHASES[0].start;
  const timelineEnd = PHASES[PHASES.length - 1].end;
  const totalDays = daysBetween(timelineStart, timelineEnd);

  // Today marker position
  const todayOffset = Math.min(100, Math.max(0, (daysBetween(timelineStart, today) / totalDays) * 100));

  // Month ticks
  const months = useMemo(() => {
    const result: { label: string; offset: number }[] = [];
    const start = new Date(timelineStart);
    const end = new Date(timelineEnd);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const iso = cursor.toISOString().split('T')[0];
      const offset = (daysBetween(timelineStart, iso) / totalDays) * 100;
      if (offset >= 0 && offset <= 100) {
        result.push({
          label: cursor.toLocaleDateString('es-ES', { month: 'short' }),
          offset,
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }, [timelineStart, timelineEnd, totalDays]);

  return (
    <div className="bg-surface-card border border-edge/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-ink">Roadmap del Proyecto</h2>
        <span className="text-[11px] text-ink-muted font-mono">
          {toDateLabel(timelineStart)} — {toDateLabel(timelineEnd)}
        </span>
      </div>

      {/* ── Gantt chart ── */}
      <div className="relative">
        {/* Month labels */}
        <div className="relative h-5 mb-2">
          {months.map((m) => (
            <span
              key={m.label}
              className="absolute text-[10px] text-ink-muted uppercase tracking-wider"
              style={{ left: `${m.offset}%`, transform: 'translateX(-50%)' }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Bars */}
        <div className="relative flex flex-col gap-2">
          {PHASES.map((phase) => {
            const left = (daysBetween(timelineStart, phase.start) / totalDays) * 100;
            const width = (daysBetween(phase.start, phase.end) / totalDays) * 100;
            const status = getPhaseStatus(phase, today);
            const progress = getPhaseProgress(phase, today);
            const isSelected = activePhaseId === phase.id;

            return (
              <motion.button
                key={phase.id}
                onClick={() => onSelectPhase?.(phase)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`
                  relative h-10 w-full rounded-lg transition-all cursor-pointer group
                  ${isSelected ? 'ring-2 ring-accent/60' : ''}
                `}
              >
                {/* Track background */}
                <div className="absolute inset-0 bg-surface-elevated rounded-lg" />

                {/* Phase bar */}
                <div
                  className="absolute top-0 h-full rounded-lg overflow-hidden"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  {/* Base bar */}
                  <div
                    className="absolute inset-0 rounded-lg transition-opacity"
                    style={{
                      backgroundColor: phase.color,
                      opacity: status === 'upcoming' ? 0.15 : 0.25,
                    }}
                  />
                  {/* Progress fill */}
                  {progress > 0 && (
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-lg"
                      style={{ backgroundColor: phase.color, opacity: 0.7 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  )}
                  {/* Label */}
                  <div className="relative h-full flex items-center px-3 gap-2 z-10">
                    {status === 'completed' && <CheckCircle2 size={13} className="text-white/90 shrink-0" />}
                    {status === 'active' && <Clock size={13} className="text-white/90 shrink-0" />}
                    {status === 'upcoming' && <Circle size={13} className="text-ink-muted shrink-0" />}
                    <span
                      className={`text-xs font-medium truncate ${
                        status === 'upcoming' ? 'text-ink-muted' : 'text-white/90'
                      }`}
                    >
                      {phase.name}
                    </span>
                    {status === 'active' && (
                      <span className="ml-auto text-[10px] font-mono text-white/70 shrink-0">
                        {progress}%
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}

          {/* Today indicator */}
          {todayOffset > 0 && todayOffset < 100 && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: `${todayOffset}%` }}
            >
              <div className="w-px h-full bg-red-500/70" />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-400 bg-surface-card px-1.5 py-0.5 rounded-full border border-red-500/30">
                HOY
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Phase legend / stats ── */}
      <div className="mt-5 flex flex-wrap gap-3">
        {PHASES.map((phase) => {
          const status = getPhaseStatus(phase, today);
          const progress = getPhaseProgress(phase, today);
          return (
            <div
              key={phase.id}
              className="flex items-center gap-2 text-[11px] text-ink-secondary"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: phase.color,
                  opacity: status === 'upcoming' ? 0.4 : 1,
                }}
              />
              <span className={status === 'active' ? 'text-ink font-medium' : ''}>
                {phase.name}
              </span>
              {status === 'active' && (
                <span className="font-mono text-accent">{progress}%</span>
              )}
              {status === 'completed' && (
                <CheckCircle2 size={11} className="text-green-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
