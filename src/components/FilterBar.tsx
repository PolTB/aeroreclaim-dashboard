'use client';

import { Search, X, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import type { Filters, Priority, Estado } from '@/types';
import { PRIORITY_CONFIG } from '@/types';

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  categories: string[];
}

const ESTADO_OPTIONS: { value: Estado | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En Progreso', label: 'En Progreso' },
  { value: 'Completada', label: 'Completada' },
];

const PRIORIDAD_OPTIONS: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'P1 - Urgente', label: 'P1 Urgente' },
  { value: 'P2 - Alta', label: 'P2 Alta' },
  { value: 'P3 - Media', label: 'P3 Media' },
];

export function FilterBar({ filters, onFiltersChange, categories }: FilterBarProps) {
  const hasActiveFilters =
    filters.prioridad !== 'all' ||
    filters.categoria !== 'all' ||
    filters.estado !== 'all' ||
    filters.search !== '';

  const update = (patch: Partial<Filters>) =>
    onFiltersChange({ ...filters, ...patch });

  const reset = () =>
    onFiltersChange({ prioridad: 'all', categoria: 'all', estado: 'all', search: '' });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
        />
        <input
          type="text"
          placeholder="Buscar tareas..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="w-full bg-surface-card border border-edge/70 rounded-xl pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/60 transition-colors"
        />
        {filters.search && (
          <button
            onClick={() => update({ search: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Estado filter */}
      <div className="flex bg-surface-card border border-edge/60 rounded-xl p-1 gap-0.5">
        {ESTADO_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update({ estado: opt.value as Estado | 'all' })}
            className={clsx(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              filters.estado === opt.value
                ? 'bg-accent text-white'
                : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Prioridad filter */}
      <select
        value={filters.prioridad}
        onChange={(e) => update({ prioridad: e.target.value as Priority | 'all' })}
        className={clsx(
          'bg-surface-card border rounded-xl px-3 py-2 text-xs font-medium text-ink-secondary',
          'focus:outline-none focus:border-accent/60 transition-colors cursor-pointer',
          filters.prioridad !== 'all' ? 'border-accent/40 text-accent' : 'border-edge/60',
        )}
      >
        {PRIORIDAD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Categoría filter */}
      <select
        value={filters.categoria}
        onChange={(e) => update({ categoria: e.target.value })}
        className={clsx(
          'bg-surface-card border rounded-xl px-3 py-2 text-xs font-medium text-ink-secondary max-w-44',
          'focus:outline-none focus:border-accent/60 transition-colors cursor-pointer',
          filters.categoria !== 'all' ? 'border-accent/40 text-accent' : 'border-edge/60',
        )}
      >
        <option value="all">Todas las categorías</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={reset}
          className="flex items-center gap-1 px-2.5 py-2 text-xs text-ink-muted hover:text-ink-secondary border border-edge/60 rounded-xl transition-colors"
        >
          <X size={11} />
          Limpiar
        </button>
      )}

      {/* Active filter indicator */}
      {hasActiveFilters && (
        <span className="flex items-center gap-1 text-[10px] text-accent font-medium">
          <SlidersHorizontal size={10} />
          Filtros activos
        </span>
      )}
    </div>
  );
}
