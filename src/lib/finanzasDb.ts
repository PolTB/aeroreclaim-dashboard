import { notionClient } from '@/lib/notionClient';
import type { FinanzasSnapshot } from '@/lib/finanzas';

const notion = notionClient(process.env.NOTION_CEO_TOKEN ?? process.env.NOTION_TOKEN);

// Página privada "💶 Finanzas · datos para el dashboard" (16/10/2026). El ID no
// es secreto sin el token, mismo criterio que los IDs de las bases de datos.
const PAGE_ID = process.env.FINANZAS_PAGE_ID || '3fb8a573-e757-81c3-9ec2-db808d1f0cf4';

/** Lee el bloque de código JSON que escribe `registro.js` en esa página. */
export async function getFinanzas(): Promise<FinanzasSnapshot> {
  const res = await notion.blocks.children.list({ block_id: PAGE_ID, page_size: 50 });
  const bloque = res.results.find((b) => 'type' in b && b.type === 'code');
  if (!bloque || !('code' in bloque)) throw new Error('La página de finanzas no tiene el bloque de datos');
  const texto = bloque.code.rich_text.map((t) => t.plain_text).join('');
  const datos = JSON.parse(texto) as FinanzasSnapshot;
  if (!Array.isArray(datos.meses)) throw new Error('Los datos de finanzas están vacíos: falta ejecutar registro.js publicar');
  return datos;
}
