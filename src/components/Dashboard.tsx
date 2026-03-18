'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, BarChart2, Terminal, Settings, RefreshCw, Plus,
  AlertCircle, Loader2, ChevronRight, Sun, Moon, Briefcase,
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
import { CommandCenter } from './CommandCenter';
import { AgentStatusPanel } from './AgentStatusPanel';
import { QuickInbox } from './QuickInbox';
import { CaseTracker } from './CaseTracker';

type ViewMode = 'kanban' | 'timeline' | 'commands' | 'cases' | 'settings';

const NAV_ITEMS: { id: ViewMode; label: string; icon: React.ReactNode; shortLabel: string }[] = [
  { id: 'kanban',    label: 'Kanban',    shortLabel: 'Kanban',    icon: <LayoutGrid size={13} /> },
  { id: 'timeline',  label: 'Timeline',  shortLabel: 'Timeline',  icon: <BarChart2 size={13} /> },
  { id: 'commands',  label: 'Delegaciones',  shortLabel: 'Deleg',      icon: <Terminal size={13} /> },
  { id: 'cases',     label: 'Cases',     shortLabel: 'Cases',     icon: <Briefcase size={13} /> },
  { id: 'settings',  label: 'Settings',  shortLabel: 'Config',    icon: <Settings size={13} /> },
];

// ─── Settings panel ──────────────────────────────────────────────────────────

