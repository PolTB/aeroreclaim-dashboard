'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  BarChart2,
  RefreshCw,
  Plus,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NotionTask, Filters, UpdateTaskPayload } from '@/types';
import { KanbanBoard } from './KanbanBoard';
import { TimelineView } from './TimelineView';
import { MetricsPanel } from './MetricsPanel';
import { FilterBar } from './FilterBar';
import { CreateTaskModal } from './CreateTaskModal';

type ViewMode = 'kanban' | 'timeline';

export function Dashboard() {
  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEstado, setHasEstado] = useState(true);
  const [view, setView] = useState<ViewMode>('kanban');
  const [showMetrics, setShowMetrics] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [filters, setFilters] = useState<Filters>({
    prioridad: 'all',
    categoria: 'all',
    estado: 'all',
    search: '',
  });

  // ─── Data fetching ────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/notion/tasks');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data: { tasks: NotionTask[]; hasEstado: boolean } = await res.json();
      setTasks(data.tasks);
      setHasEstado(data.hasEstado);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tareas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + 5-min auto-refresh
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => fetchTasks(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // ─── Task mutation ────────────────────────────────────────────────────────────

  const updateTask = useCallback(
    async (id: string, updates: UpdateTaskPayload) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? ({ ...t, ...updates } as NotionTask) : t)),
      );
      try {
        const res = await fetch(`/api/notion/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to update task');
        }
      } catch (err) {
        // Revert optimistic update
        fetchTasks(true);
        throw err;
      }
    },
    [fetchTasks],
  );

  // ─── Filtered tasks ───────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.prioridad !== 'all' && task.prioridad !== filters.prioridad) return false;
      if (filters.categoria !== 'all' && task.categoria !== filters.categoria) return false;
      if (filters.estado !== 'all' && task.estado !== filters.estado) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !task.tarea.toLowerCase().includes(q) &&
          !task.notas.toLowerCase().includes(q) &&
          !(task.categoria ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, filters]);

  const categories = useMemo(
    () =>
      Array.from(new Set(tasks.map((t) => t.categoria).filter(Boolean) as string[])).sort(),
    [tasks],
  );

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
              A
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-surface rounded-full flex items-center justify-center">
              <Loader2 size={10} className="animate-spin text-accent" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-ink-secondary">AeroReclaim Dashboard</p>
            <p className="text-xs text-ink-muted mt-1">Cargando desde Notion...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Top navigation ── */}
      <header className="sticky top-0 z-30 border-b border-edge/50 bg-surface/80 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-glow">
              A
            </div>
            <span className="text-sm font-semibold text-ink hidden sm:block">
              AeroReclaim{' '}
              <span className="text-ink-muted font-normal">Dashboard</span>
            </span>
          </div>

          {/* Center: view toggle */}
          <div className="flex bg-surface-card border border-edge/60 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setView('kanban')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'kanban'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:block">Kanban</span>
            </button>
            <button
              onClick={() => setView('timeline')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'timeline'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              <BarChart2 size={13} />
              <span className="hidden sm:block">Timeline</span>
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Last refresh */}
            <span className="hidden lg:block text-[10px] text-ink-faint">
              {formatDistanceToNow(lastRefresh, { locale: es, addSuffix: true })}
            </span>

            <button
              onClick={() => fetchTasks(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
              title="Actualizar"
            >
              <RefreshCw size={14} className={clsx(refreshing && 'animate-spin text-accent')} />
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-xl transition-colors shadow-sm"
            >
              <Plus size={13} />
              <span className="hidden sm:block">Nueva tarea</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-5">
        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Error cargando tareas</p>
              <p className="text-xs mt-0.5 text-red-400/70">{error}</p>
              <button
                onClick={() => fetchTasks()}
                className="text-xs mt-2 underline underline-offset-2 hover:no-underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-5">
          {/* ── Sidebar: Metrics ── */}
          <AnimatePresence initial={false}>
            {showMetrics && (
              <motion.aside
                key="sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 256, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="shrink-0 overflow-hidden hidden lg:block"
              >
                <div className="w-64">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Métricas
                    </span>
                  </div>
                  <MetricsPanel tasks={tasks} />
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Sidebar toggle */}
          <button
            onClick={() => setShowMetrics((v) => !v)}
            className="hidden lg:flex items-center justify-center w-5 self-start mt-7 text-ink-faint hover:text-ink-muted transition-colors"
            title={showMetrics ? 'Ocultar métricas' : 'Mostrar métricas'}
          >
            <ChevronRight
              size={14}
              className={clsx('transition-transform', showMetrics && 'rotate-180')}
            />
          </button>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0">
            {/* Filters */}
            <div className="mb-4">
              <FilterBar
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
              />
            </div>

            {/* Result count */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-ink-muted">
                {filteredTasks.length === tasks.length ? (
                  <>
                    <span className="font-medium text-ink-secondary">{tasks.length}</span> tareas
                  </>
                ) : (
                  <>
                    <span className="font-medium text-ink-secondary">{filteredTasks.length}</span>{' '}
                    de {tasks.length} tareas
                  </>
                )}
              </p>
            </div>

            {/* Views */}
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {view === 'kanban' ? (
                  <KanbanBoard
                    tasks={filteredTasks}
                    hasEstado={hasEstado}
                    onUpdateTask={updateTask}
                    onTasksChange={setTasks}
                  />
                ) : (
                  <TimelineView tasks={filteredTasks} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile metrics strip */}
        <div className="lg:hidden mt-6 border-t border-edge/40 pt-5">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
            Métricas
          </p>
          <MetricsPanel tasks={tasks} />
        </div>
      </div>

      {/* Create task modal */}
      {isCreateOpen && (
        <CreateTaskModal
          categories={categories}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            fetchTasks(true);
          }}
        />
      )}
    </div>
  );
}
