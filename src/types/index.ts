// ─── Domain types ─────────────────────────────────────────────────────────────

export type Priority = 'P1 - Urgente' | 'P2 - Alta' | 'P3 - Media';
export type Estado = 'Pendiente' | 'En Progreso' | 'Completada';

export const CATEGORIES = [
  'SEO/Contenido',
  'Marketing/Outreach',
  'Comunidades',
  'SEO/Web',
  'SEO',
  'Redes Sociales',
  'Tech/Operaciones',
  'Operaciones',
] as const;

export type Categoria = (typeof CATEGORIES)[number];

export interface NotionTask {
  id: string;
  tarea: string;
  prioridad: Priority | null;
  categoria: string | null;
  fechaLimite: string | null;
  notas: string;
  completada: boolean;
  estado: Estado;
  url: string;
  /** Whether the Notion DB has an "Estado" select property */
  hasEstado: boolean;
}

// ─── UI types ─────────────────────────────────────────────────────────────────

export interface KanbanColumnDef {
  id: Estado;
  title: string;
  color: string;
  bgColor: string;
}

export interface Filters {
  prioridad: Priority | 'all';
  categoria: string | 'all';
  estado: Estado | 'all';
  search: string;
}

export interface UpdateTaskPayload {
  estado?: Estado;
  completada?: boolean;
  notas?: string;
  prioridad?: Priority | null;
  categoria?: string | null;
  fechaLimite?: string | null;
  tarea?: string;
}

export interface CreateTaskPayload {
  tarea: string;
  prioridad?: Priority | null;
  categoria?: string | null;
  fechaLimite?: string | null;
  notas?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'Pendiente',
    title: 'Pendiente',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.08)',
  },
  {
    id: 'En Progreso',
    title: 'En Progreso',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.08)',
  },
  {
    id: 'Completada',
    title: 'Completada',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.08)',
  },
];

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; bg: string; text: string; dot: string }
> = {
  'P1 - Urgente': {
    label: 'P1',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    dot: '#ef4444',
  },
  'P2 - Alta': {
    label: 'P2',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    dot: '#f97316',
  },
  'P3 - Media': {
    label: 'P3',
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    dot: '#3b82f6',
  },
};

export const CATEGORY_COLORS: Record<string, string> = {
  'SEO/Contenido': '#6366f1',
  'Marketing/Outreach': '#ec4899',
  Comunidades: '#22c55e',
  'SEO/Web': '#3b82f6',
  SEO: '#a78bfa',
  'Redes Sociales': '#f59e0b',
  'Tech/Operaciones': '#06b6d4',
  Operaciones: '#10b981',
};

/** Returns a deterministic color for any category string */
export function getCategoryColor(cat: string | null): string {
  if (!cat) return '#555570';
  return CATEGORY_COLORS[cat] ?? '#6366f1';
}
