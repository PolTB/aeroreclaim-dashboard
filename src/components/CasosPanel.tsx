'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ExternalLink, ShieldAlert, Search } from 'lucide-react';
import clsx from 'clsx';
import type { RadarCaso } from '@/lib/notionRadar';
import type { AeroCaso } from '@/types';
import {
  ETAPAS, URGENCIA_RANK, type Urgencia,
  urgenciaDe, textoLimite, diasSinMovimiento, eur, normalizarNombre, leadsSinFicha,
} from '@/lib/casos';

// ─── Casos ────────────────────────────────────────────────────────────────────
// Fuente única: la DB de Notion "📡 Casos Activos — Radar", que es la que el
// CEO mantiene a mano en cada cambio de estado.
//
// El Sheet (vía /api/cases) ya no se muestra como lista paralela: se comprobó
// el 29/08/2026 que contradice al Radar en casi todos los casos —decía "AESA"
// de Alicia cuando está preparando la vía judicial, y "Lead" de los tres
// Amaro/González cuando ya tienen la reclamación enviada a Iberia—. Dos listas
// que se contradicen no son más información, son menos. El Sheet se conserva
// para lo único en lo que es fiable: detectar leads que existen ahí y todavía
// no tienen ficha en el Radar, que es exactamente cómo se perdió Javier Montes.

function Progreso({ etapa }: { etapa: string | null }) {
  const idx = ETAPAS.findIndex((e) => e.key === etapa);
  return (
    <div className="flex items-center gap-1" title={etapa ?? 'Sin etapa'}>
      {ETAPAS.map((e, i) => (
        <span
          key={e.key}
          className={clsx(
            'h-1.5 rounded-full transition-all',
            i === idx ? 'w-6 bg-accent' : i < idx ? 'w-3 bg-accent/40' : 'w-3 bg-edge',
          )}
        />
      ))}
      <span className="ml-1.5 text-[11px] font-medium text-ink-secondary">
        {idx >= 0 ? ETAPAS[idx].short : (etapa ?? 'Sin etapa')}
      </span>
    </div>
  );
}

const URGENCIA_ESTILO: Record<Urgencia, { punto: string; texto: string }> = {
  vencida:   { punto: 'bg-danger',  texto: 'text-danger font-semibold' },
  urgente:   { punto: 'bg-danger',  texto: 'text-danger font-medium' },
  proxima:   { punto: 'bg-warn',    texto: 'text-warn font-medium' },
  tranquila: { punto: 'bg-success', texto: 'text-ink-secondary' },
};

