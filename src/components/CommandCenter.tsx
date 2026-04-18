'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Plus, Copy, Clock, AlertCircle, ChevronDown, ChevronRight,
  RefreshCw, Loader2, Check, History, AlertTriangle,
  Inbox, Ban, X, Trash2, Paperclip, ExternalLink, Image as ImageIcon,
  FolderOpen, Cpu, Send,
} from 'lucide-react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  NotionCommand, CommandEstado, CommandDestinatario, CommandPrioridad,
  CommandArchivoTipo, CommandModelo, CommandEsfuerzo, CreateCommandPayload,
} from '@/types';
import {
  COMMAND_DESTINATARIOS, COMMAND_ESTADO_CONFIG, COMMAND_ESTADO_ORDER,
  ACTIVE_ESTADOS, ARCHIVED_ESTADOS, COMMAND_ARCHIVO_TIPOS,
} from '@/types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const COMMAND_MODELOS: CommandModelo[] = ['Sonnet', 'Opus', 'Haiku'];
const COMMAND_ESFUERZOS: CommandEsfuerzo[] = ['Baja', 'Media', 'Alta'];

const MODELO_CONFIG: Record<CommandModelo, { color: string; bg: string }> = {
  Sonnet: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  Opus:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  Haiku:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

const DEST_COLORS: Record<string, string> = {
  'Claude CoWork': '#8b5cf6',
  'Claude Code':   '#3b82f6',
  'Claude Chat':   '#6366f1',
  'Comet':         '#ec4899',
  'ChatGPT':       '#10b981',
  'Manual':        '#6b7280',
};

const ESTADO_ICONS: Record<CommandEstado, React.ReactNode> = {
  'Pendiente':          <Clock size={10} />,
  'En Proceso':         <Loader2 size={10} className="animate-spin" />,
  'Respuesta Recibida': <Inbox size={10} />,
  'Completado':         <Check size={10} />,
  'Bloqueado':          <AlertTriangle size={10} />,
  'Cancelado':          <Ban size={10} />,
};

// ─── Estado badge ──────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: CommandEstado }) {
  const cfg = COMMAND_ESTADO_CONFIG[estado] ?? COMMAND_ESTADO_CONFIG['Pendiente'];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {ESTADO_ICONS[estado] ?? <Clock size={10} />}
      {cfg.label}
    </span>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-card border border-edge rounded-xl shadow-2xl p-5 max-w-sm w-full"
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-ink">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-xs text-ink-muted hover:text-ink rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-danger/15 text-danger text-xs font-medium rounded-lg hover:bg-danger/25 transition-colors">
            Eliminar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Command Detail Modal ─────────────────────────────────────────────────────

interface CommandDetailModalProps {
  command: NotionCommand;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<NotionCommand>) => Promise<void>;
  onDelete: (id: string) => void;
  onCopyPrompt: (text: string) => void;
}

