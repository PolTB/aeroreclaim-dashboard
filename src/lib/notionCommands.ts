import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { NotionCommand, CommandDestinatario, CommandEstado, CommandPrioridad, CreateCommandPayload, UpdateCommandPayload } from '@/types';

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

function parseNotionCommand(page: PageObjectResponse): NotionCommand {
  const props = page.properties;
  return {
    id: page.id,
    titulo: getTitle(props, 'Titulo'),
    destinatario: getSelect(props, 'Destinatario') as CommandDestinatario | null,
    prompt: getRichText(props, 'Prompt'),
    estado: (getSelect(props, 'Estado') ?? 'Pendiente') as CommandEstado,
    respuesta: getRichText(props, 'Respuesta'),
    prioridad: getSelect(props, 'Prioridad') as CommandPrioridad | null,
    fechaCreacion: getDate(props, 'Fecha_Creacion'),
    fechaCompletado: getDate(props, 'Fecha_Completado'),
    url: page.url,
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
  if (payload.prioridad) properties['Prioridad'] = { select: { name: payload.prioridad } };

  await notion.pages.create({ parent: { database_id: DB_ID }, properties });
}

export async function updateCommand(id: string, updates: UpdateCommandPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {};
  if (updates.estado !== undefined) properties['Estado'] = { select: { name: updates.estado } };
  if (updates.respuesta !== undefined) properties['Respuesta'] = { rich_text: [{ text: { content: updates.respuesta } }] };
  if (updates.fechaCompletado !== undefined) {
    properties['Fecha_Completado'] = updates.fechaCompletado ? { date: { start: updates.fechaCompletado } } : { date: null };
  }
  if (updates.destinatario !== undefined) properties['Destinatario'] = updates.destinatario ? { select: { name: updates.destinatario } } : { select: null };
  if (updates.prioridad !== undefined) properties['Prioridad'] = updates.prioridad ? { select: { name: updates.prioridad } } : { select: null };
  await notion.pages.update({ page_id: id, properties });
}
