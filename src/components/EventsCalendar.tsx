'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, ChevronLeft, ChevronRight, RefreshCw,
  AlertCircle, Loader2, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday,
  addMonths, subMonths, parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { BlogEntry, AeroCaso, NotionTask } from '@/types';

// ─── Unified event type ───────────────────────────────────────────────────────

type EventType = 'blog' | 'legal' | 'tarea';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  type: EventType;
  link?: string | null;
  subtitle?: string;
}

const EVENT_CONFIG: Record<EventType, { label: string; color: string; bg: string; dot: string }> = {
  blog:   { label: 'Blog',   color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', dot: '#a78bfa' },
  legal:  { label: 'Legal',  color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  dot: '#3b82f6' },
  tarea:  { label: 'Tarea',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  dot: '#f59e0b' },
};

// ─── Data fetching helpers ────────────────────────────────────────────────────

async function fetchBlogEvents(): Promise<CalendarEvent[]> {
  const res = await fetch('/api/notion/blog');
  if (!res.ok) throw new Error(`Blog API ${res.status}`);
  const data: { entries: BlogEntry[] } = await res.json();
  return data.entries
    .filter((e) => e.fechaPublicacion)
    .map((e) => ({
      id: `blog-${e.id}`,
      title: e.titulo || '(Sin título)',
      date: e.fechaPublicacion!.slice(0, 10),
      type: 'blog' as const,
      link: e.urlBlog,
      subtitle: e.estado,
    }));
}

async function fetchLegalEvents(): Promise<CalendarEvent[]> {
  const res = await fetch('/api/cases');
  if (!res.ok) throw new Error(`Cases API ${res.status}`);
  const data: { cases: AeroCaso[] } | AeroCaso[] = await res.json();
  const cases: AeroCaso[] = Array.isArray(data) ? data : (data as { cases: AeroCaso[] }).cases;
  return cases
    .filter((c) => c.fecha)
    .map((c) => ({
      id: `legal-${c.id}`,
      title: `${c.pasajero} — ${c.vuelo}`,
      date: c.fecha.slice(0, 10),
      type: 'legal' as const,
      subtitle: c.estadoActual,
    }));
}

async function fetchTaskEvents(): Promise<CalendarEvent[]> {
  const res = await fetch('/api/notion/tasks');
  if (!res.ok) throw new Error(`Tasks API ${res.status}`);
  const data: { tasks: NotionTask[] } = await res.json();
  return data.tasks
    .filter((t) => t.fechaLimite)
    .map((t) => ({
      id: `tarea-${t.id}`,
      title: t.tarea || '(Sin título)',
      date: t.fechaLimite!.slice(0, 10),
      type: 'tarea' as const,
      link: t.url,
      subtitle: t.estado,
    }));
}

// ─── Event chip (used in calendar cells) ─────────────────────────────────────

function EventChip({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (e: React.MouseEvent, event: CalendarEvent) => void;
}) {
  const cfg = EVENT_CONFIG[event.type];
  return (
    <button
      onClick={(e) => onClick(e, event)}
      className="w-full text-left rounded px-1 py-0.5 text-[9px] font-medium leading-tight truncate transition-opacity hover:opacity-80"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
      title={`${event.title}${event.subtitle ? ` — ${event.subtitle}` : ''}`}
    >
      {event.title}
    </button>
  );
}

// ─── Popover ──────────────────────────────────────────────────────────────────

function EventPopover({
  event,
  anchor,
  onClose,
}: {
  event: CalendarEvent;
  anchor: { x: number; y: number };
  onClose: () => void;
}) {
  const cfg = EVENT_CONFIG[event.type];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface-card border border-edge/60 rounded-xl shadow-lg p-3 w-56"
      style={{ top: anchor.y + 8, left: anchor.x }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: cfg.dot }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink leading-snug">{event.title}</p>
          {event.subtitle && (
            <p className="text-[10px] text-ink-muted mt-0.5">{event.subtitle}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
              style={{ color: cfg.color, backgroundColor: cfg.bg }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
              {cfg.label}
            </span>
            {event.link && (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover transition-colors"
              >
                Ver <ExternalLink size={10} />
              </a>
            )}
          </div>
          <p className="text-[10px] text-ink-faint mt-1.5">
            {format(parseISO(event.date), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function CalendarGrid({
  events,
  currentMonth,
  activeTypes,
  onEventClick,
}: {
  events: CalendarEvent[];
  currentMonth: Date;
  activeTypes: Set<EventType>;
  onEventClick: (e: React.MouseEvent, event: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const filtered = events.filter((e) => activeTypes.has(e.type));

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const ev of filtered) {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
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
          const dayEvents = byDate[key] ?? [];
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
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={onEventClick} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[9px] text-ink-faint px-1">
                    +{dayEvents.length - 3} más
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

// ─── Main EventsCalendar ──────────────────────────────────────────────────────

const ALL_TYPES: EventType[] = ['blog', 'legal', 'tarea'];

export function EventsCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(ALL_TYPES));
  const [popover, setPopover] = useState<{ event: CalendarEvent; anchor: { x: number; y: number } } | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setErrors([]);

    const results = await Promise.allSettled([
      fetchBlogEvents(),
      fetchLegalEvents(),
      fetchTaskEvents(),
    ]);

    const merged: CalendarEvent[] = [];
    const errs: string[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') merged.push(...r.value);
      else errs.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }

    setEvents(merged);
    if (errs.length) setErrors(errs);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function toggleType(type: EventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function handleEventClick(e: React.MouseEvent, event: CalendarEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ event, anchor: { x: rect.left, y: rect.bottom } });
  }

  // Count events per type in current month
  const monthStr = format(currentMonth, 'yyyy-MM');
  const counts = ALL_TYPES.reduce<Record<EventType, number>>((acc, t) => {
    acc[t] = events.filter((e) => e.type === t && e.date.startsWith(monthStr)).length;
    return acc;
  }, {} as Record<EventType, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-ink-secondary">
          <Loader2 size={16} className="animate-spin text-accent" />
          <span className="text-sm">Cargando eventos...</span>
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
          <h2 className="text-base font-semibold text-ink">Calendario de Eventos</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {events.length} eventos en total
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
          title="Actualizar"
        >
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin text-accent')} />
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {ALL_TYPES.map((type) => {
          const cfg = EVENT_CONFIG[type];
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all',
                active ? 'border-current shadow-sm' : 'border-edge/40 bg-surface-card opacity-50 hover:opacity-70',
              )}
              style={{ color: cfg.color, backgroundColor: active ? cfg.bg : undefined }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
              {cfg.label}
              <span className="font-bold ml-0.5">{counts[type]}</span>
            </button>
          );
        })}
      </div>

      {/* Errors (partial) */}
      {errors.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-xs">Algunos datos no se cargaron</p>
            {errors.map((e, i) => (
              <p key={i} className="text-[10px] mt-0.5 text-yellow-400/70">{e}</p>
            ))}
          </div>
        </div>
      )}

      {/* Month navigator */}
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

      {/* Calendar */}
      <CalendarGrid
        events={events}
        currentMonth={currentMonth}
        activeTypes={activeTypes}
        onEventClick={handleEventClick}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-1">
        {ALL_TYPES.map((type) => {
          const cfg = EVENT_CONFIG[type];
          return (
            <div key={type} className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.dot}` }} />
              {cfg.label}
            </div>
          );
        })}
      </div>

      {/* No events in this month */}
      {events.filter((e) => e.date.startsWith(monthStr) && activeTypes.has(e.type)).length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarDays size={28} className="text-ink-faint mb-2" />
          <p className="text-sm text-ink-secondary">Sin eventos este mes</p>
        </div>
      )}

      {/* Popover */}
      {popover && (
        <EventPopover
          event={popover.event}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
        />
      )}
    </motion.div>
  );
}
