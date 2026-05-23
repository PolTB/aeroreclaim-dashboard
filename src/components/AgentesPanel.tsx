'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Cpu, Network, Cog, RefreshCw, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface Agent {
  alias?: string;
  name: string;
  layer: 'subagent' | 'external' | 'gas';
  model?: string;
  platform?: string;
  capacidad: string;
  currentAer?: string | null;
  lastActivity?: string | null;
  health?: 'green' | 'yellow' | 'red';
}

interface AgentsResponse {
  agents: Agent[];
  lastUpdated: string;
  source: 'registry' | 'fallback';
}

const LAYER_LABEL = {
  subagent: 'Subagentes CLI (.claude/agents/)',
  external: 'Agentes externos',
  gas:      'Pipeline GAS',
} as const;

const LAYER_ICON = {
  subagent: <Cpu size={13} />,
  external: <Network size={13} />,
  gas:      <Cog size={13} />,
} as const;

const HEALTH_STYLE = {
  green:  { dot: 'bg-emerald-400', glow: 'shadow-[0_0_6px_rgba(52,211,153,0.6)]', label: 'Activo' },
  yellow: { dot: 'bg-amber-400',   glow: 'shadow-[0_0_6px_rgba(251,191,36,0.6)]', label: 'Atención' },
  red:    { dot: 'bg-red-400',     glow: 'shadow-[0_0_6px_rgba(248,113,113,0.6)]', label: 'Error' },
} as const;

export function AgentesPanel() {
  const [data, setData]       = useState<AgentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAgents = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AgentsResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const t = setInterval(() => fetchAgents(true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchAgents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-ink-muted">
        Cargando AGENTS_REGISTRY...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-sm text-red-400">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Error cargando agentes</p>
          <p className="text-xs mt-0.5 text-red-400/70">{error}</p>
        </div>
      </div>
    );
  }

  const grouped: Record<string, Agent[]> = (data?.agents ?? []).reduce((acc, a) => {
    (acc[a.layer] ||= []).push(a);
    return acc;
  }, {} as Record<string, Agent[]>);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <Users size={18} className="text-accent" />
            Agentes
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            {data?.agents?.length ?? 0} agentes registrados · fuente: <span className="font-mono text-ink-secondary">AGENTS_REGISTRY.md</span> {data?.source === 'fallback' && '(fallback — registry no leído)'}
          </p>
        </div>
        <button
          onClick={() => fetchAgents(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
          title="Actualizar"
        >
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin text-accent')} />
        </button>
      </div>

      {(['subagent','external','gas'] as const).map(layer => {
        const agents = grouped[layer] ?? [];
        if (!agents.length) return null;
        return (
          <section key={layer}>
            <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
              {LAYER_ICON[layer]} {LAYER_LABEL[layer]} <span className="text-ink-faint">· {agents.length}</span>
            </p>
            <div className="bg-surface-card border border-edge/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface-elevated/50 border-b border-edge/40">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted">
                    <th className="px-3 py-2 font-medium">Agente</th>
                    <th className="px-3 py-2 font-medium hidden md:table-cell">Capacidad</th>
                    <th className="px-3 py-2 font-medium">AER actual</th>
                    <th className="px-3 py-2 font-medium hidden sm:table-cell">Última actividad</th>
                    <th className="px-3 py-2 font-medium text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, i) => {
                    const h = HEALTH_STYLE[a.health ?? 'green'];
                    const isOccupied = !!a.currentAer && a.currentAer !== '—';
                    return (
                      <tr key={`${a.name}-${i}`} className="border-b border-edge/20 last:border-0 hover:bg-surface-elevated/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            {a.alias && <span className="text-[10px] font-semibold text-accent">{a.alias}</span>}
                            <span className="font-mono text-ink">{a.name}</span>
                            <span className="text-[10px] text-ink-faint">
                              {a.model && `${a.model} · `}{a.platform}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-muted hidden md:table-cell max-w-md">
                          <p className="line-clamp-2">{a.capacidad}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          {isOccupied ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-[10px] font-mono">
                              {a.currentAer}
                            </span>
                          ) : (
                            <span className="text-ink-faint text-[10px]">libre</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-ink-muted text-[10px] hidden sm:table-cell">
                          {a.lastActivity ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <div className={clsx('w-2 h-2 rounded-full', h.dot, h.glow)} />
                            <span className="text-[10px] text-ink-muted">{h.label}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className="text-[10px] text-ink-faint">
        Sistema de coordinación: anti-colisión vía Notion prop <span className="font-mono">In_Progress_By</span> · handoff explícito vía <span className="font-mono">Next_Agent</span> · auditoría semanal por EL AUDITOR (dashboard-auditor)
      </p>
    </div>
  );
}
