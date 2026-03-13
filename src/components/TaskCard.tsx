'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle2,
  Circle,
  ExternalLink,
  GripVertical,
  AlertTriangle,
  FileText,
  Tag,
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { NotionTask } from '@/types';
import { PRIORITY_CONFIG, getCategoryColor } from '@/types';

interface TaskCardProps {
  task: NotionTask;
  isDragging?: boolean;
  onToggleComplete?: (id: string, completada: boolean) => void;
  onEditNotes?: (task: NotionTask) => void;
}

function UrgencyBadge({ fechaLimite }: { fechaLimite: string }) {
  const date = new Date(fechaLimite + 'T12:00:00');
  const daysLeft = differenceInDays(date, new Date());

  if (isPast(date) && !isToday(date)) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md">
        <AlertTriangle size={9} />
        Vencida
      </span>
    );
  }
  if (isToday(date)) {
    return (
      <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md">
        Hoy
      </span>
    );
  }
  if (daysLeft <= 3) {
    return (
      <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md">
        {daysLeft}d
      </span>
    );
  }
  if (daysLeft <= 7) {
    return (
      <span className="text-[10px] font-medium text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded-md">
        {daysLeft}d
      </span>
    );
  }
  return null;
}

export function TaskCard({
  task,
  isDragging = false,
  onToggleComplete,
  onEditNotes,
}: TaskCardProps) {
  const [toggling, setToggling] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(task.notas);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConf = task.prioridad ? PRIORITY_CONFIG[task.prioridad] : null;
  const catColor = getCategoryColor(task.categoria);

  const handleToggle = async () => {
    if (toggling || !onToggleComplete) return;
    setToggling(true);
    try {
      await onToggleComplete(task.id, !task.completada);
    } finally {
      setToggling(false);
    }
  };

  const handleSaveNotes = async () => {
    if (onEditNotes) {
      await onEditNotes({ ...task, notas: notesValue });
    }
    setEditingNotes(false);
  };

  const isOverdue =
    task.fechaLimite &&
    !task.completada &&
    isPast(new Date(task.fechaLimite + 'T12:00:00')) &&
    !isToday(new Date(task.fechaLimite + 'T12:00:00'));

  if (isDragging || isSortableDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-40 rounded-xl border border-accent/40 bg-surface-elevated p-3 h-[90px]"
      />
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={clsx(
        'group relative rounded-xl border bg-surface-card p-3 cursor-default',
        'shadow-card hover:shadow-[0_2px_8px_rgba(0,0,0,0.5)] hover:border-edge-bright',
        'transition-shadow duration-150',
        task.completada ? 'border-edge/50 opacity-60' : 'border-edge',
        isOverdue && !task.completada && 'border-red-500/30',
      )}
    >
      {/* Left accent bar (category color) */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ backgroundColor: catColor }}
      />

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 p-0.5 text-ink-muted opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity rounded"
        aria-label="Drag task"
      >
        <GripVertical size={14} />
      </button>

      <div className="pl-2">
        {/* Title row */}
        <div className="flex items-start gap-2 pr-6">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={clsx(
              'mt-0.5 shrink-0 transition-colors',
              task.completada ? 'text-success' : 'text-ink-muted hover:text-ink-secondary',
              toggling && 'animate-pulse-soft',
            )}
            aria-label={task.completada ? 'Mark incomplete' : 'Mark complete'}
          >
            {task.completada ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          </button>

          <span
            className={clsx(
              'text-sm font-medium leading-snug flex-1',
              task.completada ? 'line-through text-ink-muted' : 'text-ink',
            )}
          >
            {task.tarea}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-[23px]">
          {priorityConf && (
            <span
              className={clsx(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                priorityConf.bg,
                priorityConf.text,
              )}
            >
              {priorityConf.label}
            </span>
          )}

          {task.categoria && (
            <span
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{ color: catColor, backgroundColor: catColor + '20' }}
            >
              <Tag size={8} />
              {task.categoria}
            </span>
          )}

          {task.fechaLimite && !task.completada && (
            <UrgencyBadge fechaLimite={task.fechaLimite} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 ml-[23px]">
          {task.fechaLimite ? (
            <span className="flex items-center gap-1 text-[10px] text-ink-muted">
              <Calendar size={9} />
              {format(new Date(task.fechaLimite + 'T12:00:00'), 'd MMM', { locale: es })}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.notas && (
              <button
                onClick={() => setEditingNotes(true)}
                className="p-0.5 text-ink-muted hover:text-ink-secondary rounded"
                title="Ver/editar notas"
              >
                <FileText size={11} />
              </button>
            )}
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-0.5 text-ink-muted hover:text-ink-secondary rounded"
              title="Abrir en Notion"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      {/* Inline notes editor */}
      {editingNotes && (
        <div className="mt-2 ml-[23px]">
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            className="w-full text-xs bg-surface-secondary border border-edge rounded-lg p-2 text-ink-secondary resize-none focus:outline-none focus:border-accent/50"
            rows={3}
            autoFocus
            placeholder="Notas..."
          />
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={handleSaveNotes}
              className="text-[10px] px-2 py-1 bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setNotesValue(task.notas);
                setEditingNotes(false);
              }}
              className="text-[10px] px-2 py-1 text-ink-muted hover:text-ink-secondary rounded transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
