'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import type { NotionTask, Priority } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import type { Phase } from './RoadmapTimeline';
import { PHASES } from './RoadmapTimeline';

// ─── Mapping: phase → categories that belong to it ──────────────────────────

const PHASE_CATEGORY_MAP: Record<string, string[]> = {
  infra:     ['Tech/Operaciones', 'Operaciones'],
  mvp:       ['Tech/Operaciones', 'Operaciones', 'SEO/Web'],
  marketing: ['Marketing/Outreach', 'SEO/Contenido', 'SEO', 'Redes Sociales', 'Comunidades'],
  beta:      ['Tech/Operaciones', 'Operaciones', 'Marketing/Outreach'],
  launch:    ['Marketing/Outreach', 'SEO/Contenido', 'Redes Sociales', 'Comunidades', 'SEO'],
};

function getTasksForPhase(tasks: NotionTask[], phaseId: string): NotionTask[] {
  const cats = PHASE_CATEGORY_MAP[phaseId];
  if (!cats) return tasks; // fallback: show all
  return tasks.filter((t) => t.categoria && cats.includes(t.categoria));
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  tasks: NotionTask[];
  activePhase: Phase | null;
  onOpenTask?: (task: NotionTask) => void;
}

export function PhaseBacklog({ tasks, activePhase, onOpenTask }: Props) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Determine which phase to show (prop or auto-detect active)
  const phase = useMemo(() => {
    if (activePhase) return activePhase;
    return PHASES.find((p) => today >= p.start && today < p.end) ?? PHASES[0];
  }, [activePhase, today]);

  const filtered = useMemo(() => getTasksForPhase(tasks, phase.id), [tasks, phase.id]);

  // Split into groups
  const pending = filtered.filter((t) => t.estado === 'Pendiente');
  const inProgress = filtered.filter((t) => t.estado === 'En Progreso');
  const completed = filtered.filter((t) => t.estado === 'Completada');

  const totalCount = filtered.length;
  const doneCount = completed.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Overdue check
  const overdueTasks = filtered.filter(
    (t) => t.fechaLimite && t.fechaLimite < today && t.estado !== 'Completada',
  );

  return (
    <div className="bg-surface-card border border-edge/60 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.color }} />
          <div>
            <h3 className="text-sm font-semibold text-ink">{phase.name}</h3>
            <p className="text-[11px] text-ink-muted mt-0.5">
              {new Date(phase.start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {' — '}
              {new Date(phase.end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {overdueTasks.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
              <AlertTriangle size={12} />
              {overdueTasks.length} atrasada{overdueTasks.length > 1 ? 's' : ''}
            </span>
          )}
          <div className="text-right">
            <span className="text-lg font-bold text-ink">{progress}%</span>
            <p className="text-[10px] text-ink-muted">{doneCount}/{totalCount} tareas</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: phase.color }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Task groups */}
      <div className="flex flex-col gap-4">
        <TaskGroup
          title="En Progreso"
          icon={<Clock size={13} className="text-amber-400" />}
          tasks={inProgress}
          phase={phase}
          onOpenTask={onOpenTask}
        />
        <TaskGroup
          title="Pendiente"
          icon={<Circle size={13} className="text-ink-muted" />}
          tasks={pending}
          phase={phase}
          onOpenTask={onOpenTask}
        />
        <TaskGroup
          title="Completada"
          icon={<CheckCircle2 size={13} className="text-green-400" />}
          tasks={completed}
          phase={phase}
          onOpenTask={onOpenTask}
          collapsed
        />
      </div>

      {totalCount === 0 && (
        <div className="text-center py-8 text-ink-muted text-xs">
          No hay tareas asignadas a esta fase todavía.
        </div>
      )}
    </div>
  );
}

// ─── TaskGroup ───────────────────────────────────────────────────────────────

function TaskGroup({
  title,
  icon,
  tasks,
  phase,
  onOpenTask,
  collapsed = false,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: NotionTask[];
  phase: Phase;
  onOpenTask?: (task: NotionTask) => void;
  collapsed?: boolean;
}) {
  if (tasks.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-ink-secondary">{title}</span>
        <span className="text-[10px] text-ink-muted ml-auto">{tasks.length}</span>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-1.5 overflow-hidden"
          >
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} phase={phase} onOpen={onOpenTask} />
            ))}
          </motion.div>
        )}
        {collapsed && (
          <p className="text-[11px] text-ink-muted pl-5">
            {tasks.length} tarea{tasks.length > 1 ? 's' : ''} completada{tasks.length > 1 ? 's' : ''}
          </p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  phase,
  onOpen,
}: {
  task: NotionTask;
  phase: Phase;
  onOpen?: (task: NotionTask) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.fechaLimite && task.fechaLimite < today && task.estado !== 'Completada';
  const pri = task.prioridad ? PRIORITY_CONFIG[task.prioridad] : null;

  return (
    <motion.button
      onClick={() => {
        if (onOpen) onOpen(task);
        else if (task.url) window.open(task.url, '_blank');
      }}
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-elevated/50 hover:bg-surface-elevated transition-colors text-left w-full group"
    >
      {/* Priority dot */}
      {pri && (
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pri.dot }} />
      )}

      {/* Task name */}
      <span className="text-xs text-ink truncate flex-1">{task.tarea}</span>

      {/* Category badge */}
      {task.categoria && (
        <span className="text-[10px] text-ink-muted bg-surface-card px-1.5 py-0.5 rounded shrink-0">
          {task.categoria}
        </span>
      )}

      {/* Overdue indicator */}
      {isOverdue && (
        <span className="text-[10px] text-red-400 font-medium shrink-0">
          Atrasada
        </span>
      )}

      {/* Deadline */}
      {task.fechaLimite && !isOverdue && (
        <span className="text-[10px] text-ink-muted shrink-0 font-mono">
          {new Date(task.fechaLimite).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
      )}

      <ChevronRight size={12} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.button>
  );
}
