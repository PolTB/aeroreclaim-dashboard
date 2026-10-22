import type { BandejaTarea } from '@/lib/bandejaDb';

// ─── Tareas del CEO dentro de la Bandeja ─────────────────────────────────────
// Desde el 22/10/2026 lo que antes era una AER de la pestaña Delegaciones es
// una fila más de la Bandeja con Para = "CEO" y el encargo en "Instrucciones
// CEO". Sin fecha, no cuentan como pendientes de Pol: van en un grupo aparte y
// las coge el CEO al abrir sesión. Sin el cliente de Notion, para poder usarse
// en componentes de cliente.

export const esDelCeo = (t: BandejaTarea): boolean => t.para === 'CEO';

/** Pendiente que Pol tiene que ver en la lista principal (y en la franja Hoy). */
export const cuentaEnBandeja = (t: BandejaTarea): boolean =>
  t.estado === 'Pendiente' && !(esDelCeo(t) && !t.fechaLimite);

/**
 * Lo que Pol pega en Claude Code. Debe coincidir con textoParaClaude() de
 * tools/tarea-ceo.js y de la franja Hoy (mods/franja-hoy) del repo del CEO.
 */
export function textoParaClaude(t: BandejaTarea): string {
  return `Tarea de la Bandeja para el CEO: «${t.tarea}» (id ${t.id}).\n` +
    `Hazla y, al terminar, márcala Hecho con: node tools/tarea-ceo.js hecho ${t.id}\n\n` +
    (t.instrucciones || t.como || '(sin instrucciones: pregúntale a Pol qué quería)');
}
