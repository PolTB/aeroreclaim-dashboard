'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Plus, Copy, Clock, AlertCircle, ChevronDown,
  RefreshCw, Loader2, Check, Bot, Send, History, AlertTriangle,
  Inbox, Ban, ArrowLeftRight, X, MessageSquare
} from 'lucide-react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NotionCommand, CommandEstado, CommandDestinatario, CommandPrioridad, CreateCommandPayload } from '@/types';
import {
  COMMAND_DESTINATARIOS, COMMAND_ESTADO_CONFIG, COMMAND_ESTADO_ORDER,
  ACTIVE_ESTADOS, ARCHIVED_ESTADOS
} from '@/types';

// ─── Estado badge ──────────────────────────────────────────────────────────────

const ESTADO_ICONS: Record<CommandEstado, React.ReactNode> = {
  'Pendiente':            <Clock size={10} />,
  'En Proceso':           <Loader2 size={10} className="animate-spin" />,
  'Respuesta Recibida':   <Inbox size={10} />,
  'Completado':           <Check size={10} />,
  'Bloqueado':            <AlertTriangle size={10} />,
  'Cancelado':            <Ban size={10} />,
};

function EstadoBadge({ estado }: { estado: CommandEstado }) {
  const cfg = COMMAND_ESTADO_CONFIG[estado] ?? COMMAND_ESTADO_CONFIG['Pendiente'];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {ESTADO_ICONS[estado] ?? <Clock size={10} />}
      {cfg.label}
    </span>
  );
}

// ─── Destinatario badge ────────────────────────────────────────────────────────

const DEST_COLORS: Record<string, string> = {
  'Claude CoWork': '#8b5cf6',
  'Claude Code':   '#3b82f6',
  'Claude Chat':   '#6366f1',
  'Comet':         '#ec4899',
  'ChatGPT':       '#10b981',
  'Manual':        '#6b7280',
};

function DestBadge({ dest }: { dest: CommandDestinatario | null }) {
  if (!dest) return null;
  const color = DEST_COLORS[dest] ?? '#6b7280';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ color, backgroundColor: color + '20' }}
    >
      <Bot size={10} />
      {dest}
    </span>
  );
}

// ─── Estado Selector (bidirectional) ────────────────────────────────────────────

