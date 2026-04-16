'use client';

import { useEffect, useState } from 'react';
import { Inbox, CheckCircle2, AlertTriangle, XCircle, Archive, RefreshCw, Check } from 'lucide-react';
import clsx from 'clsx';

const BANDEJA_PAGE_ID = '3438a573-e757-819c-8985-f031ec4b9a82';

interface BandejaItem {
  type: 'ok' | 'warning' | 'urgent';
  ref: string;
  contact: string;
  message: string;
}

interface BandejaEntry {
  id: string;
  date: string;
  items: BandejaItem[];
}

function parseEntries(blocks: { type: string; paragraph?: { rich_text: { plain_text: string }[] } }[]): BandejaEntry[] {
  const entries: BandejaEntry[] = [];
  let current: BandejaEntry | null = null;

  for (const block of blocks) {
    // Accept paragraph, heading_1, heading_2, heading_3 blocks
    const richText = block.type === 'paragraph' ? block.paragraph?.rich_text
      : block.type === 'heading_1' ? (block as { heading_1?: { rich_text: { plain_text: string }[] } }).heading_1?.rich_text
      : block.type === 'heading_2' ? (block as { heading_2?: { rich_text: { plain_text: string }[] } }).heading_2?.rich_text
      : block.type === 'heading_3' ? (block as { heading_3?: { rich_text: { plain_text: string }[] } }).heading_3?.rich_text
      : null;
    if (!richText) continue;
    const text = richText.map((r) => r.plain_text).join('');
    if (!text.trim()) continue;

    if (text.startsWith('📅')) {
      if (current) entries.push(current);
      current = { id: text, date: text.replace('📅', '').trim(), items: [] };
      continue;
    }

    // Accept any ref (AER-XX, AR-XXXX, PAT-GITHUB, etc.) and both — and –
    const okMatch = text.match(/^✅\s+(\S+)\s+[–—]\s+(.+?)\s+[–—]\s+(.+)$/);
    const warnMatch = text.match(/^⚠️\s+(\S+)\s+[–—]\s+(.+?)\s+[–—]\s+(.+)$/);
    const urgentMatch = text.match(/^🔴\s+(\S+)\s+[–—]\s+(.+?)\s+[–—]\s+(.+)$/);

    const match = okMatch || warnMatch || urgentMatch;
    const type = okMatch ? 'ok' : warnMatch ? 'warning' : urgentMatch ? 'urgent' : null;

    if (match && type && current) {
      current.items.push({ type, ref: match[1], contact: match[2].trim(), message: match[3].trim() });
    }
  }

  if (current) entries.push(current);
  return entries;
}

