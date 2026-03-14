'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Plus, Copy, CheckCircle2, Clock, AlertCircle, ChevronDown,
  RefreshCw, Loader2, Check, Bot, Send, History, AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NotionCommand, CommandEstado, CommandDestinatario, CommandPrioridad, CreateCommandPayload } from '@/types';
import { COMMAND_DESTINATARIOS, COMMAND_ESTADO_CONFIG } from '@/types';

// ─── Estado badge ──────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: CommandEstado }) {
  const cfg = COMMAND_ESTADO_CONFIG[estado];
  const icons: Record<CommandEstado, React.ReactNode> = {
    'Pendiente':  <Clock size={10} />,
    'En Proceso': <Loader2 size={10} className="animate-spin" />,
    'Completado': <Check size={10} />,
    'Error':      <AlertTriangle size={10} />,
  };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {icons[estado]}
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

// ─── Command Card ──────────────────────────────────────────────────────────────

interface CommandCardProps {
  command: NotionCommand;
  onUpdate: (id: string, updates: Partial<NotionCommand>) => Promise<void>;
  onCopyPrompt: (text: string) => void;
}

function CommandCard({ command, onUpdate, onCopyPrompt }: CommandCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [respuesta, setRespuesta] = useState(command.respuesta);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function markEstado(estado: CommandEstado) {
    setSaving(true);
    try {
      const updates: Partial<NotionCommand> = { estado };
      if (estado === 'Completado') {
        updates.fechaCompletado = new Date().toISOString().split('T')[0];
      }
      await onUpdate(command.id, updates);
    } finally {
      setSaving(false);
    }
  }

  async function saveRespuesta() {
    setSaving(true);
    try {
      await onUpdate(command.id, { respuesta, estado: 'Completado', fechaCompletado: new Date().toISOString().split('T')[0] });
    } finally {
      setSaving(false);
    }
  }

  function copyPrompt() {
    onCopyPrompt(command.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isCompleted = command.estado === 'Completado';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'rounded-xl border transition-all',
        isCompleted
          ? 'bg-surface-card/50 border-edge/30 opacity-70'
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
            <p className={clsx('text-sm font-medium', isCompleted ? 'text-ink-muted line-through' : 'text-ink')}>
              {command.titulo}
            </p>
            <EstadoBadge estado={command.estado} />
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <DestBadge dest={command.destinatario} />
            {command.prioridad && (
              <span className="text-[10px] text-ink-muted">
                Prioridad: {command.prioridad}
              </span>
            )}
            {command.fechaCreacion && (
              <span className="text-[10px] text-ink-faint">
                {format(parseISO(command.fechaCreacion), 'd MMM', { locale: es })}
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
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
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

              {/* Respuesta */}
              {!isCompleted && (
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
                </div>
              )}
              {isCompleted && command.respuesta && (
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

              {/* Actions */}
              {!isCompleted && (
                <div className="flex items-center gap-2 flex-wrap">
                  {command.estado === 'Pendiente' && (
                    <button
                      onClick={() => markEstado('En Proceso')}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-warn/15 text-warn text-xs font-medium rounded-lg hover:bg-warn/25 transition-colors disabled:opacity-50"
                    >
                      <Loader2 size={11} />
                      En Proceso
                    </button>
                  )}
                  {respuesta.trim() ? (
                    <button
                      onClick={saveRespuesta}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-success/15 text-success text-xs font-medium rounded-lg hover:bg-success/25 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      Guardar respuesta y completar
                    </button>
                  ) : (
                    <button
                      onClick={() => markEstado('Completado')}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-success/15 text-success text-xs font-medium rounded-lg hover:bg-success/25 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      Marcar completado
                    </button>
                  )}
                  <button
                    onClick={() => markEstado('Error')}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors disabled:opacity-50"
                  >
                    <AlertTriangle size={11} />
                    Error
                  </button>
                </div>
              )}
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
        La variable <code className="bg-surface-elevated px-1 py-0.5 rounded text-accent font-mono">COMMANDS_DATABASE_ID</code> no está configurada.
        Crea la base de datos en Notion y añade el ID a las variables de entorno.
      </p>
      <div className="bg-surface-elevated rounded-lg p-3">
        <p className="text-xs font-semibold text-ink-secondary mb-2">Pasos para crear la DB en Notion:</p>
        <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside">
          <li>Ve a Notion → crea una nueva página llamada <strong className="text-ink-secondary">AeroReclaim — Commands</strong></li>
          <li>Añade un bloque de tipo <strong className="text-ink-secondary">Database (full page)</strong></li>
          <li>Crea estas propiedades: <code className="font-mono text-accent">Titulo</code> (Title), <code className="font-mono text-accent">Destinatario</code> (Select), <code className="font-mono text-accent">Prompt</code> (Text), <code className="font-mono text-accent">Estado</code> (Select), <code className="font-mono text-accent">Respuesta</code> (Text), <code className="font-mono text-accent">Prioridad</code> (Select), <code className="font-mono text-accent">Fecha_Creacion</code> (Date), <code className="font-mono text-accent">Fecha_Completado</code> (Date)</li>
          <li>Conecta la integración AeroReclaim Dashboard (··· → Connections)</li>
          <li>Copia el ID de la URL y añádelo como <code className="font-mono text-accent">COMMANDS_DATABASE_ID</code> en Vercel y en .env.local</li>
        </ol>
      </div>
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

  function handleCopyPrompt(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  }

  const activeCommands = commands.filter(c => c.estado !== 'Completado' && c.estado !== 'Error');
  const historyCommands = commands.filter(c => c.estado === 'Completado' || c.estado === 'Error');

  const estadoOrder: Record<CommandEstado, number> = { 'Pendiente': 0, 'En Proceso': 1, 'Completado': 2, 'Error': 3 };
  const sortedActive = [...activeCommands].sort((a, b) => estadoOrder[a.estado] - estadoOrder[b.estado]);

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
          <p className="text-xs text-ink-muted mt-0.5">
            Cola de prompts para agentes IA
          </p>
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
            Nuevo Command
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

      {/* Setup banner */}
      {needsSetup && <SetupBanner />}

      {/* Active queue */}
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
                />
              ))
            )}
          </div>

          {/* History section */}
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
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {isCreateOpen && (
        <CreateCommandModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => { setIsCreateOpen(false); fetchCommands(true); }}
        />
      )}

      {/* Copy toast */}
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
