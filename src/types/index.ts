// ─── Tipos del dashboard ──────────────────────────────────────────────────────
// Sólo quedan los del pipeline del Sheet (se cruza con el Radar para detectar
// leads sin ficha). Los de Kanban, Roadmap y Blog se retiraron con sus pestañas
// el 29/08/2026, y los de Delegaciones el 22/10/2026.

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
