'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RadarCaso } from '@/lib/notionRadar';
import type { AeroCaso, NotionCommand } from '@/types';
import { normalizeCommandEstado } from '@/types';
import type { BandejaEstado, BandejaTarea } from '@/lib/bandejaDb';

/** Cada cuánto se refrescan solos los datos mientras el dashboard está abierto. */
const AUTO_REFRESH_MS = 3 * 60 * 1000;

export interface DashboardData {
  radar: RadarCaso[];
  /** Casos del Sheet vía GAS — se usan sólo para detectar leads sin ficha en el Radar. */
  sheetCases: AeroCaso[];
  commands: NotionCommand[];
  bandeja: BandejaTarea[];
  loading: boolean;
  refreshing: boolean;
  lastRefresh: Date | null;
  errors: Partial<Record<'radar' | 'cases' | 'commands' | 'bandeja', string>>;
  refresh: () => void;
  /** Actualización optimista local de una delegación (evita releer Notion entero). */
  patchCommand: (id: string, updates: Partial<NotionCommand>) => void;
  removeCommand: (id: string) => void;
  /** Cambia el estado de una tarea de la Bandeja en Notion (optimista). */
  setBandejaEstado: (id: string, estado: BandejaEstado) => Promise<void>;
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
  const [bandeja, setBandeja] = useState<BandejaTarea[]>([]);
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
      getJson('/api/notion/bandeja'),
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
      setBandeja(((bandejaRes.value as { tareas?: BandejaTarea[] }).tareas) ?? []);
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

  const patchCommand = useCallback((id: string, updates: Partial<NotionCommand>) => {
    setCommands((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const removeCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const setBandejaEstado = useCallback(async (id: string, estado: BandejaEstado) => {
    const hoy = new Date().toISOString().slice(0, 10);
    setBandeja((prev) => prev.map((t) => (t.id === id ? { ...t, estado, hechoEl: estado === 'Pendiente' ? null : hoy } : t)));
    const res = await fetch('/api/notion/bandeja', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    });
    // Si Notion no lo guarda, se recarga: mejor ver la tarea otra vez que creer
    // que está hecha cuando no lo está.
    if (!res.ok) await load();
  }, [load]);

  return {
    radar, sheetCases, commands, bandeja,
    loading, refreshing, lastRefresh, errors,
    refresh: load, patchCommand, removeCommand, setBandejaEstado,
  };
}
