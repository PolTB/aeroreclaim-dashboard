'use client';

import { Check, Clock, Bot, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import type { AeroCaso, StageStatus } from '@/types';
import { PIPELINE_STAGES } from '@/types';

// ─── Stage icon ───────────────────────────────────────────────────────────────

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'completada') {
    return (
      <div className="w-7 h-7 rounded-full bg-success flex items-center justify-center shadow-sm shrink-0">
        <Check size={12} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'activa') {
    return (
      <div className="w-7 h-7 rounded-full bg-warn flex items-center justify-center shadow-sm animate-pulse-soft shrink-0">
        <Clock size={12} className="text-white" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full border-2 border-edge bg-surface-card flex items-center justify-center shrink-0">
      <div className="w-1.5 h-1.5 rounded-full bg-ink-faint" />
    </div>
  );
}

// ─── Confirmation indicators ──────────────────────────────────────────────────

function ConfirmDots({ agente, manual }: { agente: boolean; manual: boolean }) {
  return (
    <div className="flex gap-0.5 mt-1">
      <span
        title={agente ? 'Agente confirmó ✓' : 'Agente pendiente'}
        className={clsx(
          'flex items-center justify-center w-3.5 h-3.5 rounded-full',
          agente ? 'bg-success/20 text-success' : 'bg-edge/60 text-ink-faint',
        )}
      >
        <Bot size={8} />
      </span>
      <span
        title={manual ? 'Confirmación manual ✓' : 'Confirmación manual pendiente'}
        className={clsx(
          'flex items-center justify-center w-3.5 h-3.5 rounded-full',
          manual ? 'bg-accent/20 text-accent' : 'bg-edge/60 text-ink-faint',
        )}
      >
        <User size={8} />
      </span>
    </div>
  );
}

// ─── Pipeline stepper ─────────────────────────────────────────────────────────

export function CasePipeline({ caso }: { caso: AeroCaso }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-1">
      <div className="flex items-start min-w-max">
        {PIPELINE_STAGES.map((stage, index) => {
          const info      = caso.pipeline[stage];
          const isLast    = index === PIPELINE_STAGES.length - 1;
          const isActive  = info.estado === 'activa';
          const isDone    = info.estado === 'completada';

          return (
            <div key={stage} className="flex items-start">
              {/* Node + label */}
              <div className="flex flex-col items-center w-[72px]">
                <StageIcon status={info.estado} />

                <p className={clsx(
                  'text-center text-[9px] mt-1 leading-tight font-medium px-0.5',
                  isActive ? 'text-warn'
                    : isDone ? 'text-ink-secondary'
                    : 'text-ink-faint',
                )}>
                  {stage}
                </p>

                {info.fecha && (
                  <p className="text-[8px] text-ink-faint mt-0.5 text-center">
                    {format(parseISO(info.fecha), 'd MMM', { locale: es })}
                  </p>
                )}

                <ConfirmDots agente={info.confirmacionAgente} manual={info.confirmacionManual} />
              </div>

              {/* Connector */}
              {!isLast && (
                <div className={clsx(
                  'h-px w-3 mt-3.5 shrink-0',
                  isDone ? 'bg-success/40' : 'bg-edge',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-edge/30">
        <div className="flex items-center gap-1 text-[9px] text-ink-faint">
          <div className="w-3 h-3 rounded-full bg-success/20 flex items-center justify-center">
            <Bot size={7} className="text-success" />
          </div>
          Agente
        </div>
        <div className="flex items-center gap-1 text-[9px] text-ink-faint">
          <div className="w-3 h-3 rounded-full bg-accent/20 flex items-center justify-center">
            <User size={7} className="text-accent" />
          </div>
          Manual/Email
        </div>
      </div>
    </div>
  );
}
