// ─── Tipos del dashboard ──────────────────────────────────────────────────────
// Sólo quedan los de las tres pestañas vivas: Delegaciones (Notion) y Casos
// (Radar de Notion + pipeline del Sheet). Los tipos de Kanban, Roadmap y Blog
// se retiraron con sus pestañas el 29/08/2026.

// ─── Delegaciones ─────────────────────────────────────────────────────────────

export type CommandDestinatario =
  | 'Claude CoWork' | 'Claude Code' | 'Claude Chat' | 'Comet' | 'ChatGPT' | 'Manual' | 'Paperclip';
export type CommandEstado =
  | 'Pendiente' | 'En Proceso' | 'Respuesta Recibida' | 'Completado' | 'Bloqueado' | 'Cancelado';
export type CommandPrioridad = 'Alta' | 'Media' | 'Baja';
export type CommandArchivoTipo = 'imagen' | 'PDF' | 'markdown' | 'HTML' | 'Google Doc' | 'otro';
export type CommandModelo = 'Sonnet' | 'Opus' | 'Haiku';
export type CommandEsfuerzo = 'Baja' | 'Media' | 'Alta';

export const COMMAND_ARCHIVO_TIPOS: CommandArchivoTipo[] = ['imagen', 'PDF', 'markdown', 'HTML', 'Google Doc', 'otro'];

export interface CommandArchivo {
  url: string;
  tipo: CommandArchivoTipo;
  nombre: string;
}

export interface NotionCommand {
  id: string;
  titulo: string;
  destinatario: CommandDestinatario | null;
  subchat: string;
  prompt: string;
  estado: CommandEstado;
  respuesta: string;
  prioridad: CommandPrioridad | null;
  modelo: CommandModelo | null;
  esfuerzo: CommandEsfuerzo | null;
  fechaCreacion: string | null;
  fechaCompletado: string | null;
  url: string;
  archivoUrl: string | null;
  archivoTipo: CommandArchivoTipo | null;
  archivosExtra: CommandArchivo[] | null;
}

export interface CreateCommandPayload {
  titulo: string;
  destinatario?: CommandDestinatario | null;
  subchat?: string;
  prompt: string;
  prioridad?: CommandPrioridad | null;
  modelo?: CommandModelo | null;
  esfuerzo?: CommandEsfuerzo | null;
  archivoUrl?: string | null;
  archivoTipo?: CommandArchivoTipo | null;
  archivosExtra?: CommandArchivo[] | null;
}

export interface UpdateCommandPayload {
  titulo?: string;
  estado?: CommandEstado;
  respuesta?: string;
  subchat?: string;
  fechaCompletado?: string | null;
  destinatario?: CommandDestinatario | null;
  prioridad?: CommandPrioridad | null;
  modelo?: CommandModelo | null;
  esfuerzo?: CommandEsfuerzo | null;
  archivoUrl?: string | null;
  archivoTipo?: CommandArchivoTipo | null;
  archivosExtra?: CommandArchivo[] | null;
}

export const COMMAND_DESTINATARIOS: CommandDestinatario[] = [
  'Claude CoWork', 'Claude Code', 'Claude Chat', 'Comet', 'ChatGPT', 'Manual', 'Paperclip',
];

export const COMMAND_ESTADO_CONFIG: Record<CommandEstado, { label: string; color: string; bg: string; description: string }> = {
  'Pendiente':          { label: 'Pendiente',          color: '#8b8ba7', bg: 'rgba(139,139,167,0.14)', description: 'Lista para enviar al agente' },
  'En Proceso':         { label: 'En proceso',         color: '#3b82f6', bg: 'rgba(59,130,246,0.14)',  description: 'Enviada al agente, esperando respuesta' },
  'Respuesta Recibida': { label: 'Respuesta recibida', color: '#eab308', bg: 'rgba(234,179,8,0.16)',   description: 'El agente respondió, pendiente de revisar' },
  'Completado':         { label: 'Completada',         color: '#22c55e', bg: 'rgba(34,197,94,0.14)',   description: 'Terminada con éxito' },
  'Bloqueado':          { label: 'Bloqueada',          color: '#f97316', bg: 'rgba(249,115,22,0.14)',  description: 'El agente no pudo, hay que replantear' },
  'Cancelado':          { label: 'Cancelada',          color: '#ef4444', bg: 'rgba(239,68,68,0.14)',   description: 'Descartada, ya no se necesita' },
};

/** Estados que cuentan como "en curso" (aparecen en la cola principal). */
export const ACTIVE_ESTADOS: CommandEstado[] = ['Pendiente', 'En Proceso', 'Respuesta Recibida', 'Bloqueado'];

/** Estados cerrados (aparecen en el historial). */
export const ARCHIVED_ESTADOS: CommandEstado[] = ['Completado', 'Cancelado'];

// ─── Normalización de estados ─────────────────────────────────────────────────
// La DB de Notion acumula variantes del mismo estado escritas por agentes
// distintos: "Completada" (227 filas) y "Completado" (136), "Cancelada" y
// "Cancelado". El dashboard sólo conocía las formas en masculino, así que TODAS
// las AERs marcadas "Completada" caían fuera de ACTIVE_ESTADOS y de
// ARCHIVED_ESTADOS a la vez: no salían ni en la cola ni en el historial —
// 233 de 392 delegaciones eran invisibles. Se normaliza al leer, sin tocar los
// datos: los agentes pueden seguir escribiendo cualquiera de las dos formas.

const ESTADO_ALIASES: Record<string, CommandEstado> = {
  'completada': 'Completado',
  'completado': 'Completado',
  'completed': 'Completado',
  'cancelada': 'Cancelado',
  'cancelado': 'Cancelado',
  'pendiente': 'Pendiente',
  'en proceso': 'En Proceso',
  'en progreso': 'En Proceso',
  'respuesta recibida': 'Respuesta Recibida',
  'bloqueado': 'Bloqueado',
  'bloqueada': 'Bloqueado',
};

export function normalizeCommandEstado(raw: string | null | undefined): CommandEstado {
  if (!raw) return 'Pendiente';
  return ESTADO_ALIASES[raw.trim().toLowerCase()] ?? 'Pendiente';
}

// ─── Pipeline de casos del Sheet (vía /api/cases) ─────────────────────────────
// Se conserva sólo para cruzarlo con el Radar y detectar leads sin ficha.

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
  /** Fecha en que se envió el email de bienvenida (ISO date string) */
  welcome_sent_date?: string | null;
}
