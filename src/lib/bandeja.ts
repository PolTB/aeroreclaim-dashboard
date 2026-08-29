// ─── Bandeja de Pol — parser y modelo ─────────────────────────────────────────
// La Bandeja vive como página de Notion escrita a mano por el CEO y los
// subagentes. Este parser convierte esos bloques en entradas mostrables.
//
// Regla de diseño: NADA que el CEO escriba puede quedar invisible. El parser
// anterior sólo entendía el formato canónico "📅 fecha" en su propio bloque
// seguido de párrafos con emoji, y descartaba en silencio:
//   · "📅 21/07/2026 — ⚠️ texto"  (fecha y contenido en la misma línea)
//   · "📧 09/08/2026 — Monitor email: ..." + bulleted_list_item
//   · cualquier línea con emoji escrita antes de la primera cabecera de fecha
// Todo eso se veía en Notion y no aparecía en el dashboard. Ahora se recoge.

export type BandejaTipo = 'ok' | 'warning' | 'urgent' | 'info';

export interface BandejaItem {
  /** Clave estable derivada del texto — persiste el "hecho" entre dispositivos. */
  key: string;
  type: BandejaTipo;
  ref: string;
  contact: string;
  message: string;
}

export interface BandejaEntry {
  id: string;
  date: string;
  /** Fecha parseada, null si el encabezado no es una fecha reconocible. */
  parsed: Date | null;
  items: BandejaItem[];
}

