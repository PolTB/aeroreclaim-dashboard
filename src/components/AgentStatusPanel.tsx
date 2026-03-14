'use client';

const AGENTS = [
  { name: 'Lead Receiver',   status: 'green' as const },
  { name: 'Legal Scoring',   status: 'green' as const },
  { name: 'Onboarding',      status: 'green' as const },
  { name: 'Extrajudicial',   status: 'green' as const },
  { name: 'AESA',            status: 'green' as const },
  { name: 'Collection',      status: 'green' as const },
];

const STATUS_CONFIG = {
  green:  { color: '#22c55e', label: 'Activo',    glow: '0 0 8px rgba(34,197,94,0.5)' },
  yellow: { color: '#f59e0b', label: 'Degradado', glow: '0 0 8px rgba(245,158,11,0.5)' },
  red:    { color: '#ef4444', label: 'Error',      glow: '0 0 8px rgba(239,68,68,0.5)' },
};

export function AgentStatusPanel() {
  return (
    <div className="p-3 rounded-xl bg-surface-card border border-edge/60">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
        Sistemas
      </p>
      <div className="flex flex-col gap-2">
        {AGENTS.map((agent) => {
          const cfg = STATUS_CONFIG[agent.status];
          return (
            <div key={agent.name} className="flex items-center justify-between">
              <span className="text-xs text-ink-secondary">{agent.name}</span>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cfg.color, boxShadow: cfg.glow }}
                />
                <span className="text-[10px] text-ink-muted">{cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
