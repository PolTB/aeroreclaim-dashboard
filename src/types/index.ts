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
export type CommandEstado = 'Pendiente' | 'En Proceso' | 'Respuesta Recibida' | 'Completado' | 'Bloqueado' | 'Cancelado';
export type CommandPrioridad = 'Alta' | 'Media' | 'Baja';
export type CommandArchivoTipo = 'imagen' | 'PDF' | 'markdown' | 'HTML' | 'Google Doc' | 'otro';

export const COMMAND_ARCHIVO_TIPOS: CommandArchivoTipo[] = ['imagen', 'PDF', 'markdown', 'HTML', 'Google Doc', 'otro'];

export interface NotionCommand {
  id: string;
  titulo: string;
  destinatario: CommandDestinatario | null;
  subchat: string;
  prompt: string;
  estado: CommandEstado;
  respuesta: string;
  prioridad: CommandPrioridad | null;
  fechaCreacion: string | null;
  fechaCompletado: string | null;
  url: string;
  archivoUrl: string | null;
  archivoTipo: CommandArchivoTipo | null;
}

export interface CreateCommandPayload {
  titulo: string;
  destinatario?: CommandDestinatario | null;
  subchat?: string;
  prompt: string;
  prioridad?: CommandPrioridad | null;
  archivoUrl?: string | null;
  archivoTipo?: CommandArchivoTipo | null;
}

export interface UpdateCommandPayload {
  estado?: CommandEstado;
  respuesta?: string;
  subchat?: string;
  fechaCompletado?: string | null;
  destinatario?: CommandDestinatario | null;
  prioridad?: CommandPrioridad | null;
  archivoUrl?: string | null;
  archivoTipo?: CommandArchivoTipo | null;
}

export const COMMAND_DESTINATARIOS: CommandDestinatario[] = [
  'Claude CoWork', 'Claude Code', 'Claude Chat', 'Comet', 'ChatGPT', 'Manual'
];

export const COMMAND_ESTADO_CONFIG: Record<CommandEstado, { label: string; color: string; bg: string; description: string }> = {
  'Pendiente':            { label: 'Pendiente',            color: '#6b7280', bg: 'rgba(107,114,128,0.12)', description: 'Listo para enviar al agente' },
  'En Proceso':           { label: 'En Proceso',           color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  description: 'Enviado al agente, esperando respuesta' },
  'Respuesta Recibida':   { label: 'Respuesta Recibida',   color: '#eab308', bg: 'rgba(234,179,8,0.12)',   description: 'El agente respondió, pendiente de revisar' },
  'Completado':           { label: 'Completado',           color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   description: 'Tarea finalizada con éxito' },
  'Bloqueado':            { label: 'Bloqueado',            color: '#f97316', bg: 'rgba(249,115,22,0.12)',  description: 'El agente no pudo, hay que replantear' },
  'Cancelado':            { label: 'Cancelado',            color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   description: 'Descartado, ya no se necesita' },
};

/** Valid state transitions — any state can go to any state (bidirectional) */
export const COMMAND_ESTADO_ORDER: Record<CommandEstado, number> = {
  'Pendiente': 0,
  'En Proceso': 1,
  'Respuesta Recibida': 2,
  'Bloqueado': 3,
  'Completado': 4,
  'Cancelado': 5,
};

/** States that count as "active" (shown in main queue) */
export const ACTIVE_ESTADOS: CommandEstado[] = ['Pendiente', 'En Proceso', 'Respuesta Recibida', 'Bloqueado'];

/** States that count as "archived" (shown in history) */
export const ARCHIVED_ESTADOS: CommandEstado[] = ['Completado', 'Cancelado'];

// ─── Case Tracker types ────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  'Lead',
  'Aprobado',
  'Docs Recibidos',
  'Extrajudicial',
  'Respuesta Aerolínea',
  'AESA',
  'Cobro',
  'Cerrado',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type StageStatus = 'completada' | 'activa' | 'pendiente';

export interface StageInfo {
  estado: StageStatus;
  fecha: string | null;
  confirmacionAgente: boolean;
  confirmacionManual: boolean;
}

export interface AeroCaso {
  id: string;
  pasajero: string;
  vuelo: string;
  ruta: string;
  fecha: string;
  compensacion: number;
  scoreLegal: number;
  estadoActual: PipelineStage;
  ultimaActualizacion: string;
  pipeline: Record<PipelineStage, StageInfo>;
  notaInterna?: string;
}
