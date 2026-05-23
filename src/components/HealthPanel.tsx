'use client';

import { useEffect, useState } from 'react';
import { Activity, Sun, Moon, Github, Database, Webhook, Globe } from 'lucide-react';
import clsx from 'clsx';

interface HealthCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'bad' | 'unknown';
  detail: string;
  icon: React.ReactNode;
}

const STATUS = {
  ok:      { color: 'text-emerald-400', dot: 'bg-emerald-400' },
  warn:    { color: 'text-amber-400',   dot: 'bg-amber-400' },
  bad:     { color: 'text-red-400',     dot: 'bg-red-400' },
  unknown: { color: 'text-ink-faint',   dot: 'bg-ink-faint/40' },
} as const;

function daysUntil(isoDate: string): number {
  const target = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

export function HealthPanel({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const [checks, setChecks] = useState<HealthCheck[]>([]);

  useEffect(() => {
    // PAT GitHub: sin expiración explícita; ojo a la próxima rotación manual
    const patStatus: HealthCheck['status'] = 'ok';
    const patDetail = 'Sin expiración (renovado 16/05/2026 — PAT classic ghp_MVr8...)';

    const initial: HealthCheck[] = [
      {
        id: 'github-pat',
        label: 'GitHub PAT',
        status: patStatus,
        detail: patDetail,
        icon: <Github size={14} />,
      },
      {
        id: 'notion-api',
        label: 'Notion API',
        status: 'unknown',
        detail: 'Health check no implementado — ver tab Agentes/Delegaciones',
        icon: <Database size={14} />,
      },
      {
        id: 'gas-webhook',
        label: 'Webhook GAS (doPost)',
        status: 'warn',
        detail: 'Devuelve Unauthorized desde 11/05/2026 — AER-162 pendiente',
        icon: <Webhook size={14} />,
      },
      {
        id: 'vercel',
        label: 'Vercel deploy',
        status: 'ok',
        detail: 'aeroreclaim-dashboard.vercel.app · keep-warm cron activo (AER-82)',
        icon: <Globe size={14} />,
      },
    ];

    // Async fetch real de /api/health si existe
    fetch('/api/health')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j) return setChecks(initial);
        // si la API devuelve checks reales, usar esos; si no, mantener initial
        if (Array.isArray(j.checks)) {
          setChecks(j.checks.map((c: { id: string; label: string; status: string; detail: string }) => ({
            ...c,
            icon: initial.find(i => i.id === c.id)?.icon ?? <Activity size={14} />,
          })));
        } else {
          setChecks(initial);
        }
      })
      .catch(() => setChecks(initial));
  }, []);

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
          <Activity size={18} className="text-accent" />
          Health
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          Estado de servicios externos críticos · auditoría semanal por EL AUDITOR
        </p>
      </div>

      {/* Health checks */}
      <div className="bg-surface-card border border-edge/60 rounded-xl overflow-hidden">
        {checks.map((c, i) => {
          const s = STATUS[c.status];
          return (
            <div
              key={c.id}
              className={clsx(
                'flex items-center justify-between gap-3 px-4 py-3',
                i < checks.length - 1 && 'border-b border-edge/30',
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-ink-muted mt-0.5 shrink-0">{c.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{c.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5 truncate">{c.detail}</p>
                </div>
              </div>
              <div className={clsx('flex items-center gap-1.5 shrink-0', s.color)}>
                <div className={clsx('w-2 h-2 rounded-full', s.dot)} />
                <span className="text-xs font-medium uppercase">{c.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Theme */}
      <div className="bg-surface-card border border-edge/60 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Tema</p>
          <p className="text-xs text-ink-muted mt-0.5">Cambia entre modo oscuro y claro</p>
        </div>
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-edge/60 rounded-lg text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {isDark ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </div>

      {/* Config técnica */}
      <div className="bg-surface-card border border-edge/60 rounded-xl p-4">
        <p className="text-sm font-medium text-ink mb-2">Bases de datos</p>
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          <p>DB Delegaciones: <code className="font-mono text-accent bg-surface-elevated px-1 rounded">3238a573e75780788631e231b8f7c3cb</code></p>
          <p>DB Task Tracker (Roadmap): <code className="font-mono text-accent bg-surface-elevated px-1 rounded">abb1607fb6b0460782fc0d268a7ce21f</code></p>
          <p>Page Bandeja de Pol: <code className="font-mono text-accent bg-surface-elevated px-1 rounded">3438a573e757819c8985f031ec4b9a82</code></p>
          <p>Sheets Cases: <code className="font-mono text-accent bg-surface-elevated px-1 rounded">GAS_CASES_ENDPOINT</code> (vía Apps Script web app)</p>
        </div>
      </div>
    </div>
  );
}
