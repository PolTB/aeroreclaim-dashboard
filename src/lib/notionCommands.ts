import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { NotionCommand, CommandDestinatario, CommandEstado, CommandPrioridad, CommandArchivoTipo, CommandModelo, CommandEsfuerzo, CreateCommandPayload, UpdateCommandPayload, CommandArchivo } from '@/types';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.COMMANDS_DATABASE_ID!;

type Props = PageObjectResponse['properties'];

function getTitle(props: Props, key: string): string {
  const p = props[key];
  return p?.type === 'title' ? p.title.map((t) => t.plain_text).join('') : '';
}
function getSelect(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'select' ? (p.select?.name ?? null) : null;
}
function getRichText(props: Props, key: string): string {
  const p = props[key];
  return p?.type === 'rich_text' ? p.rich_text.map((t) => t.plain_text).join('') : '';
}
function getDate(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'date' ? (p.date?.start ?? null) : null;
}
function getUrl(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'url' ? (p.url ?? null) : null;
}
function getArchivosExtra(props: Props, key: string): CommandArchivo[] | null {
  const raw = getRichText(props, key);
  if (!raw) return null;
  try { return JSON.parse(raw) as CommandArchivo[]; } catch { return null; }
}

function parseNotionCommand(page: PageObjectResponse): NotionCommand {
  const props = page.properties;
  return {
    id: page.id,
    titulo: getTitle(props, 'Titulo'),
    destinatario: getSelect(props, 'Destinatario') as CommandDestinatario | null,
    subchat: getRichText(props, 'Subchat'),
    prompt: getRichText(props, 'Prompt'),
    estado: (getSelect(props, 'Estado') ?? 'Pendiente') as CommandEstado,
    respuesta: getRichText(props, 'Respuesta'),
    prioridad: getSelect(props, 'Prioridad') as CommandPrioridad | null,
    modelo: getSelect(props, 'Modelo') as CommandModelo | null,
    esfuerzo: getSelect(props, 'Esfuerzo') as CommandEsfuerzo | null,
    fechaCreacion: getDate(props, 'Fecha_Creacion'),
    fechaCompletado: getDate(props, 'Fecha_Completado'),
    url: page.url,
    archivoUrl: getUrl(props, 'Archivo_URL'),
    archivoTipo: getSelect(props, 'Archivo_Tipo') as CommandArchivoTipo | null,
    archivosExtra: getArchivosExtra(props, 'Archivos_Extra'),
  };
}

export async function getCommands(): Promise<NotionCommand[]> {
  if (!DB_ID) throw new Error('COMMANDS_DATABASE_ID not set');
  const allPages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      sorts: [{ property: 'Fecha_Creacion', direction: 'descending' }],
      start_cursor: cursor,
      page_size: 100,
    });
    const pages = res.results.filter(
      (r): r is PageObjectResponse => r.object === 'page' && 'properties' in r,
    );
    allPages.push(...pages);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return allPages.map(parseNotionCommand);
}

export async function createCommand(payload: CreateCommandPayload): Promise<void> {
  if (!DB_ID) throw new Error('COMMANDS_DATABASE_ID not set');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    Titulo: { title: [{ text: { content: payload.titulo } }] },
    Prompt: { rich_text: [{ text: { content: payload.prompt } }] },
    Estado: { select: { name: 'Pendiente' } },
    Fecha_Creacion: { date: { start: new Date().toISOString().split('T')[0] } },
  };
  if (payload.destinatario) properties['Destinatario'] = { select: { name: payload.destinatario } };
  if (payload.subchat) properties['Subchat'] = { rich_text: [{ text: { content: payload.subchat } }] };
  if (payload.prioridad) properties['Prioridad'] = { select: { name: payload.prioridad } };
  if (payload.modelo) properties['Modelo'] = { select: { name: payload.modelo } };
  if (payload.esfuerzo) properties['Esfuerzo'] = { select: { name: payload.esfuerzo } };
  if (payload.archivoUrl) properties['Archivo_URL'] = { url: payload.archivoUrl };
  if (payload.archivoTipo) properties['Archivo_Tipo'] = { select: { name: payload.archivoTipo } };
  if (payload.archivosExtra !== undefined) {
    properties['Archivos_Extra'] = payload.archivosExtra?.length
      ? { rich_text: [{ text: { content: JSON.stringify(payload.archivosExtra) } }] }
      : { rich_text: [] };
  }

  await notion.pages.create({ parent: { database_id: DB_ID }, properties });
}

/** Split text into 2000-char chunks for Notion rich_text blocks */
function toRichTextBlocks(text: string) {
  const MAX = 2000;
  if (text.length <= MAX) return [{ text: { content: text } }];
  const blocks = [];
  for (let i = 0; i < text.length; i += MAX) {
    blocks.push({ text: { content: text.slice(i, i + MAX) } });
  }
  return blocks;
}

export async function updateCommand(id: string, updates: UpdateCommandPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {};
  if (updates.titulo !== undefined) properties['Titulo'] = { title: [{ text: { content: updates.titulo } }] };
  if (updates.estado !== undefined) properties['Estado'] = { select: { name: updates.estado } };
  if (updates.respuesta !== undefined) properties['Respuesta'] = { rich_text: toRichTextBlocks(updates.respuesta) };
  if (updates.fechaCompletado !== undefined) {
    properties['Fecha_Completado'] = updates.fechaCompletado ? { date: { start: updates.fechaCompletado } } : { date: null };
  }
  if (updates.subchat !== undefined) properties['Subchat'] = { rich_text: toRichTextBlocks(updates.subchat) };
  if (updates.destinatario !== undefined) properties['Destinatario'] = updates.destinatario ? { select: { name: updates.destinatario } } : { select: null };
  if (updates.prioridad !== undefined) properties['Prioridad'] = updates.prioridad ? { select: { name: updates.prioridad } } : { select: null };
  if (updates.modelo !== undefined) properties['Modelo'] = updates.modelo ? { select: { name: updates.modelo } } : { select: null };
  if (updates.esfuerzo !== undefined) properties['Esfuerzo'] = updates.esfuerzo ? { select: { name: updates.esfuerzo } } : { select: null };
  if (updates.archivoUrl !== undefined) properties['Archivo_URL'] = updates.archivoUrl ? { url: updates.archivoUrl } : { url: null };
  if (updates.archivoTipo !== undefined) properties['Archivo_Tipo'] = updates.archivoTipo ? { select: { name: updates.archivoTipo } } : { select: null };
  if (updates.archivosExtra !== undefined) {
    properties['Archivos_Extra'] = updates.archivosExtra?.length
      ? { rich_text: [{ text: { content: JSON.stringify(updates.archivosExtra) } }] }
      : { rich_text: [] };
  }
  await notion.pages.update({ page_id: id, properties });
}

export async function archiveCommand(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}