function SettingsPanel({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <div className="max-w-md flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">Configuración</h2>
      <div className="bg-surface-card border border-edge/60 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Tema</p>
          <p className="text-xs text-ink-muted mt-0.5">Cambia entre modo oscuro y claro</p>
        </div>
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-edge/60 rounded-lg text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {isDark ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </div>
      <div className="bg-surface-card border border-edge/60 rounded-xl p-4">
        <p className="text-sm font-medium text-ink mb-1">Base de datos Notion</p>
        <p className="text-xs text-ink-muted">
          DB Tasks: <code className="font-mono text-accent bg-surface-elevated px-1 rounded">abb1607fb6b0460782fc0d268a7ce21f</code>
        </p>
        <p className="text-xs text-ink-muted mt-1">
          DB Delegaciones: configurar <code className="font-mono text-accent bg-surface-elevated px-1 rounded">COMMANDS_DATABASE_ID</code> en Vercel
        </p>
        <p className="text-xs text-ink-muted mt-1">
          Auth: <code className="font-mono text-accent bg-surface-elevated px-1 rounded">BASIC_AUTH_USER</code> / <code className="font-mono text-accent bg-surface-elevated px-1 rounded">BASIC_AUTH_PASSWORD</code>
        </p>
        <p className="text-xs text-ink-muted mt-1">
          Google Sheets (Cases): <code className="font-mono text-accent bg-surface-elevated px-1 rounded">GOOGLE_SHEETS_SPREADSHEET_ID</code> + <code className="font-mono text-accent bg-surface-elevated px-1 rounded">GOOGLE_SHEETS_API_KEY</code>
        </p>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEstado, setHasEstado] = useState(true);
  const [view, setView] = useState<ViewMode>('kanban');
  const [showSidebar, setShowSidebar] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isDark, setIsDark] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    prioridad: 'all',
    categoria: 'all',
    estado: 'all',
    search: '',
  });

  // Theme management
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  // Data fetching
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

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => fetchTasks(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const updateTask = useCallback(
    async (id: string, updates: UpdateTaskPayload) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? ({ ...t, ...updates } as NotionTask) : t)));
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
      } catch {
        fetchTasks(true);
      }
    },
    [fetchTasks],
  );

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
        ) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const categories = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.categoria).filter(Boolean) as string[])).sort(),
    [tasks],
  );

  const showTaskViews = view === 'kanban' || view === 'timeline';
  const showFullWidth = view === 'commands' || view === 'cases' || view === 'settings';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">A</div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-surface rounded-full flex items-center justify-center">
              <Loader2 size={10} className="animate-spin text-accent" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-ink-secondary">AeroReclaim Mission Control</p>
            <p className="text-xs text-ink-muted mt-1">Cargando desde Notion...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Top navigation */}
      <header className="sticky top-0 z-30 border-b border-edge/50 bg-surface/80 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-glow">A</div>
            <span className="text-sm font-semibold text-ink hidden sm:block">
              AeroReclaim <span className="text-ink-muted font-normal">Mission Control</span>
            </span>
          </div>

          {/* Center: 4-tab navigation */}
          <div className="flex bg-surface-card border border-edge/60 rounded-xl p-1 gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view === item.id ? 'bg-accent text-white shadow-sm' : 'text-ink-muted hover:text-ink-secondary',
                )}
              >
                {item.icon}
                <span className="hidden sm:block">{item.label}</span>
                <span className="sm:hidden">{item.shortLabel}</span>
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <span className="hidden lg:block text-[10px] text-ink-faint">
              {formatDistanceToNow(lastRefresh, { locale: es, addSuffix: true })}
            </span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            {showTaskViews && (
              <button
                onClick={() => fetchTasks(true)}
                disabled={refreshing}
                className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
                title="Actualizar"
              >
                <RefreshCw size={14} className={clsx(refreshing && 'animate-spin text-accent')} />
              </button>
            )}
            {showTaskViews && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-xl transition-colors shadow-sm"
              >
                <Plus size={13} />
                <span className="hidden sm:block">Nueva tarea</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-5">
        {/* Error banner */}
        {error && showTaskViews && (
          <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Error cargando tareas</p>
              <p className="text-xs mt-0.5 text-red-400/70">{error}</p>
              <button onClick={() => fetchTasks()} className="text-xs mt-2 underline underline-offset-2 hover:no-underline">Reintentar</button>
            </div>
          </div>
        )}

        {/* Commands / Cases / Settings: full width */}
        {showFullWidth && (
          <AnimatePresence mode="wait">
            {view === 'commands' && (
              <motion.div key="commands" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <CommandCenter />
              </motion.div>
            )}
            {view === 'cases' && (
              <motion.div key="cases" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <CaseTracker />
              </motion.div>
            )}
            {view === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <SettingsPanel isDark={isDark} onToggle={toggleTheme} />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Kanban / Timeline: sidebar + main */}
        {showTaskViews && (
          <div className="flex gap-5">
            {/* Sidebar */}
            <AnimatePresence initial={false}>
              {showSidebar && (
                <motion.aside
                  key="sidebar"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 256, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="shrink-0 overflow-hidden hidden lg:block"
                >
                  <div className="w-64 flex flex-col gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Métricas</span>
                      </div>
                      <MetricsPanel tasks={tasks} />
                    </div>
                    <AgentStatusPanel />
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Sidebar toggle */}
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="hidden lg:flex items-center justify-center w-5 self-start mt-7 text-ink-faint hover:text-ink-muted transition-colors"
              title={showSidebar ? 'Ocultar sidebar' : 'Mostrar sidebar'}
            >
              <ChevronRight size={14} className={clsx('transition-transform', showSidebar && 'rotate-180')} />
            </button>

            {/* Main content */}
            <main className="flex-1 min-w-0">
              {/* Quick Inbox — only in kanban view */}
              {view === 'kanban' && (
                <QuickInbox onTaskCreated={() => fetchTasks(true)} />
              )}

              {/* Filters */}
              <div className="mb-4">
                <FilterBar filters={filters} onFiltersChange={setFilters} categories={categories} />
              </div>

              {/* Result count */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-ink-muted">
                  {filteredTasks.length === tasks.length ? (
                    <><span className="font-medium text-ink-secondary">{tasks.length}</span> tareas</>
                  ) : (
                    <><span className="font-medium text-ink-secondary">{filteredTasks.length}</span> de {tasks.length} tareas</>
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
                    <KanbanBoard tasks={filteredTasks} hasEstado={hasEstado} onUpdateTask={updateTask} onTasksChange={setTasks} />
                  ) : (
                    <TimelineView tasks={filteredTasks} />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        )}

        {/* Mobile metrics strip */}
        {showTaskViews && (
          <div className="lg:hidden mt-6 border-t border-edge/40 pt-5 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Métricas</p>
              <MetricsPanel tasks={tasks} />
            </div>
            <AgentStatusPanel />
          </div>
        )}
      </div>

      {isCreateOpen && (
        <CreateTaskModal
          categories={categories}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => { setIsCreateOpen(false); fetchTasks(true); }}
        />
      )}
    </div>
  );
}