export function BandejaPol() {
  const [entries, setEntries] = useState<BandejaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneItems, setDoneItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('bandeja_done') ?? '[]')); } catch { return new Set(); }
  });
  const [marking, setMarking] = useState<string | null>(null);

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notion/blocks?pageId=${BANDEJA_PAGE_ID}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(parseEntries(data.results ?? []));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markDone(entryDate: string, item: BandejaItem) {
    const key = `${entryDate}__${item.ref}`;
    setMarking(key);
    const now = new Date();
    const ts = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const logText = `✅ Pol actuó — ${item.ref} — ${item.contact} — ${ts}`;
    try {
      await fetch('/api/notion/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: BANDEJA_PAGE_ID, text: logText }),
      });
    } catch { /* silencio — el estado local ya refleja la acción */ }
    setDoneItems(prev => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem('bandeja_done', JSON.stringify(Array.from(next))); } catch { /* */ }
      return next;
    });
    setMarking(null);
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const active = entries.filter((e) => { const d = new Date(e.date); return isNaN(d.getTime()) || d >= cutoff; });
  const archived = entries.filter((e) => { const d = new Date(e.date); return !isNaN(d.getTime()) && d < cutoff; });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Inbox size={15} className="text-accent" />
            Bandeja de Pol
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">Mensajes del CEO y Admin que requieren tu acción</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-surface-card border border-transparent hover:border-edge/40 transition-all"
          title="Actualizar"
        >
          <RefreshCw size={13} className={clsx(refreshing && 'animate-spin text-accent')} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" /> OK para enviar</span>
        <span className="flex items-center gap-1"><AlertTriangle size={11} className="text-amber-400" /> Corregido, revisa</span>
        <span className="flex items-center gap-1"><XCircle size={11} className="text-red-400" /> URGENTE</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={16} className="animate-spin text-accent" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-xs text-red-400">
          Error al cargar: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && active.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-xl bg-surface-card border border-edge/60 flex items-center justify-center mb-3">
            <Inbox size={18} className="text-ink-faint" />
          </div>
          <p className="text-sm font-medium text-ink-secondary">Sin entradas pendientes</p>
          <p className="text-xs text-ink-muted mt-1">El CEO escribirá aquí si hay algo que requiera tu atención.</p>
        </div>
      )}

      {/* Active entries */}
      {active.map((entry) => (
        <div key={entry.id} className="bg-surface-card border border-edge/60 rounded-xl p-4 space-y-2.5">
          <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">📅 {entry.date}</p>
          {entry.items.map((item, i) => {
            const key = `${entry.date}__${item.ref}`;
            const done = doneItems.has(key);
            const isMarking = marking === key;
            return (
              <div key={i} className={clsx(
                'flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-opacity',
                done && 'opacity-40',
                !done && item.type === 'ok' && 'bg-emerald-500/6 border border-emerald-500/15',
                !done && item.type === 'warning' && 'bg-amber-500/6 border border-amber-500/15',
                !done && item.type === 'urgent' && 'bg-red-500/6 border border-red-500/15',
                done && 'bg-surface-elevated border border-edge/30',
              )}>
                {!done && item.type === 'ok' && <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" />}
                {!done && item.type === 'warning' && <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />}
                {!done && item.type === 'urgent' && <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />}
                {done && <Check size={13} className="text-ink-faint mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className={clsx('text-xs font-mono font-semibold mr-2', done ? 'text-ink-faint line-through' : 'text-ink')}>{item.ref}</span>
                  <span className="text-xs text-ink-muted mr-2">— {item.contact} —</span>
                  <span className={clsx(
                    'text-xs font-medium',
                    done ? 'text-ink-faint line-through' : item.type === 'ok' ? 'text-emerald-400' : item.type === 'warning' ? 'text-amber-400' : 'text-red-400',
                  )}>{item.message}</span>
                  {done && <span className="ml-2 text-[10px] text-ink-faint">· Pol actuó</span>}
                </div>
                {!done && (
                  <button
                    onClick={() => markDone(entry.date, item)}
                    disabled={isMarking}
                    className="ml-1 shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-elevated border border-edge/60 text-ink-muted hover:text-ink-secondary hover:border-edge transition-all disabled:opacity-50"
                    title="Marcar como hecho"
                  >
                    {isMarking ? <RefreshCw size={9} className="animate-spin" /> : <Check size={9} />}
                    Hecho
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Archive */}
      {archived.length > 0 && (
        <details className="bg-surface-card border border-edge/40 rounded-xl">
          <summary className="flex items-center gap-2 px-4 py-3 text-xs text-ink-muted cursor-pointer hover:text-ink-secondary select-none">
            <Archive size={12} />
            Archivo — {archived.length} entradas anteriores
          </summary>
          <div className="px-4 pb-4 space-y-2.5 mt-1">
            {archived.map((entry) => (
              <div key={entry.id} className="bg-surface-elevated border border-edge/30 rounded-lg p-3 opacity-50 space-y-1.5">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">📅 {entry.date}</p>
                {entry.items.map((item, i) => (
                  <p key={i} className="text-xs text-ink-muted">{item.ref} — {item.contact} — {item.message}</p>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
