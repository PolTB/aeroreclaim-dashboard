'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronRight, ListTodo } from 'lucide-react';
import type { NotionTask } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import { PHASES } from './RoadmapTimeline';

// ─── Phase → category mapping (mirrors PhaseBacklog) ─────────────────────────

const PHASE_CATEGORY_MAP: Record<string, string[]> = {
  infra:     ['Tech/Operaciones', 'Operaciones'],
  mvp:       ['Tech/Operaciones', 'Operaciones', 'SEO/Web'],
  marketing: ['Marketing/Outreach', 'SEO/Contenido', 'SEO', 'Redes Sociales', 'Comunidades'],
  beta:      ['Tech/Operaciones', 'Operaciones', 'Marketing/Outreach'],
  launch:    ['Marketing/Outreach', 'SEO/Contenido', 'Redes Sociales', 'Comunidades', 'SEO'],
};

// Returns the earliest phase index (by PHASES order) that this task belongs to.
// Returns -1 if no match.
function getPhaseIndex(task: NotionTask): number {
  if (!task.categoria) return -1;
  return PHASES.findIndex((p) => {
    const cats = PHASE_CATEGORY_MAP[p.id] ?? [];
    return cats.includes(task.categoria as string);
  });
}

// ─── Priority sort weight ─────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<string, number> = {
  'P1 - Urgente': 0,
  'P2 - Alta':    1,
  'P3 - Media':   2,
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  tasks: NotionTask[];
}

const PAGE_SIZE = 10;

export function ProximasTareas({ tasks }: Props) {
  const [showAll, setShowAll] = useState(false);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Active and upcoming phase ids
  const activeAndUpcomingPhaseIds = useMemo(
    () => new Set(PHASES.filter((p) => today < p.end).map((p) => p.id)),
    [today],
  );

  const sorted = useMemo(() => {
    // Filter: not completed, and (has a date OR belongs to an active/upcoming phase)
    const filtered = tasks.filter((t) => {
      if (t.estado === 'Completada') return false;
      const phaseIdx = getPhaseIndex(t);
      const inActivePhase = phaseIdx !== -1 && activeAndUpcomingPhaseIds.has(PHASES[phaseIdx].id);
      return t.fechaLimite != null || inActivePhase;
    });

    // Sort: phase order → priority → date
    return filtered.sort((a, b) => {
      const pa = getPhaseIndex(a);
      const pb = getPhaseIndex(b);
      const phaseA = pa === -1 ? 999 : pa;
      const phaseB = pb === -1 ? 999 : pb;
      if (phaseA !== phaseB) return phaseA - phaseB;

      const wa = a.prioridad != null ? (PRIORITY_WEIGHT[a.prioridad] ?? 3) : 3;
      const wb = b.prioridad != null ? (PRIORITY_WEIGHT[b.prioridad] ?? 3) : 3;
      if (wa !== wb) return wa - wb;

      const da = a.fechaLimite ?? '9999-12-31';
      const db = b.fechaLimite ?? '9999-12-31';
      return da.localeCompare(db);
    });
  }, [tasks, activeAndUpcomingPhaseIds, today]);

  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
  const hasMore = sorted.length > PAGE_SIZE;

  return (
    <div className="bg-surface-card border border-edge/60 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListTodo size={14} className="text-accent" />
          <h3 className="text-sm font-semibold text-ink">Próximas Tareas</h3>
          <span className="text-[11px] text-ink-muted bg-surface-elevated px-1.5 py-0.5 rounded-full">
            {sorted.length}
          </span>
        </div>
        {hasMore && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition-colors"
          >
            {showAll ? (
              <>ver menos <ChevronUp size={12} /></>
            ) : (
              <>ver todas <ChevronDown size={12} /></>
            )}
          </button>
        )}
      </div>

      {/* Task list */}
      {sorted.length === 0 ? (
        <p className="text-xs text-ink-muted text-center py-6">
          No hay tareas próximas pendientes.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          <motion.div className="flex flex-col gap-1.5">
            {visible.map((task) => (
              <TaskItem key={task.id} task={task} today={today} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────

function TaskItem({ task, today }: { task: NotionTask; today: string }) {
  const phaseIdx = getPhaseIndex(task);
  const phase = phaseIdx !== -1 ? PHASES[phaseIdx] : null;
  const pri = task.prioridad ? PRIORITY_CONFIG[task.prioridad] : null;
  const isOverdue = task.fechaLimite && task.fechaLimite < today;

  return (
    <motion.button
      onClick={() => task.url && window.open(task.url, '_blank')}
      whileHover={{ x: 2 }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-elevated/50 hover:bg-surface-elevated transition-colors text-left w-full group"
    >
      {/* Priority dot */}
      {pri && (
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: pri.dot }}
        />
      )}
      {!pri && <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-ink-muted/30" />}

      {/* Task name */}
      <span className="text-xs text-ink truncate flex-1">{task.tarea}</span>

      {/* Phase badge */}
      {phase && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
          style={{
            backgroundColor: `${phase.color}22`,
            color: phase.color,
          }}
        >
          {phase.name}
        </span>
      )}

      {/* Priority badge */}
      {pri && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${pri.bg} ${pri.text}`}>
          {pri.label}
        </span>
      )}

      {/* Date */}
      {task.fechaLimite && (
        <span
          className={`text-[10px] font-mono shrink-0 ${
            isOverdue ? 'text-red-400 font-semibold' : 'text-ink-muted'
          }`}
        >
          {new Date(task.fechaLimite).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      )}

      <ChevronRight
        size={12}
        className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </motion.button>
  );
}
