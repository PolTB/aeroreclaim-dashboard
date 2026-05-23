'use client';

import { useState } from 'react';
import { Target, AlertTriangle, CheckCircle2, Compass, Calendar } from 'lucide-react';
import clsx from 'clsx';

interface Kpi {
  id: string;
  label: string;
  category: 'embudo' | 'eficiencia' | 'ingreso';
  value: string | null;
  target?: string;
  status?: 'ok' | 'warn' | 'bad' | 'unknown';
  note?: string;
}

const KPIS: Kpi[] = [
  { id: 'trafico',       label: 'Tráfico cualificado',       category: 'embudo',     value: null, status: 'unknown', note: 'GA4 — pendiente de integrar' },
  { id: 'prevalidador',  label: '% uso pre-validador',       category: 'embudo',     value: null, status: 'unknown' },
  { id: 'elegibilidad',  label: '% elegibilidad',            category: 'embudo',     value: null, status: 'unknown' },
  { id: 'inicio_mandato',label: '% inicio mandato',          category: 'embudo',     value: null, status: 'unknown' },
  { id: 'mandato_firmado',label: '% mandato firmado',        category: 'embudo',     value: null, status: 'unknown' },
  { id: 'expedientes_completos', label: 'Expedientes completos', category: 'eficiencia', value: null, status: 'unknown' },
  { id: 'expedientes_enviados',  label: 'Expedientes enviados',  category: 'eficiencia', value: null, status: 'unknown' },
  { id: 'cpa_mandato',   label: 'Coste / mandato firmado',   category: 'ingreso',    value: null, status: 'unknown' },
  { id: 'ingreso_real',  label: 'Casos cobrados / ingreso',  category: 'ingreso',    value: '0€', target: '450€ (Alicia 24/07)', status: 'warn' },
];

const GATILLOS = [
  {
    dia: 14,
    fecha: '19 mayo 2026',
    pasado: true,
    criterio: '<3 mandatos firmados',
    accion: 'problema de conversión web/mensaje, doblar fixes web',
  },
  {
    dia: 30,
    fecha: '30 mayo 2026',
    pasado: false,
    criterio: '<5 → replantear canal · 5-9 → escalar landing ganadora · ≥10 → escalar agresivamente',
    accion: 'evaluar KPI mandatos firmados',
  },
  {
    dia: 60,
    fecha: '29 junio 2026',
    pasado: false,
    criterio: 'sin motor de adquisición repetible',
    accion: 'pivote vertical (B2B / aerolínea específica)',
  },
];

const NO_HACER = [
  'No nuevas features de producto',
  'No suscripción Premium (prematura)',
  'No widget viral / B2B white-label / GPT custom',
  'No abrir más aerolíneas hasta dominar VY/UX/FR/I2',
  'No matar Google Ads (test pequeño, NO religión)',
  'No usar caso Alicia como victoria pública hasta cobrar',
  'No activar Managed Agents antes de >20 casos/mes',
];

const STATUS_STYLE = {
  ok:      { color: 'text-emerald-400', dot: 'bg-emerald-400' },
  warn:    { color: 'text-amber-400',   dot: 'bg-amber-400' },
  bad:     { color: 'text-red-400',     dot: 'bg-red-400' },
  unknown: { color: 'text-ink-faint',   dot: 'bg-ink-faint/40' },
} as const;

const CATEGORY_LABEL = {
  embudo:     'Embudo',
  eficiencia: 'Eficiencia operativa',
  ingreso:    'Ingreso',
} as const;

export function NortePanel() {
  const [tab, setTab] = useState<'kpis' | 'gatillos' | 'no-hacer'>('kpis');

  const groupedKpis: Record<string, Kpi[]> = KPIS.reduce((acc, k) => {
    (acc[k.category] ||= []).push(k);
    return acc;
  }, {} as Record<string, Kpi[]>);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <Compass size={18} className="text-accent" />
            Norte estratégico
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Revisado 30 abril 2026 — post-Council + Hormozi · KPI 30d: <span className="text-ink-secondary font-medium">10 mandatos firmados</span>
          </p>
        </div>
        <div className="flex bg-surface-card border border-edge/60 rounded-lg p-0.5 gap-0.5">
          {(['kpis','gatillos','no-hacer'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === t ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              {t === 'kpis' ? '9 KPIs' : t === 'gatillos' ? 'Gatillos' : 'No hacer'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'kpis' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['embudo','eficiencia','ingreso'] as const).map(cat => (
            <div key={cat} className="bg-surface-card border border-edge/60 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-3">
                {CATEGORY_LABEL[cat]}
              </p>
              <div className="flex flex-col gap-3">
                {groupedKpis[cat]?.map(k => {
                  const s = STATUS_STYLE[k.status ?? 'unknown'];
                  return (
                    <div key={k.id} className="flex items-start justify-between gap-2 pb-2 border-b border-edge/30 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs text-ink-secondary font-medium truncate">{k.label}</p>
                        {k.note && <p className="text-[10px] text-ink-faint mt-0.5">{k.note}</p>}
                        {k.target && <p className="text-[10px] text-ink-faint mt-0.5">Target: {k.target}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
                        <span className={clsx('text-xs font-semibold tabular-nums', s.color)}>
                          {k.value ?? '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'gatillos' && (
        <div className="flex flex-col gap-3">
          {GATILLOS.map(g => (
            <div
              key={g.dia}
              className={clsx(
                'bg-surface-card border rounded-xl p-4',
                g.pasado ? 'border-edge/40 opacity-60' : 'border-edge/60',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-accent" />
                  <span className="text-sm font-semibold text-ink">Día {g.dia}</span>
                  <span className="text-xs text-ink-muted">— {g.fecha}</span>
                  {g.pasado && <span className="text-[10px] px-1.5 py-0.5 bg-ink-faint/10 text-ink-muted rounded">pasado</span>}
                </div>
              </div>
              <p className="text-xs text-ink-secondary">
                <span className="font-medium text-ink">Si</span> {g.criterio}
              </p>
              <p className="text-xs text-ink-muted mt-1">
                <span className="font-medium text-ink-secondary">→</span> {g.accion}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'no-hacer' && (
        <div className="bg-surface-card border border-edge/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-ink">Lo que NO hacer ahora</span>
          </div>
          <ul className="flex flex-col gap-2">
            {NO_HACER.map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-ink-secondary">
                <span className="text-red-400 mt-0.5">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-ink-faint mt-4 pt-3 border-t border-edge/30">
            Fuente: ACTIVE_CONTEXT.md sección NORTE ESTRATÉGICO · revisado post-Council 30/04/2026
          </p>
        </div>
      )}
    </div>
  );
}
