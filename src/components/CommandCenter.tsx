'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Plus, Copy, Clock, AlertCircle, ChevronDown, ChevronRight,
  Loader2, Check, History, AlertTriangle, Search,
  Inbox, Ban, X, Trash2, Paperclip, ExternalLink, Image as ImageIcon,
  FolderOpen, Send,
} from 'lucide-react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  NotionCommand, CommandEstado, CommandDestinatario, CommandPrioridad,
  CommandArchivoTipo, CommandModelo, CommandEsfuerzo, CreateCommandPayload, CommandArchivo,
} from '@/types';
import {
  COMMAND_DESTINATARIOS, COMMAND_ESTADO_CONFIG,
  ACTIVE_ESTADOS, ARCHIVED_ESTADOS,
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
  'Paperclip':     '#f59e0b',
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
  const [archivos, setArchivos] = useState<CommandArchivo[]>(() => {
    const list: CommandArchivo[] = [];
    if (command.archivoUrl) list.push({ url: command.archivoUrl, tipo: command.archivoTipo ?? 'otro', nombre: '' });
    if (command.archivosExtra?.length) list.push(...command.archivosExtra);
    return list;
  });
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
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setSaveError(null);
    try {
      const uploaded: CommandArchivo[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        uploaded.push({ url: data.url, tipo: data.tipo as CommandArchivoTipo, nombre: data.nombre ?? file.name });
      }
      setArchivos(prev => [...prev, ...uploaded]);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al subir archivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  function removeArchivo(index: number) {
    setArchivos(prev => prev.filter((_, i) => i !== index));
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
      const [firstArchivo, ...restArchivos] = archivos;
      updates.archivoUrl = firstArchivo?.url || null;
      updates.archivoTipo = (firstArchivo?.tipo || null) as CommandArchivoTipo | null;
      updates.archivosExtra = restArchivos.length > 0 ? restArchivos : null;

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
          className="w-full max-w-lg bg-surface-card border border-edge rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
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

            {/* Pills: Destinatario · Estado · Prioridad · Modelo · Esfuerzo */}
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
              <select
                value={modelo}
                onChange={e => setModelo(e.target.value as CommandModelo)}
                className="bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent/60 cursor-pointer transition-all"
                style={{ color: modeloCfg.color, borderColor: modeloCfg.color + '50' }}
              >
                {COMMAND_MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={esfuerzo ?? ''}
                onChange={e => setEsfuerzo((e.target.value as CommandEsfuerzo) || null)}
                className="bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent/60 cursor-pointer transition-all"
                style={esfuerzo ? {
                  color: esfuerzo === 'Alta' ? '#ef4444' : esfuerzo === 'Media' ? '#f59e0b' : '#22c55e',
                  borderColor: (esfuerzo === 'Alta' ? '#ef4444' : esfuerzo === 'Media' ? '#f59e0b' : '#22c55e') + '50',
                } : { color: 'var(--color-ink-secondary)' }}
              >
                <option value="">Esfuerzo</option>
                {COMMAND_ESFUERZOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Subchat */}
            <input
              value={subchat}
              onChange={e => setSubchat(e.target.value)}
              placeholder="Subchat (opcional)..."
              className="w-full bg-surface-elevated border border-edge/40 rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60 transition-colors"
            />

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
                <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Adjuntos</span>
                <input ref={imageInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                <input ref={fileInputRef} type="file" className="hidden" accept="*/*" multiple onChange={handleFileUpload} />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-edge/60 rounded-lg text-[11px] text-ink-secondary hover:text-ink hover:border-edge-bright transition-all disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />}
                  Imagen
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-edge/60 rounded-lg text-[11px] text-ink-secondary hover:text-ink hover:border-edge-bright transition-all disabled:opacity-50"
                >
                  <FolderOpen size={11} />
                  Archivo
                </button>
              </div>
              {archivos.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {archivos.map((archivo, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5">
                      <span className="text-[10px] text-ink-muted uppercase font-medium w-14 shrink-0">{archivo.tipo}</span>
                      <a href={archivo.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-[11px] text-accent hover:underline truncate">
                        {archivo.nombre || archivo.url}
                      </a>
                      <button onClick={() => removeArchivo(i)} className="text-ink-faint hover:text-danger transition-colors shrink-0">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  placeholder="URL pública (opcional)"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) { setArchivos(prev => [...prev, { url: val, tipo: 'otro', nombre: '' }]); (e.target as HTMLInputElement).value = ''; }
                    }
                  }}
                  className="flex-1 bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
                />
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
            {command.esfuerzo && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  color: command.esfuerzo === 'Alta' ? '#ef4444' : command.esfuerzo === 'Media' ? '#f59e0b' : '#22c55e',
                  backgroundColor: command.esfuerzo === 'Alta' ? 'rgba(239,68,68,0.12)' : command.esfuerzo === 'Media' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                }}
              >
                {command.esfuerzo}
              </span>
            )}
            {command.fechaCreacion && (
              <span className="text-[10px] text-ink-faint">
                {format(parseISO(command.fechaCreacion), 'd MMM', { locale: es })}
              </span>
            )}
            {(command.archivoUrl || command.archivosExtra?.length) && (
              <span className="text-[10px] text-accent/60">
                <Paperclip size={9} className="inline mr-0.5" />
                {(1 + (command.archivosExtra?.length ?? 0)) > 1
                  ? `${1 + (command.archivosExtra?.length ?? 0)} archivos`
                  : (command.archivoTipo ?? 'archivo')}
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
  const [esfuerzo, setEsfuerzo] = useState<CommandEsfuerzo | ''>('Media');
  const [archivos, setArchivos] = useState<CommandArchivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: CommandArchivo[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        uploaded.push({ url: data.url, tipo: data.tipo as CommandArchivoTipo, nombre: data.nombre ?? file.name });
      }
      setArchivos(prev => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeArchivo(index: number) {
    setArchivos(prev => prev.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      const [firstArchivo, ...restArchivos] = archivos;
      const payload: CreateCommandPayload = {
        titulo: titulo.trim(),
        prompt: prompt.trim(),
        destinatario: destinatario || null,
        subchat: subchat.trim() || undefined,
        prioridad: (prioridad || null) as CommandPrioridad | null,
        modelo,
        esfuerzo: (esfuerzo || null) as CommandEsfuerzo | null,
        archivoUrl: firstArchivo?.url || null,
        archivoTipo: (firstArchivo?.tipo || null) as CommandArchivoTipo | null,
        archivosExtra: restArchivos.length > 0 ? restArchivos : null,
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

          {/* Archivos adjuntos */}
          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-1.5">
              Adjuntos <span className="text-ink-faint font-normal">(opcional)</span>
            </label>
            <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileUpload} />
            {archivos.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {archivos.map((archivo, i) => (
                  <div key={i} className="flex items-center gap-2 bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] text-ink-muted uppercase font-medium w-14 shrink-0">{archivo.tipo}</span>
                    <a href={archivo.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-[11px] text-accent hover:underline truncate">
                      {archivo.nombre || archivo.url}
                    </a>
                    <button type="button" onClick={() => removeArchivo(i)} className="text-ink-faint hover:text-danger transition-colors shrink-0">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-surface-elevated border border-edge/60 text-ink-muted hover:text-ink rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
                {uploading ? 'Subiendo...' : 'Subir archivo(s)'}
              </button>
              <input
                placeholder="O pega una URL y pulsa Enter"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) { setArchivos(prev => [...prev, { url: val, tipo: 'otro', nombre: '' }]); (e.target as HTMLInputElement).value = ''; }
                  }
                }}
                className="flex-1 bg-surface-elevated border border-edge/60 rounded-lg px-3 py-1 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60"
              />
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


// ─── Main CommandCenter ─────────────────────────────────────────────────────────
// Los datos llegan por props desde el Dashboard (una sola lectura de Notion
// compartida por las tres pestañas, un solo "actualizado hace X"). Aquí sólo
// quedan las mutaciones, que siguen yendo directas a la API.

interface CommandCenterProps {
  commands: NotionCommand[];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onPatch: (id: string, updates: Partial<NotionCommand>) => void;
  onRemove: (id: string) => void;
}

/** Cuántas delegaciones del historial se pintan antes de pedir "ver más". */
const HISTORIAL_PAGINA = 20;

function Seccion({ titulo, ayuda, tono, children }: {
  titulo: string; ayuda: string; tono: 'revisar' | 'marcha'; children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className={clsx(
          'text-xs font-semibold',
          tono === 'revisar' ? 'text-warn' : 'text-ink-secondary',
        )}>
          {titulo}
        </h3>
        <span className="text-[11px] text-ink-muted">{ayuda}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function CommandCenter({ commands, loading, error, onRefresh, onPatch, onRemove }: CommandCenterProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<NotionCommand | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [visiblesHistorial, setVisiblesHistorial] = useState(HISTORIAL_PAGINA);
  const [copiedToast, setCopiedToast] = useState(false);

  const updateCommand = useCallback(async (id: string, updates: Partial<NotionCommand>) => {
    onPatch(id, updates);
    setSelectedCommand(prev => (prev?.id === id ? { ...prev, ...updates } : prev));
    const res = await fetch(`/api/notion/commands/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      onRefresh();
      throw new Error('Error al actualizar');
    }
  }, [onPatch, onRefresh]);

  const deleteCommand = useCallback(async (id: string) => {
    onRemove(id);
    setSelectedCommand(null);
    const res = await fetch(`/api/notion/commands/${id}`, { method: 'DELETE' });
    if (!res.ok) onRefresh();
  }, [onRemove, onRefresh]);

  function handleCopyPrompt(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  }

  const q = busqueda.trim().toLowerCase();
  const coincide = useCallback((c: NotionCommand) => {
    if (!q) return true;
    return [c.titulo, c.prompt, c.respuesta, c.destinatario ?? '', c.subchat]
      .some(campo => campo.toLowerCase().includes(q));
  }, [q]);

  const activas = commands.filter(c => ACTIVE_ESTADOS.includes(c.estado)).filter(coincide);
  const paraRevisar = activas.filter(c => c.estado === 'Respuesta Recibida' || c.estado === 'Bloqueado');
  const enMarcha = activas.filter(c => c.estado === 'Pendiente' || c.estado === 'En Proceso');
  const historial = commands.filter(c => ARCHIVED_ESTADOS.includes(c.estado)).filter(coincide);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-surface-card border border-edge/70 rounded-xl animate-pulse-soft" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Terminal size={15} className="text-accent" />
            Delegaciones
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            {activas.length === 0
              ? `Ninguna en curso · ${historial.length} en el historial`
              : `${activas.length} en curso${paraRevisar.length ? ` · ${paraRevisar.length} esperando que las revises` : ''}`}
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-xl shadow-sm"
        >
          <Plus size={12} />
          Nueva delegación
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/25 rounded-xl text-xs text-danger">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Error cargando delegaciones</p>
            <p className="mt-0.5 opacity-80">{error}</p>
            <button onClick={onRefresh} className="mt-1.5 underline underline-offset-2">Reintentar</button>
          </div>
        </div>
      )}

      {/* Buscador — el historial de casi 400 delegaciones sólo sirve si se puede buscar */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setVisiblesHistorial(HISTORIAL_PAGINA); }}
          placeholder="Buscar en todas las delegaciones (título, prompt, respuesta, agente)…"
          className="w-full bg-surface-card border border-edge/70 rounded-xl pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/60"
        />
      </div>

      {paraRevisar.length > 0 && (
        <Seccion titulo="Para revisar" ayuda="el agente ya respondió o se ha bloqueado" tono="revisar">
          {paraRevisar.map(cmd => (
            <CommandCard key={cmd.id} command={cmd} onClick={() => setSelectedCommand(cmd)} />
          ))}
        </Seccion>
      )}

      {enMarcha.length > 0 && (
        <Seccion titulo="En marcha" ayuda="enviadas al agente, sin respuesta todavía" tono="marcha">
          {enMarcha.map(cmd => (
            <CommandCard key={cmd.id} command={cmd} onClick={() => setSelectedCommand(cmd)} />
          ))}
        </Seccion>
      )}

      {activas.length === 0 && !q && (
        <div className="text-center py-10 bg-surface-card border border-edge/60 rounded-2xl">
          <Terminal size={22} className="mx-auto mb-3 text-ink-faint" />
          <p className="text-sm font-medium text-ink-secondary">Ninguna delegación en curso</p>
          <p className="text-xs mt-1 text-ink-muted">Todo lo delegado está cerrado. El historial sigue ahí abajo.</p>
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="border-t border-edge/60 pt-4 flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
              <History size={12} />
              {q ? 'Historial que coincide' : 'Historial'}
            </h3>
            <span className="text-[11px] text-ink-muted">{historial.length} cerradas</span>
          </div>
          {historial.slice(0, visiblesHistorial).map(cmd => (
            <CommandCard key={cmd.id} command={cmd} onClick={() => setSelectedCommand(cmd)} />
          ))}
          {historial.length > visiblesHistorial && (
            <button
              onClick={() => setVisiblesHistorial(v => v + HISTORIAL_PAGINA * 2)}
              className="self-center mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:text-ink-secondary border border-edge/70 rounded-lg"
            >
              <ChevronDown size={12} />
              Ver más ({historial.length - visiblesHistorial} restantes)
            </button>
          )}
        </div>
      )}

      {q && activas.length === 0 && historial.length === 0 && (
        <p className="text-sm text-ink-muted text-center py-10">Ninguna delegación coincide con «{busqueda}».</p>
      )}

      {/* Create modal */}
      {isCreateOpen && (
        <CreateCommandModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => { setIsCreateOpen(false); onRefresh(); }}
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-success/20 border border-success/30 text-success text-xs font-medium rounded-full backdrop-blur-sm shadow-lift z-50"
          >
            <Check size={12} />
            Prompt copiado al portapapeles
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CommandCenter;
