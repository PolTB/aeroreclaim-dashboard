'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RadarCaso } from '@/lib/notionRadar';
import type { AeroCaso, NotionCommand } from '@/types';
import { normalizeCommandEstado } from '@/types';
import { parseBandeja, type BandejaEntry } from '@/lib/bandeja';

export const BANDEJA_PAGE_ID = '3438a573-e757-819c-8985-f031ec4b9a82';

/** Cada cuánto se refrescan solos los datos mientras el dashboard está abierto. */
const AUTO_REFRESH_MS = 3 * 60 * 1000;

export interface DashboardData {
  radar: RadarCaso[];
  /** Casos del Sheet vía GAS — se usan sólo para detectar leads sin ficha en el Radar. */
  sheetCases: AeroCaso[];
  commands: NotionCommand[];
  bandeja: BandejaEntry[];
  bandejaDone: Set<string>;
  loading: boolean;
  refreshing: boolean;
  lastRefresh: Date | null;
  errors: Partial<Record<'radar' | 'cases' | 'commands' | 'bandeja', string>>;
  refresh: () => void;
  /** Actualización optimista local de una delegación (evita releer Notion entero). */
  patchCommand: (id: string, updates: Partial<NotionCommand>) => void;
  removeCommand: (id: string) => void;
  markBandejaDone: (key: string) => void;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function useDashboardData(): DashboardData {
  const [radar, setRadar] = useState<RadarCaso[]>([]);
  const [sheetCases, setSheetCases] = useState<AeroCaso[]>([]);
  const [commands, setCommands] = useState<NotionCommand[]>([]);
  const [bandeja, setBandeja] = useState<BandejaEntry[]>([]);
  const [bandejaDone, setBandejaDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [errors, setErrors] = useState<DashboardData['errors']>({});
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    else setRefreshing(true);

    const nextErrors: DashboardData['errors'] = {};

    const [radarRes, casesRes, commandsRes, bandejaRes] = await Promise.allSettled([
      getJson('/api/notion/radar'),
      getJson('/api/cases'),
      getJson('/api/notion/commands'),
      getJson(`/api/notion/blocks?pageId=${BANDEJA_PAGE_ID}`),
    ]);

    if (radarRes.status === 'fulfilled') setRadar(((radarRes.value as { casos?: RadarCaso[] }).casos) ?? []);
    else nextErrors.radar = radarRes.reason?.message ?? 'Error cargando el radar de casos';

    if (casesRes.status === 'fulfilled') setSheetCases(((casesRes.value as { cases?: AeroCaso[] }).cases) ?? []);
    else nextErrors.cases = casesRes.reason?.message ?? 'Error cargando el pipeline del Sheet';

    if (commandsRes.status === 'fulfilled') {
      const raw = ((commandsRes.value as { commands?: NotionCommand[] }).commands) ?? [];
      setCommands(raw.map((c) => ({ ...c, estado: normalizeCommandEstado(c.estado) })));
    } else nextErrors.commands = commandsRes.reason?.message ?? 'Error cargando delegaciones';

    if (bandejaRes.status === 'fulfilled') {
      const blocks = ((bandejaRes.value as { results?: { type: string }[] }).results) ?? [];
      const { entries, done } = parseBandeja(blocks);
      setBandeja(entries);
      setBandejaDone((prev) => new Set([...Array.from(prev), ...Array.from(done)]));
    } else nextErrors.bandeja = bandejaRes.reason?.message ?? 'Error cargando la bandeja';

    setErrors(nextErrors);
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
    firstLoad.current = false;
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, AUTO_REFRESH_MS);
    // Al volver a la pestaña tras un rato, los datos en pantalla ya no valen.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  // Rehidrata lo que Pol marcó como hecho antes de que existiera el log en Notion.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('bandeja_done_keys') ?? '[]') as string[];
      if (stored.length) setBandejaDone((prev) => new Set([...Array.from(prev), ...stored]));
    } catch { /* almacenamiento no disponible — se sigue con lo que diga Notion */ }
  }, []);

  const patchCommand = useCallback((id: string, updates: Partial<NotionCommand>) => {
    setCommands((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const removeCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const markBandejaDone = useCallback((key: string) => {
    setBandejaDone((prev) => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem('bandeja_done_keys', JSON.stringify(Array.from(next))); } catch { /* ignorado */ }
      return next;
    });
  }, []);

  return {
    radar, sheetCases, commands, bandeja, bandejaDone,
    loading, refreshing, lastRefresh, errors,
    refresh: load, patchCommand, removeCommand, markBandejaDone,
  };
}
