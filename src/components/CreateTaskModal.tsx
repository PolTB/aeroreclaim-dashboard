'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Priority, CreateTaskPayload } from '@/types';
import { CATEGORIES } from '@/types';

interface CreateTaskModalProps {
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'P1 - Urgente', label: 'P1 — Urgente', color: '#ef4444' },
  { value: 'P2 - Alta', label: 'P2 — Alta', color: '#f97316' },
  { value: 'P3 - Media', label: 'P3 — Media', color: '#3b82f6' },
];

export function CreateTaskModal({ categories, onClose, onCreated }: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const allCategories = Array.from(new Set([...CATEGORIES, ...categories]));

  const [form, setForm] = useState<CreateTaskPayload>({
    tarea: '',
    prioridad: null,
    categoria: null,
    fechaLimite: null,
    notas: '',
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tarea.trim()) {
      setError('El nombre de la tarea es obligatorio.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/notion/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tarea: form.tarea.trim(),
          notas: form.notas?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create task');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la tarea');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="w-full max-w-md bg-surface-card border border-edge rounded-2xl shadow-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-edge/60">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-accent/20 rounded-lg">
                <Plus size={14} className="text-accent" />
              </div>
              <h2 className="text-sm font-semibold text-ink">Nueva tarea</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-ink-secondary hover:bg-surface-elevated rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            {/* Task name */}
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                Tarea <span className="text-red-400">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={form.tarea}
                onChange={(e) => setForm({ ...form, tarea: e.target.value })}
                placeholder="Describe la tarea..."
                className="w-full bg-surface-secondary border border-edge rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/60 transition-colors"
              />
            </div>

            {/* Priority + Category row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                  Prioridad
                </label>
                <select
                  value={form.prioridad ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, prioridad: (e.target.value as Priority) || null })
                  }
                  className="w-full bg-surface-secondary border border-edge rounded-xl px-3 py-2.5 text-xs text-ink-secondary focus:outline-none focus:border-accent/60 transition-colors"
                >
                  <option value="">Sin prioridad</option>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                  Categoría
                </label>
                <select
                  value={form.categoria ?? ''}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value || null })}
                  className="w-full bg-surface-secondary border border-edge rounded-xl px-3 py-2.5 text-xs text-ink-secondary focus:outline-none focus:border-accent/60 transition-colors"
                >
                  <option value="">Sin categoría</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                Fecha límite
              </label>
              <input
                type="date"
                value={form.fechaLimite ?? ''}
                onChange={(e) => setForm({ ...form, fechaLimite: e.target.value || null })}
                className="w-full bg-surface-secondary border border-edge rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-accent/60 transition-colors [color-scheme:dark]"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                Notas
              </label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Contexto adicional (opcional)..."
                rows={3}
                className="w-full bg-surface-secondary border border-edge rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/60 transition-colors resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-ink-secondary border border-edge rounded-xl hover:border-edge-bright hover:text-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium',
                  'bg-accent hover:bg-accent-hover text-white rounded-xl transition-colors',
                  loading && 'opacity-60 cursor-not-allowed',
                )}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Crear tarea
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