export interface BandejaParseResult {
  entries: BandejaEntry[];
  /** Claves ya marcadas como hechas por Pol (log escrito en la propia página). */
  done: Set<string>;
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

const MESES_ES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

/**
 * Parseo de fecha tolerante al texto libre real del campo ("13-may-2026 (CEO)",
 * "20/06/2026", "2026-08-29"). `new Date(str)` no vale: interpreta MM/DD y
 * devuelve Invalid Date con meses en español.
 */
export function parseEntryDate(raw: string): Date | null {
  const s = raw.trim();

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  m = s.match(/^(\d{1,2})[-\s]([a-záéíóúA-ZÁÉÍÓÚ]{3})[a-záéíóúA-ZÁÉÍÓÚ]*[-\s](\d{4})/);
  if (m) {
    const mesKey = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3);
    const mesIdx = MESES_ES[mesKey];
    if (mesIdx !== undefined) {
      const d = new Date(Number(m[3]), mesIdx, Number(m[1]));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Number(m[3]), month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

/** Clave estable de un ítem: normaliza acentos, emoji y espacios del mensaje. */
export function itemKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 48);
}

const EMOJI_TIPO: Record<string, BandejaTipo> = {
  '✅': 'ok',
  '⚠️': 'warning',
  '🔴': 'urgent',
  'ℹ️': 'info',
  '📧': 'info',
};

/** Extrae texto plano de cualquier bloque de Notion con rich_text. */
function blockText(block: NotionBlock): string | null {
  const container = block[block.type] as { rich_text?: { plain_text: string }[] } | undefined;
  if (!container?.rich_text) return null;
  const text = container.rich_text.map((r) => r.plain_text).join('').trim();
  return text || null;
}

/** Convierte una línea suelta en ítem, o null si no lleva emoji reconocible. */
function parseItem(text: string): BandejaItem | null {
  const emoji = Object.keys(EMOJI_TIPO).find((e) => text.startsWith(e));
  if (!emoji) return null;

  const rest = text.slice(emoji.length).trim();
  const type = EMOJI_TIPO[emoji];

  // Formato canónico: REF — CONTACTO — mensaje.
  // El contacto se limita a 40 caracteres sin comillas: si no, un guión largo
  // dentro del propio mensaje (típico en un asunto de email entrecomillado)
  // partía la frase por la mitad y la mostraba como si fuera el contacto.
  const structured = rest.match(/^(\S+)\s+[–—]\s+([^"“”]{1,40}?)\s+[–—]\s+(.+)$/);
  if (structured) {
    return {
      key: itemKey(`${structured[1]} ${structured[3]}`),
      type,
      ref: structured[1],
      contact: structured[2].trim(),
      message: structured[3].trim(),
    };
  }

  // Formato libre: REF — mensaje, o sólo mensaje
  const loose = rest.match(/^([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s.-]{1,28}?)\s+[–—]\s+(.+)$/);
  if (loose) {
    return { key: itemKey(`${loose[1]} ${loose[2]}`), type, ref: loose[1].trim(), contact: '', message: loose[2].trim() };
  }

  return { key: itemKey(rest), type, ref: '', contact: '', message: rest };
}

/** Bloques de documentación de la propia página que nunca son entradas. */
const DOC_HEADINGS = /^(📋|📌|📁)/;
const DOC_PARAGRAPH = /^(Cada línea en su propio párrafo|Regla de contenido)/;

export function parseBandeja(blocks: NotionBlock[]): BandejaParseResult {
  const entries: BandejaEntry[] = [];
  const done = new Set<string>();
  let current: BandejaEntry | null = null;

  const openEntry = (header: string) => {
    if (current && current.items.length) entries.push(current);
    current = { id: `${header}-${entries.length}`, date: header, parsed: parseEntryDate(header), items: [] };
  };

  for (const block of blocks) {
    if (block.type === 'code' || block.type === 'table' || block.type === 'divider' || block.type === 'child_page') continue;

    const text = blockText(block);
    if (!text) continue;
    if (DOC_HEADINGS.test(text) || DOC_PARAGRAPH.test(text)) continue;

    // Log de acciones ya hechas por Pol — no se muestra, marca la clave.
    const doneLog = text.match(/^✅\s+Pol actuó\s+[–—]\s+key:([a-z0-9-]+)/);
    if (doneLog) { done.add(doneLog[1]); continue; }
    if (/^✅\s+Pol actuó/.test(text)) continue; // formato antiguo, sin clave

    // Cabecera de fecha: "📅 29/08/2026" o "📧 09/08/2026 — ..."
    const header = text.match(/^(?:📅|📧)\s*(.+)$/);
    if (header) {
      const rest = header[1];
      // ¿Fecha y contenido en la misma línea? "21/07/2026 — ⚠️ texto".
      // Sólo se parte si lo de la derecha empieza por un emoji de ítem: hay
      // cabeceras que llevan una coletilla con guión ("11/08/2026 (actualiza
      // entrada del 19/07 — 23 días abierta)") y partirlas creaba un ítem
      // fantasma con el final de la propia cabecera como mensaje.
      const split = rest.match(/^(.+?)\s+[–—]\s+(.+)$/);
      const item = split ? parseItem(split[2].trim()) : null;
      if (split && item && parseEntryDate(split[1])) {
        openEntry(split[1].trim());
        current!.items.push(item);
      } else {
        openEntry(rest.trim());
      }
      continue;
    }

    // Dentro de una entrada abierta, una viñeta sin emoji es detalle de la
    // entrada (el monitor de email escribe así los correos que ha encontrado).
    const item =
      parseItem(text) ??
      (current && block.type === 'bulleted_list_item'
        ? { key: itemKey(text), type: 'info' as BandejaTipo, ref: '', contact: '', message: text }
        : null);
    if (!item) continue;

    // Ítem huérfano (sin cabecera previa): se recoge igualmente.
    if (!current) openEntry('Sin fecha');
    current!.items.push(item);
  }

  if (current && (current as BandejaEntry).items.length) entries.push(current);

  // Cronológico descendente — lo más reciente primero. Las entradas sin fecha
  // reconocible van arriba: si no se sabe cuándo son, no se pueden esconder.
  entries.sort((a, b) => {
    if (!a.parsed && !b.parsed) return 0;
    if (!a.parsed) return -1;
    if (!b.parsed) return 1;
    return b.parsed.getTime() - a.parsed.getTime();
  });

  return { entries, done };
}

/** Ítems pendientes (no marcados como hechos) de todas las entradas. */
export function pendingItems(entries: BandejaEntry[], done: Set<string>): { entry: BandejaEntry; item: BandejaItem }[] {
  return entries.flatMap((entry) =>
    entry.items.filter((item) => !done.has(item.key)).map((item) => ({ entry, item })),
  );
}
