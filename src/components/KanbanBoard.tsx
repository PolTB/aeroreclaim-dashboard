'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { AlertTriangle } from 'lucide-react';
import type { NotionTask, Estado, UpdateTaskPayload } from '@/types';
import { KANBAN_COLUMNS } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';

interface KanbanBoardProps {
  tasks: NotionTask[];
  hasEstado: boolean;
  onUpdateTask: (id: string, updates: UpdateTaskPayload) => Promise<void>;
  onTasksChange: (tasks: NotionTask[]) => void;
}

export function KanbanBoard({
  tasks,
  hasEstado,
  onUpdateTask,
  onTasksChange,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<NotionTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const getColumnTasks = useCallback(
    (estado: Estado) => tasks.filter((t) => t.estado === estado),
    [tasks],
  );

  const findTaskEstado = useCallback(
    (taskId: string): Estado | null => {
      const task = tasks.find((t) => t.id === taskId);
      return task?.estado ?? null;
    },
    [tasks],
  );

  /** Resolve whether the `over` id is a column id or a task id, returning the target column */
  const resolveTargetColumn = useCallback(
    (overId: string): Estado | null => {
      if (KANBAN_COLUMNS.find((c) => c.id === overId)) return overId as Estado;
      return findTaskEstado(overId);
    },
    [findTaskEstado],
  );

  // Live reorder while dragging (visual only — no API call)
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeEstado = findTaskEstado(activeId);
      const targetEstado = resolveTargetColumn(overId);

      if (!activeEstado || !targetEstado || activeEstado === targetEstado) return;

      onTasksChange(
        tasks.map((t) => (t.id === activeId ? { ...t, estado: targetEstado } : t)),
      );
    },
    [tasks, findTaskEstado, resolveTargetColumn, onTasksChange],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const targetEstado = resolveTargetColumn(overId);
    const sourceEstado = findTaskEstado(activeId);

    if (!targetEstado || !sourceEstado) return;

    // Handle reorder within same column
    if (sourceEstado === targetEstado) {
      const colTasks = getColumnTasks(sourceEstado);
      const oldIndex = colTasks.findIndex((t) => t.id === activeId);
      const newIndex = colTasks.findIndex((t) => t.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(colTasks, oldIndex, newIndex);
        const other = tasks.filter((t) => t.estado !== sourceEstado);
        onTasksChange([...other, ...reordered]);
      }
      return;
    }

    // Cross-column drop → persist to Notion
    const updates: UpdateTaskPayload = {
      estado: targetEstado,
      completada: targetEstado === 'Completada',
    };

    onTasksChange(
      tasks.map((t) =>
        t.id === activeId ? { ...t, estado: targetEstado, completada: updates.completada! } : t,
      ),
    );

    try {
      await onUpdateTask(activeId, updates);
    } catch {
      // revert is handled by the parent (refetch)
    }
  };

  return (
    <div>
      {!hasEstado && (
        <div className="mb-4 flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/8 border border-yellow-500/20 rounded-xl p-3">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Para 3 columnas completas, añade una propiedad{' '}
            <strong className="font-semibold">Estado</strong> (Select) en tu base de datos
            Notion con opciones:{' '}
            <em>&ldquo;Pendiente&rdquo;, &ldquo;En Progreso&rdquo;, &ldquo;Completada&rdquo;</em>.
            Por ahora las tareas se clasifican por el campo <em>Completada</em>.
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getColumnTasks(column.id)}
              onToggleComplete={(id, completada) =>
                onUpdateTask(id, {
                  completada,
                  estado: completada ? 'Completada' : 'Pendiente',
                })
              }
              onEditNotes={(task) =>
                onUpdateTask(task.id, { notas: task.notas })
              }
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeTask ? (
            <div className="opacity-95 rotate-1 scale-105">
              <TaskCard task={activeTask} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
