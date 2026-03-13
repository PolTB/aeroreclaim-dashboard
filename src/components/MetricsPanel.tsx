'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, isPast, isToday, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import type { NotionTask } from '@/types';
import { getCategoryColor } from '@/types';

interface MetricsPanelProps {
  tasks: NotionTask[];
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}

function StatCard({ icon, label, value, color, sub }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-edge/60">
      <div className="p-2 rounded-lg" style={{ backgroundColor: color + '20' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-ink tabular-nums">{value}</div>
        <div className="text-xs text-ink-muted truncate">{label}</div>
        {sub && <div className="text-[10px] text-ink-faint">{sub}</div>}
      </div>
    </div>
  );
}

interface UrgentTaskRowProps {
  task: NotionTask;
  rank: number;
}

function UrgentTaskRow({ task, rank }: UrgentTaskRowProps) {
  const daysLeft = task.fechaLimite
    ? differenceInDays(parseISO(task.fechaLimite), new Date())
    : null;
  const overdue = daysLeft !== null && daysLeft < 0;
  const today = daysLeft === 0;

  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-edge/30 last:border-0">
      <span className="text-[10px] font-bold text-ink-faint mt-0.5 w-3 shrink-0">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink truncate leading-snug">{task.tarea}</p>
        {task.fechaLimite && (
          <p
            className={`text-[10px] mt-0.5 ${
              overdue ? 'text-red-400' : today ? 'text-red-400' : daysLeft! <= 3 ? 'text-red-400' : 'text-ink-muted'
            }`}
          >
            {overdue
              ? `Venció hace ${Math.abs(daysLeft!)}d`
              : today
              ? 'Vence hoy'
              : `${format(parseISO(task.fechaLimite), 'd MMM', { locale: es })} — ${daysLeft}d`}
          </p>
        )}
      </div>
    </div>
  );
}

export function MetricsPanel({ tasks }: MetricsPanelProps) {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completadas = tasks.filter((t) => t.completada).length;
    const pendientes = tasks.filter((t) => !t.completada).length;
    const vencidas = tasks.filter(
      (t) =>
        !t.completada &&
        t.fechaLimite &&
        isPast(parseISO(t.fechaLimite)) &&
        !isToday(parseISO(t.fechaLimite)),
    ).length;
    const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

    return { total, completadas, pendientes, vencidas, pct };
  }, [tasks]);

  const urgentTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.completada && t.fechaLimite)
      .sort((a, b) => (a.fechaLimite! < b.fechaLimite! ? -1 : 1))
      .slice(0, 3);
  }, [tasks]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      if (!t.completada && t.categoria) {
        counts[t.categoria] = (counts[t.categoria] ?? 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<ListTodo size={14} />}
          label="Total"
          value={stats.total}
          color="#6366f1"
        />
        <StatCard
          icon={<CheckCircle2 size={14} />}
          label="Completadas"
          value={stats.completadas}
          color="#22c55e"
        />
        <StatCard
          icon={<Clock size={14} />}
          label="Pendientes"
          value={stats.pendientes}
          color="#f59e0b"
        />
        <StatCard
          icon={<AlertCircle size={14} />}
          label="Vencidas"
          value={stats.vencidas}
          color="#ef4444"
        />
      </div>

      {/* Progress bar */}
      <div className="p-3 rounded-xl bg-surface-card border border-edge/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-ink-secondary flex items-center gap-1.5">
            <TrendingUp size={12} className="text-accent" />
            Progreso
          </span>
          <span className="text-sm font-bold text-ink tabular-nums">{stats.pct}%</span>
        </div>
        <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${stats.pct}%`,
              background: `linear-gradient(90deg, #6366f1, #22c55e)`,
            }}
          />
        </div>
        <p className="text-[10px] text-ink-muted mt-1.5">
          {stats.completadas} de {stats.total} tareas completadas
        </p>
      </div>

      {/* Upcoming tasks */}
      {urgentTasks.length > 0 && (
        <div className="p-3 rounded-xl bg-surface-card border border-edge/60">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar size={12} className="text-ink-muted" />
            <span className="text-xs font-medium text-ink-secondary">Próximas urgentes</span>
          </div>
          {urgentTasks.map((task, idx) => (
            <UrgentTaskRow key={task.id} task={task} rank={idx + 1} />
          ))}
        </div>
      )}

      {/* Category distribution */}
      {categoryData.length > 0 && (
        <div className="p-3 rounded-xl bg-surface-card border border-edge/60">
          <p className="text-xs font-medium text-ink-secondary mb-3">Por categoría</p>

          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{
                    backgroundColor: '#1a1a28',
                    border: '1px solid #2a2a3d',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-1 mt-2">
            {categoryData.slice(0, 6).map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] text-ink-muted truncate">{item.name}</span>
                </div>
                <span className="text-[10px] font-medium text-ink-secondary tabular-nums ml-2">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
