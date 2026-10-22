'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RadarCaso } from '@/lib/notionRadar';
import type { AeroCaso } from '@/types';
import type { BandejaEstado, BandejaTarea } from '@/lib/bandejaDb';
import type { FinanzasSnapshot } from '@/lib/finanzas';

/** Cada cuánto se refrescan solos los datos mientras el dashboard está abierto. */
const AUTO_REFRESH_MS = 3 * 60 * 1000;

export interface DashboardData {
  radar: RadarCaso[];
  /** Casos del Sheet vía GAS — se usan sólo para detectar leads sin ficha en el Radar. */
  sheetCases: AeroCaso[];
  bandeja: BandejaTarea[];
  /** Foto de la contabilidad (registro.js → Notion). null hasta que carga. */
  finanzas: FinanzasSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  lastRefresh: Date | null;
  errors: Partial<Record<'radar' | 'cases' | 'bandeja' | 'finanzas', string>>;
  refresh: () => void;
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
  const [bandeja, setBandeja] = useState<BandejaTarea[]>([]);
  const [finanzas, setFinanzas] = useState<FinanzasSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [errors, setErrors] = useState<DashboardData['errors']>({});
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    else setRefreshing(true);

    const nextErrors: DashboardData['errors'] = {};

    const [radarRes, casesRes, bandejaRes, finanzasRes] = await Promise.allSettled([
      getJson('/api/notion/radar'),
      getJson('/api/cases'),
      getJson('/api/notion/bandeja'),
      getJson('/api/finanzas'),
    ]);

    if (radarRes.status === 'fulfilled') setRadar(((radarRes.value as { casos?: RadarCaso[] }).casos) ?? []);
    else nextErrors.radar = radarRes.reason?.message ?? 'Error cargando el radar de casos';

    if (casesRes.status === 'fulfilled') setSheetCases(((casesRes.value as { cases?: AeroCaso[] }).cases) ?? []);
    else nextErrors.cases = casesRes.reason?.message ?? 'Error cargando el pipeline del Sheet';

    if (bandejaRes.status === 'fulfilled') {
      setBandeja(((bandejaRes.value as { tareas?: BandejaTarea[] }).tareas) ?? []);
    } else nextErrors.bandeja = bandejaRes.reason?.message ?? 'Error cargando la bandeja';

    if (finanzasRes.status === 'fulfilled') {
      setFinanzas(((finanzasRes.value as { finanzas?: FinanzasSnapshot }).finanzas) ?? null);
    } else nextErrors.finanzas = finanzasRes.reason?.message ?? 'Error cargando las finanzas';

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

  const setBandejaEstado = useCallback(async (id: string, estado: BandejaEstado) => {
    const ahora = new Date().toISOString();
    setBandeja((prev) => prev.map((t) => (t.id === id ? { ...t, estado, hechoEl: estado === 'Pendiente' ? null : ahora, editada: ahora } : t)));
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
    radar, sheetCases, bandeja, finanzas,
    loading, refreshing, lastRefresh, errors,
    refresh: load, setBandejaEstado,
  };
}