function CasoCard({ caso }: { caso: RadarCaso }) {
  const estilo = URGENCIA_ESTILO[urgenciaDe(caso)];
  const quieto = diasSinMovimiento(caso);

  return (
    <article className="bg-surface-card border border-edge/70 rounded-2xl p-4 shadow-card hover:border-edge-bright transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', estilo.punto)} />
          <div className="min-w-0">
            <a
              href={caso.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-accent"
            >
              <span className="truncate">{caso.cliente || '(sin nombre)'}</span>
              <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 shrink-0" />
            </a>
            {/* El campo Vuelo del Radar es texto libre y a veces trae el caso
                entero ("IB3645 (op. BRITISH AIRWAYS) LHR->MAD … 1.246 km").
                Se recorta a una línea; el texto completo queda en el title. */}
            <p className="text-[11px] text-ink-muted mt-0.5 truncate" title={caso.vuelo}>
              {caso.vuelo || 'Vuelo sin indicar'}
            </p>
            {caso.responsable && (
              <p className="text-[11px] text-ink-muted">
                en manos de <span className="text-ink-secondary">{caso.responsable}</span>
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-ink tabular-nums">{eur(caso.compensacionEur)}</p>
          {caso.comisionEstEur != null && (
            <p className="text-[10px] text-ink-muted tabular-nums">comisión {eur(caso.comisionEstEur)}</p>
          )}
        </div>
      </div>

      <div className="mb-3">
        <Progreso etapa={caso.etapa} />
      </div>

      {caso.proximaAccion && (
        <p className="text-xs text-ink-secondary leading-relaxed clamp-2 mb-3" title={caso.proximaAccion}>
          <span className="text-ink-muted">Siguiente: </span>
          {caso.proximaAccion}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-edge/50">
        <span className={clsx('text-[11px]', estilo.texto)}>{textoLimite(caso.fechaLimite)}</span>
        <span
          className={clsx(
            'text-[11px]',
            quieto > 21 ? 'text-danger' : quieto > 10 ? 'text-warn' : 'text-ink-muted',
          )}
          title="Días desde el último movimiento registrado en el caso"
        >
          {quieto === 0 ? 'Movido hoy' : quieto === 1 ? 'Movido ayer' : `Quieto ${quieto} días`}
        </span>
      </div>
    </article>
  );
}

function Metrica({ valor, etiqueta, tono }: { valor: string; etiqueta: string; tono?: 'danger' | 'success' }) {
  return (
    <div className="bg-surface-card border border-edge/70 rounded-xl px-4 py-3 shadow-card">
      <p
        className={clsx(
          'text-lg font-semibold tabular-nums',
          tono === 'danger' ? 'text-danger' : tono === 'success' ? 'text-success' : 'text-ink',
        )}
      >
        {valor}
      </p>
      <p className="text-[11px] text-ink-muted mt-0.5">{etiqueta}</p>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  radar: RadarCaso[];
  sheetCases: AeroCaso[];
  error?: string;
  loading: boolean;
}

export function CasosPanel({ radar, sheetCases, error, loading }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [verCerrados, setVerCerrados] = useState(false);

  const activos = useMemo(
    () =>
      radar
        .filter((c) => !c.cerrado)
        .sort((a, b) => {
          const ru = URGENCIA_RANK[urgenciaDe(a)] - URGENCIA_RANK[urgenciaDe(b)];
          if (ru !== 0) return ru;
          return (a.fechaLimite ?? '9999') < (b.fechaLimite ?? '9999') ? -1 : 1;
        }),
    [radar],
  );

  const cerrados = useMemo(() => radar.filter((c) => c.cerrado), [radar]);
  const cobrados = cerrados.filter((c) => c.etapa === 'Cobrado');

  const filtrados = useMemo(() => {
    const q = normalizarNombre(busqueda);
    if (!q) return activos;
    return activos.filter((c) =>
      [c.cliente, c.vuelo, c.etapa ?? '', c.proximaAccion, c.expediente].some((campo) =>
        normalizarNombre(campo).includes(q),
      ),
    );
  }, [activos, busqueda]);

  const enJuego = activos.reduce((s, c) => s + (c.compensacionEur ?? 0), 0);
  const comision = activos.reduce((s, c) => s + (c.comisionEstEur ?? 0), 0);
  const vencidos = activos.filter((c) => urgenciaDe(c) === 'vencida').length;
  const huerfanos = useMemo(() => leadsSinFicha(sheetCases, radar), [sheetCases, radar]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 bg-surface-card border border-edge/70 rounded-2xl animate-pulse-soft" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2.5 p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No se ha podido leer el Radar de Casos</p>
            <p className="text-xs mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metrica valor={String(activos.length)} etiqueta="casos abiertos" />
        <Metrica valor={eur(enJuego)} etiqueta="compensación en juego" />
        <Metrica valor={eur(comision)} etiqueta="comisión estimada" tono="success" />
        <Metrica
          valor={String(vencidos)}
          etiqueta="con la fecha límite pasada"
          tono={vencidos > 0 ? 'danger' : undefined}
        />
      </div>

      {/* Leads sin ficha en el Radar */}
      {huerfanos.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 bg-warn/10 border border-warn/25 rounded-xl">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warn" />
          <div className="text-xs">
            <p className="font-medium text-warn">
              {huerfanos.length === 1
                ? '1 lead está en el pipeline sin ficha en el Radar'
                : `${huerfanos.length} leads están en el pipeline sin ficha en el Radar`}
            </p>
            <p className="text-ink-secondary mt-1 leading-relaxed">
              {huerfanos.map((h) => `${h.pasajero} (${h.vuelo}, ${h.estadoActual})`).join(' · ')}
            </p>
            <p className="text-ink-muted mt-1">
              Nadie los vigila mientras no tengan fila en el Radar. Así se perdió el caso de Javier Montes.
            </p>
          </div>
        </div>
      )}

      {/* Buscador */}
      {activos.length > 6 && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, vuelo o expediente…"
            className="w-full bg-surface-card border border-edge/70 rounded-xl pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/60"
          />
        </div>
      )}

      {/* Casos activos */}
      {filtrados.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-12">
          {busqueda ? 'Ningún caso coincide con la búsqueda.' : 'No hay casos abiertos en el Radar.'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((caso) => (
            <CasoCard key={caso.id} caso={caso} />
          ))}
        </div>
      )}

      {/* Cerrados */}
      {cerrados.length > 0 && (
        <div className="border-t border-edge/60 pt-4">
          <button
            onClick={() => setVerCerrados((v) => !v)}
            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink-secondary"
          >
            <ChevronDown size={13} className={clsx('transition-transform', verCerrados && 'rotate-180')} />
            Casos cerrados ({cerrados.length}) · {cobrados.length} cobrados
          </button>
          {verCerrados && (
            <div className="mt-3 grid gap-2">
              {cerrados.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 bg-surface-card border border-edge/50 rounded-xl px-3 py-2"
                >
                  <div className="min-w-0">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-ink-secondary hover:text-accent"
                    >
                      {c.cliente}
                    </a>
                    <span className="text-[11px] text-ink-muted ml-2">{c.vuelo}</span>
                  </div>
                  <span
                    className={clsx(
                      'text-[11px] font-medium shrink-0',
                      c.etapa === 'Cobrado' ? 'text-success' : 'text-ink-muted',
                    )}
                  >
                    {c.etapa} · {eur(c.compensacionEur)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CasosPanel;
