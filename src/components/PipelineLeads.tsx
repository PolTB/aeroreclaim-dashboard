'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, CheckCircle2, XCircle, Mail, AlertTriangle,
  TrendingUp, Clock, Euro, Users, ExternalLink
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PipelineLead {
  caseId: string;
  name: string;
  email: string;
  flight: string;
  airline: string;
  compensation: number;
  status: string;
  statusLabel: string;
  statusColor: string;
  daysSinceMandate: number;
  nextAction: string;
  nextActionDate: string;
  welcomeSentDate: string | null;
}

interface Kpis {
  activeCount: number;
  totalEur: number;
  oldestDays: number;
  conversion30d: number | null;
}

interface PipelineData {
  leads: PipelineLead[];
  kpis: Kpis;
  source: string;
  error?: string;
}

// ─── Status badge config ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { dot: string; badge: string; ring: string }> = {
  mandato_enviado: {
    dot:   'bg-success',
    badge: 'bg-success/10 text-success border-success/20',
    ring:  'ring-success/20',
  },
  recordatorio_1: {
    dot:   'bg-warn',
    badge: 'bg-warn/10 text-warn border-warn/20',
    ring:  'ring-warn/20',
  },
  recordatorio_2: {
    dot:   'bg-orange-400',
    badge: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
    ring:  'ring-orange-400/20',
  },
  ultimo_intento: {
    dot:   'bg-danger',
    badge: 'bg-danger/10 text-danger border-danger/20',
    ring:  'ring-danger/20',
  },
  perdido: {
    dot:   'bg-ink-muted',
    badge: 'bg-surface-elevated text-ink-muted border-edge',
    ring:  'ring-edge',
  },
};

// ─── Cadence progress bar ─────────────────────────────────────────────────────
function CadenceBar({ days }: { days: number }) {
  const max   = 14;
  const pct   = Math.min(100, (days / max) * 100);
  const color = days <= 1 ? '#22c55e'
              : days <= 4 ? '#f59e0b'
              : days <= 6 ? '#f97316'
              : days <= 13 ? '#ef4444'
              : '#55556a';

  return (
    <div className="w-full mt-1">
      <div className="h-1 bg-edge rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-ink-muted">T+0</span>
        <span className="text-[10px] font-mono text-ink-secondary">T+{days}</span>
        <span className="text-[10px] text-ink-muted">T+14</span>
      </div>
    </div>
  );
}

