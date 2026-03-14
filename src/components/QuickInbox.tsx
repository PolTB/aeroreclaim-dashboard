'use client';

import { useState } from 'react';
import { Send, Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface QuickInboxProps {
  onTaskCreated: () => void;
}

export function QuickInbox({ onTaskCreated }: QuickInboxProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch('/api/notion/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarea: trimmed, prioridad: 'P3 - Media' }),
      });
      if (!res.ok) throw new Error('Error al crear');
      setText('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onTaskCreated();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 mb-4">
      <div className="flex-1 relative">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Nueva idea o tarea... (Enter para añadir)"
          className="w-full bg-surface-card border border-edge/60 rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent/60 transition-colors pr-10"
        />
        {success && (
          <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-success" />
        )}
      </div>
      <button
        type="submit"
        disabled={saving || !text.trim()}
        className={clsx(
          'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-xl transition-all',
          text.trim()
            ? 'bg-accent hover:bg-accent-hover text-white shadow-sm'
            : 'bg-surface-card text-ink-muted border border-edge/40 cursor-not-allowed'
        )}
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        <span className="hidden sm:block">Añadir</span>
      </button>
    </form>
  );
}