function EstadoSelector({
  current,
  onSelect,
  disabled,
}: {
  current: CommandEstado;
  onSelect: (estado: CommandEstado) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allEstados = Object.keys(COMMAND_ESTADO_CONFIG) as CommandEstado[];
  const otherEstados = allEstados.filter(e => e !== current);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-elevated border border-edge/60 rounded-lg text-[11px] font-medium text-ink-secondary hover:text-ink hover:border-edge-bright transition-all disabled:opacity-50"
      >
        <ArrowLeftRight size={11} />
        Cambiar estado
        <ChevronDown size={10} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 bottom-full mb-1 left-0 bg-surface-card border border-edge rounded-xl shadow-xl min-w-[200px] py-1 overflow-hidden"
          >
            {otherEstados.map(estado => {
              const cfg = COMMAND_ESTADO_CONFIG[estado];
              return (
                <button
                  key={estado}
                  onClick={() => { onSelect(estado); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-elevated transition-colors"
                >
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                    style={{ color: cfg.color, backgroundColor: cfg.bg }}
                  >
                    {ESTADO_ICONS[estado]}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-ink">{cfg.label}</p>
                    <p className="text-[10px] text-ink-faint">{cfg.description}</p>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Command Card ──────────────────────────────────────────────────────────────

interface CommandCardProps {
  command: NotionCommand;
  onUpdate: (id: string, updates: Partial<NotionCommand>) => Promise<void>;
  onCopyPrompt: (text: string) => void;
  onDelete: (id: string) => void;
}

function CommandCard({ command, onUpdate, onCopyPrompt, onDelete }: CommandCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [respuesta, setRespuesta] = useState(command.respuesta);
  const [subchat, setSubchat] = useState(command.subchat || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function changeEstado(estado: CommandEstado) {
    setSaving(true);
    try {
      const updates: Partial<NotionCommand> = { estado };
      if (estado === 'Completado') {
        updates.fechaCompletado = new Date().toISOString().split('T')[0];
      }
      if (estado === 'Pendiente') {
        updates.fechaCompletado = null;
      }
      await onUpdate(command.id, updates);
    } finally {
      setSaving(false);
    }
  }

  async function saveRespuesta() {
    setSaving(true);
    try {
      await onUpdate(command.id, {
        respuesta,
        estado: 'Respuesta Recibida',
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveSubchat() {
    setSaving(true);
    try {
      await onUpdate(command.id, { subchat });
    } finally {
      setSaving(false);
    }
  }

  function copyPrompt() {
    onCopyPrompt(command.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isArchived = ARCHIVED_ESTADOS.includes(command.estado);
  const showRespuestaInput = !isArchived && command.estado !== 'Cancelado';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'rounded-xl border transition-all',
        isArchived
          ? 'bg-surface-card/50 border-edge/30 opacity-70'
          : command.estado === 'Bloqueado'
            ? 'bg-surface-card border-orange-500/30'
            : command.estado === 'Respuesta Recibida'
              ? 'bg-surface-card border-yellow-500/30'
              : 'bg-surface-card border-edge/60 hover:border-edge-bright'
      )}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-3.5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <Terminal size={14} className="mt-0.5 shrink-0 text-accent" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className={clsx('text-sm font-medium', isArchived ? 'text-ink-muted line-through' : 'text-ink')}>
              {command.titulo}
            </p>
            <EstadoBadge estado={command.estado} />
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <DestBadge dest={command.destinatario} />
            {command.prioridad && (
              <span className={clsx(
                'text-[10px] font-medium px-1.5 py-0.5 rounded',
                command.prioridad === 'Alta' ? 'text-red-400 bg-red-500/10' :
                command.prioridad === 'Baja' ? 'text-green-400 bg-green-500/10' :
                'text-ink-muted'
              )}>
                {command.prioridad}
              </span>
            )}
            {command.fechaCreacion && (
              <span className="text-[10px] text-ink-faint">
                {format(parseISO(command.fechaCreacion), 'd MMM', { locale: es })}
              </span>
            )}
            {command.subchat && (
              <span className="text-[10px] text-ink-faint flex items-center gap-0.5">
                <MessageSquare size={9} />
                {command.subchat}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={clsx('text-ink-muted transition-transform shrink-0 mt-0.5', expanded && 'rotate-180')}
        />
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="px-3.5 pb-3.5 pt-0 flex flex-col gap-3 border-t border-edge/30">
              {/* Prompt */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Prompt</span>
                  <button
                    onClick={copyPrompt}
                    className={clsx(
                      'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition-all',
                      copied
                        ? 'bg-success/20 text-success'
                        : 'bg-surface-elevated text-ink-muted hover:text-ink-secondary'
                    )}
                  >
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <pre className="text-xs text-ink-secondary bg-surface-elevated rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                  {command.prompt || '(sin prompt)'}
                </pre>
              </div>

              {/* Subchat field */}
              <div>
                <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-1.5">
                  Subchat / Referencia
                </span>
                <div className="flex gap-2">
                  <input
                    value={subchat}
                    onChange={e => setSubchat(e.target.value)}
                    placeholder="Nombre del chat donde enviaste el prompt..."
                    className="flex-1 bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
                  />
                  {subchat !== (command.subchat || '') && (
                    <button
                      onClick={saveSubchat}
                      disabled={saving}
                      className="px-2.5 py-1.5 bg-accent/15 text-accent text-[10px] font-medium rounded-lg hover:bg-accent/25 transition-colors disabled:opacity-50"
                    >
                      Guardar
                    </button>
                  )}
                </div>
              </div>

              {/* Respuesta input/display */}
              {showRespuestaInput && (
                <div>
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-1.5">
                    Respuesta del agente
                  </span>
                  <textarea
                    value={respuesta}
                    onChange={e => setRespuesta(e.target.value)}
                    placeholder="Pega aquí la respuesta del agente..."
                    className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:border-accent/60 min-h-[80px]"
                    rows={4}
                  />
                  {respuesta !== command.respuesta && respuesta.trim() && (
                    <button
                      onClick={saveRespuesta}
                      disabled={saving}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/15 text-yellow-500 text-xs font-medium rounded-lg hover:bg-yellow-500/25 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <Inbox size={11} />}
                      Guardar respuesta
                    </button>
                  )}
                </div>
              )}
              {isArchived && command.respuesta && (
                <div>
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-1.5">Respuesta</span>
                  <pre className="text-xs text-ink-secondary bg-surface-elevated rounded-lg p-3 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                    {command.respuesta}
                  </pre>
                  {command.fechaCompletado && (
                    <p className="text-[10px] text-ink-faint mt-1">
                      Completado: {format(parseISO(command.fechaCompletado), 'd MMM yyyy', { locale: es })}
                    </p>
                  )}
                </div>
              )}

              {/* Actions row */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-edge/20">
                {/* Estado selector — always available, bidirectional */}
                <EstadoSelector
                  current={command.estado}
                  onSelect={changeEstado}
                  disabled={saving}
                />

                {/* Quick actions based on current estado */}
                {command.estado === 'Pendiente' && (
                  <button
                    onClick={() => changeEstado('En Proceso')}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                  >
                    <Send size={11} />
                    Marcar enviado
                  </button>
                )}
                {command.estado === 'Respuesta Recibida' && (
                  <button
                    onClick={() => changeEstado('Completado')}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/25 transition-colors disabled:opacity-50"
                  >
                    <Check size={11} />
                    Aprobar y completar
                  </button>
                )}
                {command.estado === 'Bloqueado' && (
                  <button
                    onClick={() => changeEstado('Pendiente')}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/15 text-gray-400 text-xs font-medium rounded-lg hover:bg-gray-500/25 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} />
                    Replantear
                  </button>
                )}

                {/* Cancel/delete */}
                <button
                  onClick={() => onDelete(command.id)}
                  className="ml-auto flex items-center gap-1 px-2 py-1.5 text-[10px] text-ink-faint hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Create Command Modal ──────────────────────────────────────────────────────

interface CreateCommandModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateCommandModal({ onClose, onCreated }: CreateCommandModalProps) {
  const [titulo, setTitulo] = useState('');
  const [destinatario, setDestinatario] = useState<CommandDestinatario | ''>('');
  const [prompt, setPrompt] = useState('');
  const [prioridad, setPrioridad] = useState<CommandPrioridad | ''>('Media');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateCommandPayload = {
        titulo: titulo.trim(),
        prompt: prompt.trim(),
        destinatario: destinatario || null,
        prioridad: (prioridad || null) as CommandPrioridad | null,
      };
      const res = await fetch('/api/notion/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al crear command');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-surface-card border border-edge rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-edge/40">
          <div className="flex items-center gap-2">
            <Terminal size={15} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Nuevo Command</h2>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-1.5">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="ej: Fix Resumen_Fiscal, Logo AeroReclaim..."
              className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">Destinatario</label>
              <select
                value={destinatario}
                onChange={e => setDestinatario(e.target.value as CommandDestinatario | '')}
                className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/60"
              >
                <option value="">Sin asignar</option>
                {COMMAND_DESTINATARIOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">Prioridad</label>
              <select
                value={prioridad}
                onChange={e => setPrioridad(e.target.value as CommandPrioridad | '')}
                className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/60"
              >
                <option value="">Sin prioridad</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Escribe el prompt completo para el agente..."
              rows={5}
              className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:border-accent/60 font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-ink-muted hover:text-ink rounded-lg">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !titulo.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Crear command
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Setup Banner ──────────────────────────────────────────────────────────────

function SetupBanner() {
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/5 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-warn" />
        <h3 className="text-sm font-semibold text-ink">Setup requerido: Base de datos de Commands</h3>
      </div>
      <p className="text-xs text-ink-muted leading-relaxed">
        La variable <code className="bg-surface-elevated px-1 py-0.5 rounded text-accent font-mono">COMMANDS_DATABASE_ID</code> no está configurada en Vercel.
      </p>
    </div>
  );
}

// ─── Main Command Center ───────────────────────────────────────────────────────

export function CommandCenter() {
  const [commands, setCommands] = useState<NotionCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const fetchCommands = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notion/commands');
      const data = await res.json();
      if (!res.ok) {
        if (data.needsSetup) { setNeedsSetup(true); return; }
        throw new Error(data.error ?? 'Error cargando commands');
      }
      setCommands(data.commands);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCommands(); }, [fetchCommands]);

  const updateCommand = useCallback(async (id: string, updates: Partial<NotionCommand>) => {
    setCommands(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const res = await fetch(`/api/notion/commands/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      fetchCommands(true);
      throw new Error('Error al actualizar');
    }
  }, [fetchCommands]);

  const cancelCommand = useCallback(async (id: string) => {
    await updateCommand(id, { estado: 'Cancelado' as CommandEstado });
  }, [updateCommand]);

  function handleCopyPrompt(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  }

  const activeCommands = commands.filter(c => ACTIVE_ESTADOS.includes(c.estado));
  const historyCommands = commands.filter(c => ARCHIVED_ESTADOS.includes(c.estado));

  const sortedActive = [...activeCommands].sort((a, b) =>
    COMMAND_ESTADO_ORDER[a.estado] - COMMAND_ESTADO_ORDER[b.estado]
  );

  // Count by estado
  const counts = activeCommands.reduce((acc, c) => {
    acc[c.estado] = (acc[c.estado] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Terminal size={15} className="text-accent" />
            Command Center
          </h2>
          <div className="flex items-center gap-3 mt-1">
            {Object.entries(counts).map(([estado, count]) => {
              const cfg = COMMAND_ESTADO_CONFIG[estado as CommandEstado];
              if (!cfg) return null;
              return (
                <span key={estado} className="text-[10px] flex items-center gap-1" style={{ color: cfg.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                  {count} {cfg.label.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCommands(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
          >
            <RefreshCw size={13} className={clsx(refreshing && 'animate-spin text-accent')} />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-xl transition-colors shadow-sm"
          >
            <Plus size={12} />
            Nuevo
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-xs text-red-400">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Error cargando commands</p>
            <p className="mt-0.5 text-red-400/70">{error}</p>
            <button onClick={() => fetchCommands()} className="mt-1.5 underline underline-offset-2">Reintentar</button>
          </div>
        </div>
      )}

      {needsSetup && <SetupBanner />}

      {!needsSetup && (
        <>
          <div className="flex flex-col gap-3">
            {sortedActive.length === 0 ? (
              <div className="text-center py-12 text-ink-muted">
                <Terminal size={24} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No hay commands activos</p>
                <p className="text-xs mt-1 text-ink-faint">Crea un nuevo command para empezar</p>
              </div>
            ) : (
              sortedActive.map(cmd => (
                <CommandCard
                  key={cmd.id}
                  command={cmd}
                  onUpdate={updateCommand}
                  onCopyPrompt={handleCopyPrompt}
                  onDelete={cancelCommand}
                />
              ))
            )}
          </div>

          {historyCommands.length > 0 && (
            <div className="border-t border-edge/30 pt-4">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink-secondary transition-colors"
              >
                <History size={13} />
                <span>Historial ({historyCommands.length})</span>
                <ChevronDown size={12} className={clsx('transition-transform', showHistory && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-3 flex flex-col gap-2"
                  >
                    {historyCommands.map(cmd => (
                      <CommandCard
                        key={cmd.id}
                        command={cmd}
                        onUpdate={updateCommand}
                        onCopyPrompt={handleCopyPrompt}
                        onDelete={cancelCommand}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {isCreateOpen && (
        <CreateCommandModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => { setIsCreateOpen(false); fetchCommands(true); }}
        />
      )}

      <AnimatePresence>
        {copiedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-success/20 border border-success/30 text-success text-xs font-medium rounded-full backdrop-blur-sm shadow-lg"
          >
            <Check size={12} />
            Prompt copiado al portapapeles
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
