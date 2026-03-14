import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type {
  NotionTask,
  Priority,
  Estado,
  UpdateTaskPayload,
  CreateTaskPayload,
} from '@/types';

// ─── Client singleton ─────────────────────────────────────────────────────────

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DATABASE_ID!;

// ─── Parsing helpers ──────────────────────────────────────────────────────────

type Props = PageObjectResponse['properties'];

function getTitle(props: Props, key: string): string {
  const p = props[key];
  return p?.type === 'title' ? p.title.map((t) => t.plain_text).join('') : '';
}

function getSelect(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'select' ? (p.select?.name ?? null) : null;
}

function getDate(props: Props, key: string): string | null {
  const p = props[key];
  return p?.type === 'date' ? (p.date?.start ?? null) : null;
}

function getRichText(props: Props, key: string): string {
  const p = props[key];
  return p?.type === 'rich_text' ? p.rich_text.map((t) => t.plain_text).join('') : '';
}

function getCheckbox(props: Props, key: string): boolean {
  const p = props[key];
  return p?.type === 'checkbox' ? p.checkbox : false;
}

function parseNotionTask(page: PageObjectResponse): NotionTask {
  const props = page.properties;

  const completada = getCheckbox(props, 'Completada');
  const hasEstado = 'Estado' in props;

  let estado: Estado;
  if (hasEstado) {
    const raw = getSelect(props, 'Estado');
    if (raw === 'En Progreso' || raw === 'Completada' || raw === 'Pendiente') {
      estado = raw;
    } else {
      estado = completada ? 'Completada' : 'Pendiente';
    }
  } else {
    estado = completada ? 'Completada' : 'Pendiente';
  }

  return {
    id: page.id,
    tarea: getTitle(props, 'Tarea'),
    prioridad: getSelect(props, 'Prioridad') as Priority | null,
    categoria: getSelect(props, 'Categoria'),
    fechaLimite: getDate(props, 'Fecha Limite'),
    notas: getRichText(props, 'Notas'),
    completada,
    estado,
    url: page.url,
    hasEstado,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getTasks(): Promise<{
  tasks: NotionTask[];
  hasEstado: boolean;
}> {
  const allPages: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  // Handle pagination — Notion returns max 100 results per request
  do {
    const response = await notion.databases.query({
      database_id: DB_ID,
      sorts: [{ property: 'Fecha Limite', direction: 'ascending' }],
      start_cursor: cursor,
      page_size: 100,
    });

    const pages = response.results.filter(
      (r): r is PageObjectResponse => r.object === 'page' && 'properties' in r,
    );
    allPages.push(...pages);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const tasks = allPages.map(parseNotionTask);
  const hasEstado = tasks.length > 0 ? tasks[0].hasEstado : false;

  return { tasks, hasEstado };
}

export async function updateTask(id: string, updates: UpdateTaskPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (updates.tarea !== undefined) {
    properties['Tarea'] = { title: [{ text: { content: updates.tarea } }] };
  }

  if (updates.completada !== undefined) {
    properties['Completada'] = { checkbox: updates.completada };
  }

  if (updates.notas !== undefined) {
    properties['Notas'] = {
      rich_text: [{ text: { content: updates.notas } }],
    };
  }

  if (updates.prioridad !== undefined) {
    properties['Prioridad'] = updates.prioridad
      ? { select: { name: updates.prioridad } }
      : { select: null };
  }

  if (updates.categoria !== undefined) {
    properties['Categoria'] = updates.categoria
      ? { select: { name: updates.categoria } }
      : { select: null };
  }

  if (updates.fechaLimite !== undefined) {
    properties['Fecha Limite'] = updates.fechaLimite
      ? { date: { start: updates.fechaLimite } }
      : { date: null };
  }

  // Try to update Estado — gracefully skip if the property doesn't exist
  if (updates.estado !== undefined) {
    properties['Estado'] = { select: { name: updates.estado } };
  }

  try {
    await notion.pages.update({ page_id: id, properties });
  } catch (err: unknown) {
    // If Estado property doesn't exist, retry without it
    if (
      updates.estado !== undefined &&
      err instanceof Error &&
      err.message.includes('Estado')
    ) {
      delete properties['Estado'];
      await notion.pages.update({ page_id: id, properties });
    } else {
      throw err;
    }
  }
}

export async function createTask(payload: CreateTaskPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Tarea: { title: [{ text: { content: payload.tarea } }] },
    Completada: { checkbox: false },
  };

  if (payload.prioridad) {
    properties['Prioridad'] = { select: { name: payload.prioridad } };
  }
  if (payload.categoria) {
    properties['Categoria'] = { select: { name: payload.categoria } };
  }
  if (payload.fechaLimite) {
    properties['Fecha Limite'] = { date: { start: payload.fechaLimite } };
  }
  if (payload.notas) {
    properties['Notas'] = { rich_text: [{ text: { content: payload.notas } }] };
  }

  await notion.pages.create({
    parent: { database_id: DB_ID },
    properties,
  });
}