// ─── Lost modal ───────────────────────────────────────────────────────────────
function LostModal({
  lead,
  onConfirm,
  onCancel,
}: {
  lead: PipelineLead;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        className="relative bg-surface-card border border-edge rounded-2xl p-6 w-full max-w-md shadow-xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h3 className="font-semibold text-ink mb-1">Marcar como perdido</h3>
        <p className="text-sm text-ink-secondary mb-4">
          {lead.name} — {lead.flight} — {lead.compensation}€
        </p>
        <textarea
          className="w-full bg-surface-secondary border border-edge rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted resize-none focus:outline-none focus:border-accent/50"
          rows={3}
          placeholder="Motivo (no responde, número equivocado, desistió…)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-edge text-ink-secondary hover:border-accent/30 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason || 'Sin motivo especificado')}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 transition-colors font-medium"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Lead row ─────────────────────────────────────────────────────────────────
function LeadRow({
  lead,
  onSign,
  onLost,
  signing,
}: {
  lead: PipelineLead;
  onSign: (id: string) => void;
  onLost: (lead: PipelineLead) => void;
  signing: string | null;
}) {
  const cfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.perdido;
  const isOld = lead.daysSinceMandate >= 7;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={clsx(
        'group border-b border-edge/50 last:border-0 transition-colors',
        isOld ? 'hover:bg-danger/5' : 'hover:bg-surface-hover/60'
      )}
    >
      {/* Pasajero */}
      <td className="py-3.5 pl-4 pr-2">
        <div className="flex items-start gap-2.5">
          <span className={clsx('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
          <div>
            <p className="text-sm font-medium text-ink leading-tight">{lead.name}</p>
            <a
              href={`https://mail.google.com/mail/u/0/#search/from:${encodeURIComponent(lead.email)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-muted hover:text-accent flex items-center gap-1 mt-0.5 transition-colors"
            >
              {lead.email}
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </td>

      {/* Vuelo */}
      <td className="py-3.5 px-2">
        <p className="text-sm font-mono text-ink">{lead.flight}</p>
        <p className="text-xs text-ink-muted truncate max-w-[120px]">{lead.airline}</p>
      </td>

      {/* Importe */}
      <td className="py-3.5 px-2">
        <span className="text-sm font-semibold text-accent">{lead.compensation}€</span>
      </td>

      {/* Estado + barra */}
      <td className="py-3.5 px-2 min-w-[140px]">
        <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium', cfg.badge)}>
          {lead.statusLabel}
        </span>
        <CadenceBar days={lead.daysSinceMandate} />
      </td>

      {/* T+N */}
      <td className="py-3.5 px-2 text-center">
        <span className={clsx(
          'text-sm font-mono font-bold',
          lead.daysSinceMandate >= 7 ? 'text-danger' :
          lead.daysSinceMandate >= 5 ? 'text-orange-400' :
          lead.daysSinceMandate >= 2 ? 'text-warn' : 'text-success'
        )}>
          T+{lead.daysSinceMandate}
        </span>
      </td>

      {/* Próxima acción */}
      <td className="py-3.5 px-2">
        <p className="text-xs text-ink-secondary leading-snug max-w-[160px]">{lead.nextAction}</p>
        <p className="text-[10px] text-ink-muted mt-0.5">{lead.nextActionDate}</p>
      </td>

      {/* Acciones */}
      <td className="py-3.5 pl-2 pr-4">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSign(lead.caseId)}
            disabled={signing === lead.caseId}
            title="Marcar como firmado"
            className={clsx(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
              signing === lead.caseId
                ? 'bg-success/5 border-success/20 text-success/50 cursor-wait'
                : 'bg-success/10 border-success/30 text-success hover:bg-success/20'
            )}
          >
            <CheckCircle2 size={12} />
            {signing === lead.caseId ? '...' : 'Firmado'}
          </button>

          <button
            onClick={() => onLost(lead)}
            title="Marcar como perdido"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-danger/20 bg-danger/5 text-danger text-xs font-medium hover:bg-danger/15 transition-colors"
          >
            <XCircle size={12} />
            Perdido
          </button>

          <a
            href={`https://mail.google.com/mail/u/0/#search/from:${encodeURIComponent(lead.email)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver historial Gmail"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-edge text-ink-muted text-xs hover:border-accent/30 hover:text-accent transition-colors"
          >
            <Mail size={12} />
            Gmail
          </a>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, alert,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; alert?: boolean;
}) {
  return (
    <div className={clsx(
      'flex items-start gap-3 bg-surface-card border rounded-xl p-4',
      alert ? 'border-danger/30 ring-1 ring-danger/20' : 'border-edge'
    )}>
      <div className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
        alert ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
      )}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-ink leading-none">{value}</p>
        <p className="text-xs text-ink-secondary mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-ink-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PipelineLeads() {
  const [data, setData]         = useState<PipelineData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [signing, setSigning]   = useState<string | null>(null);
  const [lostModal, setLostModal] = useState<PipelineLead | null>(null);
  const [toast, setToast]       = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline-leads', { cache: 'no-store' });
      const d   = await res.json();
      setData(d);
    } catch {
      showToast('Error cargando datos', 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSign = async (caseId: string) => {
    setSigning(caseId);
    try {
      const res = await fetch('/api/pipeline-leads/mark-signed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const d = await res.json();
      if (d.ok) {
        showToast('✅ Marcado como firmado — actualizar Sheet manualmente');
        setData(prev => prev
          ? { ...prev, leads: prev.leads.filter(l => l.caseId !== caseId) }
          : prev
        );
      } else {
        showToast(d.error ?? 'Error', 'err');
      }
    } catch {
      showToast('Error de red', 'err');
    } finally {
      setSigning(null);
    }
  };

  const handleLostConfirm = async (reason: string) => {
    if (!lostModal) return;
    const caseId = lostModal.caseId;
    setLostModal(null);
    try {
      const res = await fetch('/api/pipeline-leads/mark-lost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, reason }),
      });
      const d = await res.json();
      if (d.ok) {
        showToast('Marcado como perdido — actualizar Sheet manualmente');
        setData(prev => prev
          ? { ...prev, leads: prev.leads.filter(l => l.caseId !== caseId) }
          : prev
        );
      } else {
        showToast(d.error ?? 'Error', 'err');
      }
    } catch {
      showToast('Error de red', 'err');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-ink-muted">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando pipeline...</span>
        </div>
      </div>
    );
  }

  const leads = data?.leads ?? [];
  const kpis  = data?.kpis ?? { activeCount: 0, totalEur: 0, oldestDays: 0, conversion30d: null };

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
            <TrendingUp size={14} className="text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Pipeline — Mandatos pendientes</h2>
            <p className="text-xs text-ink-muted">
              Leads aprobados que aún no han firmado la autorización
              {data?.source === 'mock' || data?.source === 'mock_fallback'
                ? ' · (datos mock — configurar GOOGLE_SHEETS_API_KEY)'
                : ''}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge text-xs text-ink-muted hover:border-accent/30 hover:text-ink transition-colors"
        >
          <RefreshCw size={11} />
          Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Leads activos"
          value={kpis.activeCount}
          icon={<Users size={14} />}
        />
        <KpiCard
          label="Total en juego"
          value={`${kpis.totalEur}€`}
          sub="suma compensaciones"
          icon={<Euro size={14} />}
        />
        <KpiCard
          label="Lead más antiguo"
          value={`T+${kpis.oldestDays}`}
          sub="días sin firma"
          icon={<Clock size={14} />}
          alert={kpis.oldestDays >= 7}
        />
        <KpiCard
          label="Conversión 30d"
          value={kpis.conversion30d !== null ? `${kpis.conversion30d}%` : '—'}
          sub="datos históricos pendientes"
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* Alert si hay leads >= 7 días */}
      {kpis.oldestDays >= 7 && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-danger flex-shrink-0" />
          <p className="text-sm text-danger">
            <strong>Alerta:</strong> hay un lead con {kpis.oldestDays} días sin firma — en fase de último intento.
          </p>
        </div>
      )}

      {/* Table */}
      {leads.length === 0 ? (
        <div className="bg-surface-card border border-edge rounded-xl flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CheckCircle2 size={32} className="text-success/60" />
          <p className="text-sm font-medium text-ink">Sin leads pendientes</p>
          <p className="text-xs text-ink-muted">Todos los mandatos están firmados o archivados</p>
        </div>
      ) : (
        <div className="bg-surface-card border border-edge rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-edge bg-surface-secondary/60">
                  {['Pasajero', 'Vuelo', '€', 'Estado', 'T+N', 'Próxima acción', 'Acciones'].map(h => (
                    <th key={h} className={clsx(
                      'py-2.5 text-[11px] font-medium text-ink-muted uppercase tracking-wider',
                      h === 'Pasajero' ? 'pl-4 pr-2' : h === 'Acciones' ? 'pl-2 pr-4' : 'px-2'
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {leads.map(lead => (
                    <LeadRow
                      key={lead.caseId}
                      lead={lead}
                      onSign={handleSign}
                      onLost={setLostModal}
                      signing={signing}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
        {[
          { color: 'bg-success',      label: '🟢 T+0–1 Mandato enviado' },
          { color: 'bg-warn',         label: '🟡 T+2–4 Recordatorio 1' },
          { color: 'bg-orange-400',   label: '🟠 T+5–6 Recordatorio 2' },
          { color: 'bg-danger',       label: '🔴 T+7–13 Último intento' },
          { color: 'bg-ink-muted',    label: '⚫ T+14+ Perdido' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={clsx('w-2 h-2 rounded-full', color)} />
            {label}
          </span>
        ))}
      </div>

      {/* Lost modal */}
      <AnimatePresence>
        {lostModal && (
          <LostModal
            lead={lostModal}
            onConfirm={handleLostConfirm}
            onCancel={() => setLostModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={clsx(
              'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-sm font-medium shadow-lg',
              toast.type === 'ok'
                ? 'bg-surface-elevated border-success/30 text-success'
                : 'bg-surface-elevated border-danger/30 text-danger'
            )}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
