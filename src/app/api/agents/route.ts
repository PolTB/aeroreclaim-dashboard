import { NextResponse } from 'next/server';
import { AGENTS, REGISTRY_LAST_UPDATED } from '@/lib/agents-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  // En el futuro: enriquecer cada agente con su `In_Progress_By` real desde Notion.
  // Por ahora devolvemos el mirror del AGENTS_REGISTRY.md como source of truth.
  return NextResponse.json({
    agents: AGENTS,
    lastUpdated: REGISTRY_LAST_UPDATED,
    source: 'registry',
  });
}
