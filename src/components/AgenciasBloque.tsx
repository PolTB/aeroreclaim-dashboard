'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { RadarCaso } from '@/lib/notionRadar';
import { calcularAgencias, DIAS_DE_MARGEN, PAGO_POR_PASAJERO, type VisitasAgencias } from '@/lib/agencias';
import { euros } from '@/lib/finanzas';
import { Tarjeta } from './finanzasUi';

// ─── Agencias ─────────────────────────────────────────────────────────────────
// Una pregunta: ¿qué agencias reparten las tarjetas y cuánto les debemos?
// Visitas = alguien abrió la web desde el QR o el enlace de esa agencia.

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const diaCorto = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

export function AgenciasBloque({ radar }: { radar: RadarCaso[] }) {
  const [datos, setDatos] = useState<VisitasAgencias | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/agencias', { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        return j as VisitasAgencias;
      })
      .then((j) => vivo && setDatos(j))
      .catch((e: Error) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, []);

  const filas = useMemo(() => calcularAgencias(datos, radar), [datos, radar]);
  const debemos = filas.reduce((a, f) => a + f.debemos, 0);
  const aQuien = filas.filter((f) => f.debemos > 0);
  const visitas30 = filas.reduce((a, f) => a + f.visitas30, 0);
  const leads = filas.reduce((a, f) => a + f.leads, 0);
  const limite = new Date(Date.now() - DIAS_DE_MARGEN * 86400000).toISOString().slice(0, 10);
  const sinVisitas = filas.filter((f) => f.visitas === 0 && f.leads === 0 && f.desde != null && f.desde <= limite).length;
  const nuevas = filas.filter((f) => f.desde != null && f.desde > limite).length;

  return (
    <Tarjeta titulo="Agencias" subtitulo={`Tarjetas con QR · ${PAGO_POR_PASAJERO} € por pasajero cobrado`}>
      {error && !datos && (
        <p className="text-xs text-ink-muted mt-2">No se han podido leer las visitas ({error}). Los leads y lo que se debe salen igual del Radar.</p>
      )}
      {!datos && !error ? (
        <div className="h-24 mt-3 bg-surface-elevated/60 rounded-xl animate-pulse-soft" />
      ) : (
        <>
          <p className="text-sm text-ink-secondary mt-2 leading-relaxed">
            {debemos > 0
              ? <>Les debes <b className="text-ink">{euros(debemos)}</b> a {aQuien.map((f) => f.nombre).join(', ')}. Se paga en los 5 días siguientes a cobrar, contra su factura.</>
              : <>No les debes nada.</>}
            {' '}En los últimos 30 días, <b className="text-ink">{plural(visitas30, 'visita', 'visitas')}</b> desde sus tarjetas
            y <b className="text-ink">{plural(leads, 'lead', 'leads')}</b> en total.
            {sinVisitas > 0 && <> {plural(sinVisitas, 'agencia no ha tenido', 'agencias no han tenido')} ninguna visita en {DIAS_DE_MARGEN} días: puede que no estén repartiendo las tarjetas. Llámalas.</>}
            {nuevas > 0 && <> {plural(nuevas, 'agencia empezó', 'agencias empezaron')} hace menos de {DIAS_DE_MARGEN} días: aún es pronto para juzgarlas.</>}
          </p>

          {filas.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="grid grid-cols-[minmax(0,1fr)_2.3rem_2.3rem_3.2rem_3.2rem] sm:grid-cols-[minmax(0,1fr)_repeat(4,5rem)] gap-x-1 px-2 pb-1 text-[10px] text-ink-muted border-b border-edge/50">
                <span>Agencia</span>
                <span className="text-right">Visitas</span>
                <span className="text-right">Leads</span>
                <span className="text-right">Cobrados</span>
                <span className="text-right">Debes</span>
              </div>
              {filas.map((f) => (
                <div
                  key={f.codigo}
                  className={clsx(
                    'grid grid-cols-[minmax(0,1fr)_2.3rem_2.3rem_3.2rem_3.2rem] sm:grid-cols-[minmax(0,1fr)_repeat(4,5rem)] gap-x-1 items-baseline px-2 py-1.5 border-b border-edge/30 tabular-nums',
                    f.visitas === 0 && f.leads === 0 && 'text-ink-muted',
                  )}
                >
                  <span className="min-w-0">
                    <span className={clsx('block break-words leading-tight', (f.visitas > 0 || f.leads > 0) && 'text-ink font-medium')}>{f.nombre}</span>
                    {f.ultimaVisita && <span className="block text-[10px] text-ink-muted">última visita {diaCorto(f.ultimaVisita)}</span>}
                  </span>
                  <span className="text-right">{f.visitas}</span>
                  <span className="text-right">{f.leads}{f.enMarcha > 0 && <span className="block text-[10px] text-ink-muted">{f.enMarcha} en marcha</span>}</span>
                  <span className="text-right">{f.cobrados}</span>
                  <span className={clsx('text-right', f.debemos > 0 && 'text-ink font-semibold')}>{f.debemos > 0 ? euros(f.debemos) : '·'}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-ink-muted mt-2">
            Una visita es alguien que abrió la web desde su QR o enlace (sin datos de la persona). Un lead es un pasajero en el Radar con esa agencia como origen.
          </p>
        </>
      )}
    </Tarjeta>
  );
}
