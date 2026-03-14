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

// ─── Command types ─────────────────────────────────────────────────────────────

export type CommandDestinatario = 'Claude CoWork' | 'Claude Code' | 'Claude Chat' | 'Comet' | 'ChatGPT' | 'Manual';
export type CommandEstado = 'Pendiente' | 'En Proceso' | 'Completado' | 'Error';
export type CommandPrioridad = 'Alta' | 'Media' | 'Baja';

export interface NotionCommand {
  id: string;
  titulo: string;
  destinatario: CommandDestinatario | null;
  prompt: string;
  estado: CommandEstado;
  respuesta: string;
  prioridad: CommandPrioridad | null;
  fechaCreacion: string | null;
  fechaCompletado: string | null;
  url: string;
}

export interface CreateCommandPayload {
  titulo: string;
  destinatario?: CommandDestinatario | null;
  prompt: string;
  prioridad?: CommandPrioridad | null;
}

export interface UpdateCommandPayload {
  estado?: CommandEstado;
  respuesta?: string;
  fechaCompletado?: string | null;
  destinatario?: CommandDestinatario | null;
  prioridad?: CommandPrioridad | null;
}

export const COMMAND_DESTINATARIOS: CommandDestinatario[] = [
  'Claude CoWork', 'Claude Code', 'Claude Chat', 'Comet', 'ChatGPT', 'Manual'
];

export const COMMAND_ESTADO_CONFIG: Record<CommandEstado, { label: string; color: string; bg: string }> = {
  'Pendiente':   { label: 'Pendiente',   color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  'En Proceso':  { label: 'En Proceso',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'Completado':  { label: 'Completado',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  'Error':       { label: 'Error',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};
