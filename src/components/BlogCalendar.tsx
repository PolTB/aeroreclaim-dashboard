'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, List, ChevronLeft, ChevronRight, RefreshCw,
  ExternalLink, AlertCircle, Loader2, Filter,
} from 'lucide-react';
import clsx from 'clsx';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday,
  addMonths, subMonths, parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { BlogEntry, BlogEstado } from '@/types';
import { BLOG_ESTADO_CONFIG } from '@/types';

// ─── Estado badge ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: BlogEstado }) {
  const cfg = BLOG_ESTADO_CONFIG[estado];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ entries }: { entries: BlogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarDays size={32} className="text-ink-faint mb-3" />
        <p className="text-sm text-ink-secondary">No hay artículos que coincidan con los filtros</p>
      </div>
    );
  }

  // Group by month
  const grouped: Record<string, BlogEntry[]> = {};
  for (const e of entries) {
    const key = e.fechaPublicacion
      ? format(parseISO(e.fechaPublicacion), 'MMMM yyyy', { locale: es })
      : 'Sin fecha';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(grouped).map(([month, items]) => (
        <div key={month}>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2 capitalize">
            {month}
          </h3>
          <div className="bg-surface-card border border-edge/60 rounded-xl overflow-hidden">
            {items.map((entry, idx) => (
              <div
                key={entry.id}
                className={clsx(
                  'flex items-start gap-3 px-4 py-3 hover:bg-surface-elevated/50 transition-colors',
                  idx !== 0 && 'border-t border-edge/30',
                )}
              >
                {/* Date block */}
                <div className="shrink-0 w-10 text-center pt-0.5">
                  {entry.fechaPublicacion ? (
                    <>
                      <p className="text-[10px] text-ink-muted capitalize leading-tight">
                        {format(parseISO(entry.fechaPublicacion), 'EEE', { locale: es })}
                      </p>
                      <p className="text-xl font-bold text-ink leading-none">
                        {format(parseISO(entry.fechaPublicacion), 'd')}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-ink-faint">—</p>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-ink truncate">
                      {entry.titulo || '(Sin título)'}
                    </p>
                    {entry.estado === 'Publicado' && entry.urlBlog && (
                      <a
                        href={entry.urlBlog}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-hover transition-colors shrink-0"
                        title="Ver artículo"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <EstadoBadge estado={entry.estado} />
                    {entry.tag && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-elevated border border-edge/40 text-ink-secondary">
                        {entry.tag}
                      </span>
                    )}
                    {entry.keyword && (
                      <span className="text-[10px] text-ink-faint font-mono">
                        kw: {entry.keyword}
                      </span>
                    )}
                  </div>
                  {entry.notas && (
                    <p className="text-xs text-ink-muted mt-1 truncate">{entry.notas}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function CalendarView({ entries, currentMonth }: { entries: BlogEntry[]; currentMonth: Date }) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const entriesByDate: Record<string, BlogEntry[]> = {};
  for (const e of entries) {
    if (!e.fechaPublicacion) continue;
    const key = e.fechaPublicacion.slice(0, 10);
    if (!entriesByDate[key]) entriesByDate[key] = [];
    entriesByDate[key].push(e);
  }

  return (
    <div className="bg-surface-card border border-edge/60 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-edge/40">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[10px] font-semibold text-ink-muted uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEntries = entriesByDate[key] ?? [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <div
              key={i}
              className={clsx(
                'min-h-[80px] p-1.5 border-b border-r border-edge/20 last:border-r-0',
                !inMonth && 'opacity-30',
                today && 'bg-accent/5',
              )}
            >
              <span
                className={clsx(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1',
                  today ? 'bg-accent text-white' : 'text-ink-secondary',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEntries.slice(0, 2).map((e) => {
                  const cfg = BLOG_ESTADO_CONFIG[e.estado];
                  return (
                    <div
                      key={e.id}
                      className="rounded px-1 py-0.5 text-[9px] font-medium leading-tight truncate cursor-default"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      title={`${e.titulo} — ${e.estado}`}
                    >
                      {e.titulo || '(Sin título)'}
                    </div>
                  );
                })}
                {dayEntries.length > 2 && (
                  <span className="text-[9px] text-ink-faint px-1">
                    +{dayEntries.length - 2} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main BlogCalendar ────────────────────────────────────────────────────────

type BlogView = 'list' | 'calendar';

const ESTADOS: BlogEstado[] = ['Publicado', 'Listo', 'Redactando', 'Pendiente DEL', 'Cancelado'];

export function BlogCalendar() {
  const [entries, setEntries] = useState<BlogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<BlogView>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterEstado, setFilterEstado] = useState<BlogEstado | 'all'>('all');
  const [filterTag, setFilterTag] = useState<string>('all');

  const fetchEntries = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notion/blog');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data: { entries: BlogEntry[] } = await res.json();
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el calendario');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const allTags = Array.from(
    new Set(entries.map((e) => e.tag).filter(Boolean) as string[]),
  ).sort();

  const filtered = entries.filter((e) => {
    if (filterEstado !== 'all' && e.estado !== filterEstado) return false;
    if (filterTag !== 'all' && e.tag !== filterTag) return false;
    return true;
  });

  // Stats per estado
  const stats = ESTADOS.reduce<Record<string, number>>((acc, e) => {
    acc[e] = entries.filter((en) => en.estado === e).length;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-ink-secondary">
          <Loader2 size={16} className="animate-spin text-accent" />
          <span className="text-sm">Cargando calendario editorial...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Calendario Editorial</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {entries.length} artículos en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchEntries(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
            title="Actualizar"
          >
            <RefreshCw size={14} className={clsx(refreshing && 'animate-spin text-accent')} />
          </button>
          {/* View toggle */}
          <div className="flex bg-surface-card border border-edge/60 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setView('list')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'list'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              <List size={12} />
              Lista
            </button>
            <button
              onClick={() => setView('calendar')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'calendar'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              <CalendarDays size={12} />
              Mes
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip — clickable filters */}
      <div className="flex flex-wrap gap-2">
        {ESTADOS.filter((e) => stats[e] > 0).map((estado) => {
          const cfg = BLOG_ESTADO_CONFIG[estado];
          const active = filterEstado === estado;
          return (
            <button
              key={estado}
              onClick={() => setFilterEstado(active ? 'all' : estado)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all',
                active ? 'border-current shadow-sm' : 'border-edge/40 bg-surface-card hover:border-current/40',
              )}
              style={{ color: cfg.color, backgroundColor: active ? cfg.bg : undefined }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
              {cfg.label}
              <span className="font-bold ml-0.5">{stats[estado]}</span>
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Filter size={12} />
          <span>Filtrar:</span>
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value as BlogEstado | 'all')}
          className="bg-surface-card border border-edge/60 rounded-lg px-2.5 py-1.5 text-xs text-ink-secondary appearance-none cursor-pointer hover:border-edge transition-colors"
        >
          <option value="all">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-surface-card border border-edge/60 rounded-lg px-2.5 py-1.5 text-xs text-ink-secondary appearance-none cursor-pointer hover:border-edge transition-colors"
          >
            <option value="all">Todos los tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        {(filterEstado !== 'all' || filterTag !== 'all') && (
          <button
            onClick={() => { setFilterEstado('all'); setFilterTag('all'); }}
            className="text-xs text-ink-muted hover:text-ink-secondary underline underline-offset-2"
          >
            Limpiar
          </button>
        )}
        {filtered.length !== entries.length && (
          <span className="text-xs text-ink-faint">
            ({filtered.length} de {entries.length})
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-sm text-red-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Error cargando calendario</p>
            <p className="text-xs mt-0.5 text-red-400/70">{error}</p>
            <button
              onClick={() => fetchEntries()}
              className="text-xs mt-2 underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Calendar month navigator (only for calendar view) */}
      {view === 'calendar' && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-2 rounded-lg hover:bg-surface-card border border-transparent hover:border-edge/40 text-ink-muted hover:text-ink-secondary transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-medium text-ink capitalize min-w-[130px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-2 rounded-lg hover:bg-surface-card border border-transparent hover:border-edge/40 text-ink-muted hover:text-ink-secondary transition-all"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="text-xs text-ink-muted hover:text-ink-secondary transition-colors ml-1"
          >
            Hoy
          </button>
        </div>
      )}

      {/* Content */}
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {view === 'list' ? (
          <ListView entries={filtered} />
        ) : (
          <CalendarView entries={filtered} currentMonth={currentMonth} />
        )}
      </motion.div>
    </motion.div>
  );
}
