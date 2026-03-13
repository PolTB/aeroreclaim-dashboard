'use client';

import { useMemo } from 'react';
import {
  addDays,
  differenceInDays,
  format,
  startOfDay,
  endOfDay,
  isPast,
  isToday,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle } from 'lucide-react';
import type { NotionTask } from '@/types';
import { getCategoryColor } from '@/types';

interface TimelineViewProps {
  tasks: NotionTask[];
}

const ROW_HEIGHT = 38;
const LABEL_WIDTH = 200;
const BAR_PADDING = 6;
const TASK_START_DAYS_BEFORE = 7; // assume tasks start 7 days before deadline

export function TimelineView({ tasks }: TimelineViewProps) {
  const tasksWithDate = useMemo(
    () => tasks.filter((t) => t.fechaLimite).sort((a, b) => (a.fechaLimite! < b.fechaLimite! ? -1 : 1)),
    [tasks],
  );

  const tasksNoDate = useMemo(
    () => tasks.filter((t) => !t.fechaLimite),
    [tasks],
  );

  const today = startOfDay(new Date());

  // Calculate date range
  const { minDate, maxDate } = useMemo(() => {
    if (tasksWithDate.length === 0) {
      return { minDate: today, maxDate: addDays(today, 30) };
    }
    const deadlines = tasksWithDate.map((t) => parseISO(t.fechaLimite!));
    const earliest = deadlines.reduce((a, b) => (a < b ? a : b));
    const latest = deadlines.reduce((a, b) => (a > b ? a : b));
    return {
      minDate: startOfDay(addDays(earliest, -TASK_START_DAYS_BEFORE - 4)),
      maxDate: endOfDay(addDays(latest, 6)),
    };
  }, [tasksWithDate, today]);

  const totalDays = differenceInDays(maxDate, minDate) + 1;
  const SVG_WIDTH = Math.max(totalDays * 28, 600);
  const SVG_HEIGHT = tasksWithDate.length * ROW_HEIGHT + 48;

  const dateToX = (date: Date) => {
    const days = differenceInDays(startOfDay(date), minDate);
    return (days / totalDays) * SVG_WIDTH;
  };

  const todayX = dateToX(today);

  // Generate tick marks (every 7 days)
  const ticks = useMemo(() => {
    const result: Date[] = [];
    let d = minDate;
    while (d <= maxDate) {
      result.push(d);
      d = addDays(d, 7);
    }
    return result;
  }, [minDate, maxDate]);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-muted text-sm">
        No hay tareas para mostrar
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-edge bg-surface-card overflow-hidden">
      <div className="p-4 border-b border-edge/60">
        <h2 className="text-sm font-semibold text-ink-secondary">Timeline de tareas</h2>
        {tasksNoDate.length > 0 && (
          <p className="text-xs text-ink-muted mt-0.5">
            {tasksNoDate.length} tarea(s) sin fecha no se muestran aquí
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: LABEL_WIDTH + SVG_WIDTH }}>
          {/* Task labels (sticky-ish) */}
          <div
            className="shrink-0 border-r border-edge/40 bg-surface-card z-10"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Header spacer */}
            <div style={{ height: 40 }} />
            {tasksWithDate.map((task) => {
              const overdue =
                task.fechaLimite &&
                !task.completada &&
                isPast(parseISO(task.fechaLimite)) &&
                !isToday(parseISO(task.fechaLimite));
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 border-b border-edge/20"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: getCategoryColor(task.categoria) }}
                  />
                  <span
                    className={`text-xs truncate ${
                      task.completada
                        ? 'line-through text-ink-muted'
                        : overdue
                        ? 'text-red-400'
                        : 'text-ink-secondary'
                    }`}
                  >
                    {task.tarea}
                  </span>
                  {overdue && <AlertCircle size={10} className="text-red-400 shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* SVG timeline */}
          <div className="overflow-x-auto flex-1">
            <svg
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              className="block"
              style={{ minWidth: SVG_WIDTH }}
            >
              {/* Background grid */}
              {ticks.map((tick, i) => {
                const x = dateToX(tick);
                return (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={SVG_HEIGHT}
                      stroke="#2a2a3d"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                    <text
                      x={x + 4}
                      y={16}
                      fill="#55556a"
                      fontSize={10}
                      fontFamily="Inter, sans-serif"
                    >
                      {format(tick, 'd MMM', { locale: es })}
                    </text>
                  </g>
                );
              })}

              {/* Today line */}
              {todayX >= 0 && todayX <= SVG_WIDTH && (
                <g>
                  <line
                    x1={todayX}
                    y1={0}
                    x2={todayX}
                    y2={SVG_HEIGHT}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                  />
                  <text
                    x={todayX + 4}
                    y={30}
                    fill="#6366f1"
                    fontSize={9}
                    fontFamily="Inter, sans-serif"
                    fontWeight="600"
                  >
                    Hoy
                  </text>
                </g>
              )}

              {/* Task bars */}
              {tasksWithDate.map((task, idx) => {
                const deadline = parseISO(task.fechaLimite!);
                const startDate = addDays(deadline, -TASK_START_DAYS_BEFORE);
                const x1 = Math.max(0, dateToX(startDate));
                const x2 = dateToX(deadline);
                const barWidth = Math.max(x2 - x1, 8);
                const y = 40 + idx * ROW_HEIGHT + BAR_PADDING;
                const barHeight = ROW_HEIGHT - BAR_PADDING * 2;
                const color = getCategoryColor(task.categoria);
                const isOverdue =
                  !task.completada &&
                  isPast(deadline) &&
                  !isToday(deadline);

                return (
                  <g key={task.id}>
                    {/* Bar background (full span) */}
                    <rect
                      x={x1}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill={task.completada ? '#22223a' : color + '25'}
                      stroke={task.completada ? '#2a2a3d' : isOverdue ? '#ef4444' : color + '70'}
                      strokeWidth={1}
                    />

                    {/* Progress fill (100% if complete, 0% if overdue, proportional otherwise) */}
                    {!task.completada && !isOverdue && (
                      <rect
                        x={x1}
                        y={y}
                        width={Math.min(
                          barWidth,
                          (differenceInDays(today, startDate) / TASK_START_DAYS_BEFORE) * barWidth,
                        )}
                        height={barHeight}
                        rx={4}
                        fill={color + '50'}
                      />
                    )}

                    {task.completada && (
                      <rect
                        x={x1}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx={4}
                        fill={color + '40'}
                      />
                    )}

                    {/* Deadline dot */}
                    <circle
                      cx={x2}
                      cy={y + barHeight / 2}
                      r={4}
                      fill={isOverdue ? '#ef4444' : task.completada ? '#22c55e' : color}
                    />

                    {/* Deadline label */}
                    <text
                      x={x2 + 8}
                      y={y + barHeight / 2 + 4}
                      fill={isOverdue ? '#ef4444' : '#55556a'}
                      fontSize={9}
                      fontFamily="Inter, sans-serif"
                    >
                      {format(deadline, 'd/M', { locale: es })}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-edge/40 flex flex-wrap gap-3">
        {[
          { color: '#6366f1', label: 'En curso', type: 'bar' },
          { color: '#22c55e', label: 'Completada', type: 'bar' },
          { color: '#ef4444', label: 'Vencida', type: 'bar' },
          { color: '#6366f1', label: 'Hoy', type: 'line' },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-ink-muted">
            {item.type === 'line' ? (
              <span className="w-4 h-px block" style={{ backgroundColor: item.color }} />
            ) : (
              <span
                className="w-3 h-2 rounded-sm block"
                style={{ backgroundColor: item.color + '60', border: `1px solid ${item.color}80` }}
              />
            )}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
