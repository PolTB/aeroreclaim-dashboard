'use client';

import { useState } from 'react';
import { Briefcase, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { CaseTracker } from './CaseTracker';
import { PipelineLeads } from './PipelineLeads';
import { RadarPanel } from './RadarPanel'; // AER-224: sección aditiva, no toca los sub-tabs

type CasesTab = 'mandatos' | 'pipeline';

export function CasesView() {
  const [tab, setTab] = useState<CasesTab>('mandatos');

  return (
    <div className="flex flex-col gap-4">
      {/* AER-224: Radar de Casos — siempre visible, independiente del sub-tab activo */}
      <RadarPanel />

      {/* Sub-tab nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('mandatos')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
            tab === 'mandatos'
              ? 'bg-accent text-white border-accent'
              : 'bg-surface-card text-ink-muted hover:text-ink-secondary border-edge/60',
          )}
        >
          <Briefcase size={13} />
          Mandatos firmados
        </button>
        <button
          onClick={() => setTab('pipeline')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
            tab === 'pipeline'
              ? 'bg-accent text-white border-accent'
              : 'bg-surface-card text-ink-muted hover:text-ink-secondary border-edge/60',
          )}
        >
          <TrendingUp size={13} />
          Pipeline leads
        </button>
        <span className="ml-2 text-[10px] text-ink-faint">
          {tab === 'mandatos'
            ? 'Casos reales con mandato firmado (Alicia, Eduardo, Irene, Keily, Matheus…)'
            : 'Leads en scoring previo a aprobación'}
        </span>
      </div>

      {/* Render */}
      {tab === 'mandatos' ? <CaseTracker /> : <PipelineLeads />}
    </div>
  );
}
