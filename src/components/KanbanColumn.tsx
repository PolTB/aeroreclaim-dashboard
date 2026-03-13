'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { NotionTask, KanbanColumnDef } from '@/types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  column: KanbanColumnDef;
  tasks: NotionTask[];
  onToggleComplete: (id: string, completada: boolean) => void;
  onEditNotes: (task: NotionTask) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onToggleComplete,
  onEditNotes,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-h-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-sm font-semibold text-ink-secondary">{column.title}</span>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-ink-muted"
          style={{ borderColor: column.color + '30' }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 flex flex-col gap-2 min-h-48 rounded-xl border p-3 transition-all duration-150',
          isOver
            ? 'border-accent/60 bg-accent/5 shadow-glow'
            : 'border-edge/60 bg-surface-secondary/40',
        )}
        style={isOver ? { borderColor: column.color + '80', backgroundColor: column.color + '08' } : {}}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onEditNotes={onEditNotes}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-ink-faint select-none">
            Arrastra aquí
          </div>
        )}
      </div>
    </div>
  );
}