function CommandDetailModal({ command, onClose, onUpdate, onDelete, onCopyPrompt }: CommandDetailModalProps) {
  const [titulo, setTitulo] = useState(command.titulo);
  const [destinatario, setDestinatario] = useState<CommandDestinatario | null>(command.destinatario);
  const [estado, setEstado] = useState<CommandEstado>(command.estado);
  const [prioridad, setPrioridad] = useState<CommandPrioridad | null>(command.prioridad);
  const [modelo, setModelo] = useState<CommandModelo>(command.modelo ?? 'Sonnet');
  const [esfuerzo, setEsfuerzo] = useState<CommandEsfuerzo | null>(command.esfuerzo);
  const [respuesta, setRespuesta] = useState(command.respuesta);
  const [subchat, setSubchat] = useState(command.subchat || '');
  const [archivoUrl, setArchivoUrl] = useState(command.archivoUrl || '');
  const [archivoTipo, setArchivoTipo] = useState<CommandArchivoTipo | ''>(command.archivoTipo || '');
  const [detallesOpen, setDetallesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function copyPrompt() {
    onCopyPrompt(command.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSaveError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setArchivoUrl(data.url);
      setArchivoTipo(data.tipo);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al subir archivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {};
      if (titulo !== command.titulo) updates.titulo = titulo;
      if (destinatario !== command.destinatario) updates.destinatario = destinatario;
      if (estado !== command.estado) {
        updates.estado = estado;
        if (estado === 'Completado') updates.fechaCompletado = new Date().toISOString().split('T')[0];
        if (estado === 'Pendiente') updates.fechaCompletado = null;
      }
      if (prioridad !== command.prioridad) updates.prioridad = prioridad;
      if (modelo !== (command.modelo ?? 'Sonnet')) updates.modelo = modelo;
      if (esfuerzo !== command.esfuerzo) updates.esfuerzo = esfuerzo;
      if (respuesta !== command.respuesta) {
        updates.respuesta = respuesta;
        if (respuesta.trim() && estado === 'En Proceso') updates.estado = 'Respuesta Recibida';
      }
      if (subchat !== (command.subchat || '')) updates.subchat = subchat;
      if (archivoUrl !== (command.archivoUrl || '')) updates.archivoUrl = archivoUrl || null;
      if (archivoTipo !== (command.archivoTipo || '')) updates.archivoTipo = (archivoTipo || null) as CommandArchivoTipo | null;

      if (Object.keys(updates).length > 0) {
        await onUpdate(command.id, updates);
      }
      onClose();
    } catch {
      setSaveError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const isArchived = ARCHIVED_ESTADOS.includes(command.estado);
  const destColor = destinatario ? (DEST_COLORS[destinatario] ?? '#6b7280') : undefined;
  const modeloCfg = MODELO_CONFIG[modelo];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-lg bg-surface-card border border-edge rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge/40 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-accent" />
              <span className="text-xs font-medium text-ink-muted">Delegación</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-elevated transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">

            {/* Editable title */}
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="w-full bg-transparent border border-accent/50 rounded-lg px-3 py-2 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
              placeholder="Título de la delegación..."
            />

            {/* 3 inline pill selects */}
            <div className="flex flex-wrap gap-2">
              <select
                value={destinatario ?? ''}
                onChange={e => setDestinatario((e.target.value as CommandDestinatario) || null)}
                className="bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent/60 cursor-pointer transition-all"
                style={destinatario ? { color: destColor, borderColor: destColor + '50' } : { color: 'var(--color-ink-secondary)' }}
              >
                <option value="">Sin asignar</option>
                {COMMAND_DESTINATARIOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value as CommandEstado)}
                className="bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent/60 cursor-pointer transition-all"
                style={{
                  color: COMMAND_ESTADO_CONFIG[estado]?.color,
                  borderColor: (COMMAND_ESTADO_CONFIG[estado]?.color ?? '#6b7280') + '50',
                }}
              >
                {Object.keys(COMMAND_ESTADO_CONFIG).map(e => (
                  <option key={e} value={e}>{COMMAND_ESTADO_CONFIG[e as CommandEstado].label}</option>
                ))}
              </select>
              <select
                value={prioridad ?? ''}
                onChange={e => setPrioridad((e.target.value as CommandPrioridad) || null)}
                className="bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent/60 cursor-pointer transition-all"
                style={prioridad ? {
                  color: prioridad === 'Alta' ? '#ef4444' : prioridad === 'Media' ? '#eab308' : '#22c55e',
                  borderColor: (prioridad === 'Alta' ? '#ef4444' : prioridad === 'Media' ? '#eab308' : '#22c55e') + '50',
                } : { color: 'var(--color-ink-secondary)' }}
              >
                <option value="">Sin prioridad</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>

            {/* Collapsible Detalles del agente */}
            <div className="border border-edge/40 rounded-xl overflow-hidden">
              <button
                onClick={() => setDetallesOpen(v => !v)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-surface-elevated/40 hover:bg-surface-elevated transition-colors text-left"
              >
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu size={11} className="text-accent/70" />
                  Detalles del agente
                </span>
                <ChevronDown
                  size={12}
                  className={clsx('text-ink-muted transition-transform', detallesOpen && 'rotate-180')}
                />
              </button>
              <AnimatePresence>
                {detallesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                  >
                    <div className="px-3.5 py-3 grid grid-cols-2 gap-3 border-t border-edge/30">
                      <div>
                        <label className="text-[10px] text-ink-faint font-medium block mb-1">Destinatario</label>
                        <select
                          value={destinatario ?? ''}
                          onChange={e => setDestinatario((e.target.value as CommandDestinatario) || null)}
                          className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-accent/60"
                        >
                          <option value="">Sin asignar</option>
                          {COMMAND_DESTINATARIOS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-faint font-medium block mb-1">Estado</label>
                        <select
                          value={estado}
                          onChange={e => setEstado(e.target.value as CommandEstado)}
                          className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-accent/60"
                        >
                          {Object.keys(COMMAND_ESTADO_CONFIG).map(e => (
                            <option key={e} value={e}>{COMMAND_ESTADO_CONFIG[e as CommandEstado].label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-faint font-medium block mb-1">Prioridad</label>
                        <select
                          value={prioridad ?? ''}
                          onChange={e => setPrioridad((e.target.value as CommandPrioridad) || null)}
                          className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-accent/60"
                        >
                          <option value="">Sin prioridad</option>
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baja">Baja</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-faint font-medium block mb-1">
                          Modelo IA
                        </label>
                        <select
                          value={modelo}
                          onChange={e => setModelo(e.target.value as CommandModelo)}
                          className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-accent/60"
                          style={{ color: modeloCfg.color }}
                        >
                          {COMMAND_MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-faint font-medium block mb-1">Esfuerzo</label>
                        <select
                          value={esfuerzo ?? ''}
                          onChange={e => setEsfuerzo((e.target.value as CommandEsfuerzo) || null)}
                          className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-accent/60"
                        >
                          <option value="">Sin definir</option>
                          {COMMAND_ESFUERZOS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-faint font-medium block mb-1">Subchat</label>
                        <input
                          value={subchat}
                          onChange={e => setSubchat(e.target.value)}
                          placeholder="Nombre del chat..."
                          className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Prompt</span>
                <button
                  onClick={copyPrompt}
                  className={clsx(
                    'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition-all',
                    copied ? 'bg-success/20 text-success' : 'bg-surface-elevated text-ink-muted hover:text-ink-secondary',
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
            {!isArchived && (
              <div>
                <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-1.5">
                  Respuesta
                </span>
                <textarea
                  value={respuesta}
                  onChange={e => setRespuesta(e.target.value)}
                  placeholder="Pega aquí la respuesta del agente... (Ctrl+V para pegar imágenes)"
                  className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:border-accent/60 min-h-[80px]"
                  rows={4}
                />
              </div>
            )}
            {isArchived && command.respuesta && (
              <div>
                <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-1.5">
                  Respuesta
                </span>
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

            {/* Adjuntos */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                <input ref={fileInputRef} type="file" className="hidden" accept="*/*" onChange={handleFileUpload} />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated border border-edge/60 rounded-lg text-[11px] text-ink-secondary hover:text-ink hover:border-edge-bright transition-all disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />}
                  Imagen
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated border border-edge/60 rounded-lg text-[11px] text-ink-secondary hover:text-ink hover:border-edge-bright transition-all disabled:opacity-50"
                >
                  <FolderOpen size={11} />
                  Archivo
                </button>
                {command.archivoUrl && (
                  <a
                    href={command.archivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                  >
                    <ExternalLink size={10} />
                    {command.archivoTipo ?? 'Ver archivo'}
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={archivoUrl}
                  onChange={e => setArchivoUrl(e.target.value)}
                  placeholder="URL pública (opcional)"
                  className="flex-1 bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
                />
                <select
                  value={archivoTipo}
                  onChange={e => setArchivoTipo(e.target.value as CommandArchivoTipo | '')}
                  className="bg-surface-elevated border border-edge/60 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-accent/60"
                >
                  <option value="">Tipo</option>
                  {COMMAND_ARCHIVO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                {saveError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-edge/40 flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Guardar
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-xl text-xs font-medium transition-colors"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </div>
        </motion.div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message="¿Seguro que quieres eliminar esta delegación? Se archivará en Notion."
          onConfirm={() => { onDelete(command.id); onClose(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

// ─── Command Card (compact list item) ─────────────────────────────────────────

function CommandCard({ command, onClick }: { command: NotionCommand; onClick: () => void }) {
  const isArchived = ARCHIVED_ESTADOS.includes(command.estado);
  const destColor = command.destinatario ? (DEST_COLORS[command.destinatario] ?? '#6b7280') : null;
  const modeloCfg = command.modelo ? MODELO_CONFIG[command.modelo] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={clsx(
        'group rounded-xl border cursor-pointer transition-all',
        'bg-surface-card hover:bg-surface-elevated/40',
        isArchived
          ? 'border-edge/30 opacity-60'
          : command.estado === 'Bloqueado'
          ? 'border-orange-500/30 hover:border-orange-500/50'
          : command.estado === 'Respuesta Recibida'
          ? 'border-yellow-500/30 hover:border-yellow-500/50'
          : 'border-edge/60 hover:border-edge-bright',
      )}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <Terminal size={13} className="shrink-0 text-accent/70" />
        <div className="flex-1 min-w-0">
          <p className={clsx(
            'text-sm font-medium truncate',
            isArchived ? 'text-ink-muted line-through' : 'text-ink',
          )}>
            {command.titulo}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {command.destinatario && (
              <span className="text-[10px] font-medium" style={{ color: destColor ?? undefined }}>
                {command.destinatario}
              </span>
            )}
            {command.prioridad && (
              <span className={clsx(
                'text-[10px] font-medium px-1.5 py-0.5 rounded',
                command.prioridad === 'Alta' ? 'text-red-400 bg-red-500/10' :
                command.prioridad === 'Baja' ? 'text-green-400 bg-green-500/10' :
                'text-yellow-400 bg-yellow-500/10',
              )}>
                {command.prioridad}
              </span>
            )}
            {modeloCfg && command.modelo && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: modeloCfg.color, backgroundColor: modeloCfg.bg }}
              >
                {command.modelo}
              </span>
            )}
            {command.fechaCreacion && (
              <span className="text-[10px] text-ink-faint">
                {format(parseISO(command.fechaCreacion), 'd MMM', { locale: es })}
              </span>
            )}
            {command.archivoUrl && (
              <span className="text-[10px] text-accent/60">
                <Paperclip size={9} className="inline mr-0.5" />
                {command.archivoTipo ?? 'archivo'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={command.estado} />
          <ChevronRight
            size={13}
            className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Create Command Modal ─────────────────────────────────────────────────────

function CreateCommandModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [destinatario, setDestinatario] = useState<CommandDestinatario | ''>('');
  const [subchat, setSubchat] = useState('');
  const [prompt, setPrompt] = useState('');
  const [prioridad, setPrioridad] = useState<CommandPrioridad | ''>('Media');
  const [modelo, setModelo] = useState<CommandModelo>('Sonnet');
  const [esfuerzo, setEsfuerzo] = useState<CommandEsfuerzo | ''>('');
  const [archivoUrl, setArchivoUrl] = useState('');
  const [archivoTipo, setArchivoTipo] = useState<CommandArchivoTipo | ''>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setArchivoUrl(data.url);
      setArchivoTipo(data.tipo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

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
        subchat: subchat.trim() || undefined,
        prioridad: (prioridad || null) as CommandPrioridad | null,
        modelo,
        esfuerzo: (esfuerzo || null) as CommandEsfuerzo | null,
        archivoUrl: archivoUrl.trim() || null,
        archivoTipo: (archivoTipo || null) as CommandArchivoTipo | null,
      };
      const res = await fetch('/api/notion/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al crear delegación');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  }

  const modeloCfg = MODELO_CONFIG[modelo];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-surface-card border border-edge rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-edge/40">
          <div className="flex items-center gap-2">
            <Terminal size={15} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Nueva Delegación</h2>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1 rounded-lg">
            <X size={14} />
          </button>
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
              placeholder="ej: AER-82: Fix resumen fiscal, Blog artículo vuelos..."
              className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
              autoFocus
            />
          </div>

          {/* Destinatario + Prioridad + Modelo */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">Destinatario</label>
              <select
                value={destinatario}
                onChange={e => setDestinatario(e.target.value as CommandDestinatario | '')}
                className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-2 text-xs text-ink focus:outline-none focus:border-accent/60"
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
                className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-2 text-xs text-ink focus:outline-none focus:border-accent/60"
              >
                <option value="">—</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                <span style={{ color: modeloCfg.color }}>●</span> Modelo
              </label>
              <select
                value={modelo}
                onChange={e => setModelo(e.target.value as CommandModelo)}
                className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:border-accent/60"
                style={{ color: modeloCfg.color }}
              >
                {COMMAND_MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Esfuerzo + Subchat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">Esfuerzo</label>
              <select
                value={esfuerzo}
                onChange={e => setEsfuerzo(e.target.value as CommandEsfuerzo | '')}
                className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-2 text-xs text-ink focus:outline-none focus:border-accent/60"
              >
                <option value="">Sin definir</option>
                {COMMAND_ESFUERZOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                Subchat <span className="text-ink-faint font-normal">(opcional)</span>
              </label>
              <input
                value={subchat}
                onChange={e => setSubchat(e.target.value)}
                placeholder="ej: CEO — AeroReclaim"
                className="w-full bg-surface-elevated border border-edge/60 rounded-lg px-2 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
              />
            </div>
          </div>

          {/* Archivo adjunto */}
          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-1.5">
              Archivo adjunto <span className="text-ink-faint font-normal">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <input
                value={archivoUrl}
                onChange={e => setArchivoUrl(e.target.value)}
                placeholder="URL pública o link Google Drive..."
                className="flex-1 bg-surface-elevated border border-edge/60 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
              />
              <select
                value={archivoTipo}
                onChange={e => setArchivoTipo(e.target.value as CommandArchivoTipo | '')}
                className="bg-surface-elevated border border-edge/60 rounded-lg px-2 py-2 text-xs text-ink focus:outline-none focus:border-accent/60"
              >
                <option value="">Tipo</option>
                {COMMAND_ARCHIVO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-surface-elevated border border-edge/60 text-ink-muted hover:text-ink rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
                {uploading ? 'Subiendo...' : 'Subir desde PC'}
              </button>
              {archivoUrl && (
                <span className="text-[10px] text-success flex items-center gap-1">
                  <Check size={10} /> URL lista
                </span>
              )}
            </div>
          </div>

          {/* Prompt */}
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
              Crear delegación
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
        <h3 className="text-sm font-semibold text-ink">Setup requerido: Base de datos de Delegaciones</h3>
      </div>
      <p className="text-xs text-ink-muted leading-relaxed">
        La variable{' '}
        <code className="bg-surface-elevated px-1 py-0.5 rounded text-accent font-mono">
          COMMANDS_DATABASE_ID
        </code>{' '}
        no está configurada en Vercel.
      </p>
    </div>
  );
}

// ─── Main CommandCenter ─────────────────────────────────────────────────────────

export function CommandCenter() {
  const [commands, setCommands] = useState<NotionCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<NotionCommand | null>(null);
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
        throw new Error(data.error ?? 'Error cargando delegaciones');
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
    setSelectedCommand(prev => prev?.id === id ? { ...prev, ...updates } : prev);
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

  const deleteCommand = useCallback(async (id: string) => {
    setCommands(prev => prev.filter(c => c.id !== id));
    setSelectedCommand(null);
    const res = await fetch(`/api/notion/commands/${id}`, { method: 'DELETE' });
    if (!res.ok) fetchCommands(true);
  }, [fetchCommands]);

  function handleCopyPrompt(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  }

  const activeCommands = commands.filter(c => ACTIVE_ESTADOS.includes(c.estado));
  const historyCommands = commands.filter(c => ARCHIVED_ESTADOS.includes(c.estado));
  const sortedActive = [...activeCommands].sort((a, b) =>
    COMMAND_ESTADO_ORDER[a.estado] - COMMAND_ESTADO_ORDER[b.estado],
  );

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
            Delegaciones
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
            Nueva Delegación
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-xs text-red-400">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Error cargando delegaciones</p>
            <p className="mt-0.5 text-red-400/70">{error}</p>
            <button onClick={() => fetchCommands()} className="mt-1.5 underline underline-offset-2">
              Reintentar
            </button>
          </div>
        </div>
      )}

      {needsSetup && <SetupBanner />}

      {!needsSetup && (
        <>
          <div className="flex flex-col gap-2">
            {sortedActive.length === 0 ? (
              <div className="text-center py-12 text-ink-muted">
                <Terminal size={24} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No hay delegaciones activas</p>
                <p className="text-xs mt-1 text-ink-faint">Crea una nueva delegación para empezar</p>
              </div>
            ) : (
              sortedActive.map(cmd => (
                <CommandCard
                  key={cmd.id}
                  command={cmd}
                  onClick={() => setSelectedCommand(cmd)}
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
                        onClick={() => setSelectedCommand(cmd)}
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

      {/* Detail modal */}
      <AnimatePresence>
        {selectedCommand && (
          <CommandDetailModal
            command={selectedCommand}
            onClose={() => setSelectedCommand(null)}
            onUpdate={updateCommand}
            onDelete={deleteCommand}
            onCopyPrompt={handleCopyPrompt}
          />
        )}
      </AnimatePresence>

      {/* Copy toast */}
      <AnimatePresence>
        {copiedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-success/20 border border-success/30 text-success text-xs font-medium rounded-full backdrop-blur-sm shadow-lg z-50"
          >
            <Check size={12} />
            Prompt copiado al portapapeles
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
