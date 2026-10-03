'use client';

import { CheckCircle2, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { RadarCaso } from '@/lib/notionRadar';
import type { AeroCaso, NotionCommand } from '@/types';
import type { BandejaTarea } from '@/lib/bandejaDb';
import { casosActivos, diasHasta, diasSinMovimiento, leadsSinFicha, urgenciaDe } from '@/lib/casos';

// ─── Resumen "Hoy" ────────────────────────────────────────────────────────────
// Una sola franja, siempre visible sobre las tres pestañas, que responde a la
// única pregunta con la que se abre un dashboard: ¿hay algo que atender?
// Si no lo hay, lo dice y se calla. Nada de métricas decorativas.

export type Vista = 'casos' | 'delegaciones' | 'bandeja';

interface Senal {
  id: string;
  tono: 'urgente' | 'aviso';
  texto: string;
  destino: Vista;
}

interface Props {
  radar: RadarCaso[];
  sheetCases: AeroCaso[];
  commands: NotionCommand[];
  bandeja: BandejaTarea[];
  onIr: (vista: Vista) => void;
}

const plural = (n: number, singular: string, prural: string) => (n === 1 ? singular : prural);

export function construirSenales({
  radar, sheetCases, commands, bandeja,
}: Omit<Props, 'onIr'>): Senal[] {
  const senales: Senal[] = [];

  // Urgente = fecha límite hoy o ya pasada. El resto, aviso.
  const pendientes = bandeja.filter((t) => t.estado === 'Pendiente');
  const urgentesBandeja = pendientes.filter((t) => {
    const d = diasHasta(t.fechaLimite);
    return d !== null && d <= 0;
  }).length;
  const restoBandeja = pendientes.length - urgentesBandeja;

  const activos = casosActivos(radar);
  const vencidos = activos.filter((c) => urgenciaDe(c) === 'vencida').length;
  const inminentes = activos.filter((c) => urgenciaDe(c) === 'urgente').length;
  // "Parado" solo si además no tiene una fecha próxima que lo esté vigilando:
  // un caso esperando respuesta de una aerolínea con revisión fijada dentro de
  // dos semanas está quieto por diseño, y avisar de eso es ruido, no señal.
  const parados = activos.filter((c) => {
    const dias = diasHasta(c.fechaLimite);
    return diasSinMovimiento(c) > 14 && (dias === null || dias > 14);
  }).length;
  const huerfanos = leadsSinFicha(sheetCases, radar).length;

  const porRevisar = commands.filter(
    (c) => c.estado === 'Respuesta Recibida' || c.estado === 'Bloqueado',
  ).length;

  if (urgentesBandeja) {
    senales.push({
      id: 'bandeja-urgente',
      tono: 'urgente',
      texto: `${urgentesBandeja} ${plural(urgentesBandeja, 'tarea tuya para hoy', 'tareas tuyas para hoy o atrasadas')}`,
      destino: 'bandeja',
    });
  }
  if (vencidos) {
    senales.push({
      id: 'casos-vencidos',
      tono: 'urgente',
      texto: `${vencidos} ${plural(vencidos, 'caso con la fecha límite pasada', 'casos con la fecha límite pasada')}`,
      destino: 'casos',
    });
  }
  if (restoBandeja) {
    senales.push({
      id: 'bandeja-resto',
      tono: 'aviso',
      texto: `${restoBandeja} ${plural(restoBandeja, 'tarea tuya pendiente', 'tareas tuyas pendientes')} en la bandeja`,
      destino: 'bandeja',
    });
  }
  if (inminentes) {
    senales.push({
      id: 'casos-inminentes',
      tono: 'aviso',
      texto: `${inminentes} ${plural(inminentes, 'caso vence', 'casos vencen')} en 3 días o menos`,
      destino: 'casos',
    });
  }
  if (porRevisar) {
    senales.push({
      id: 'delegaciones-revisar',
      tono: 'aviso',
      texto: `${porRevisar} ${plural(porRevisar, 'delegación espera', 'delegaciones esperan')} tu revisión`,
      destino: 'delegaciones',
    });
  }
  if (huerfanos) {
    senales.push({
      id: 'leads-huerfanos',
      tono: 'aviso',
      texto: `${huerfanos} ${plural(huerfanos, 'lead sin ficha', 'leads sin ficha')} en el Radar`,
      destino: 'casos',
    });
  }
  if (parados) {
    senales.push({
      id: 'casos-parados',
      tono: 'aviso',
      texto: `${parados} ${plural(parados, 'caso lleva', 'casos llevan')} más de 2 semanas sin moverse`,
      destino: 'casos',
    });
  }

  return senales;
}

export function ResumenHoy(props: Props) {
  const senales = construirSenales(props);

  if (senales.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 bg-success/8 border border-success/20 rounded-2xl">
        <CheckCircle2 size={15} className="text-success shrink-0" />
        <p className="text-xs text-ink-secondary">
          <span className="font-medium text-ink">Nada requiere tu atención.</span> Ni fechas vencidas, ni bandeja,
          ni delegaciones esperando respuesta.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Hoy</p>
      <div className="flex flex-wrap gap-2">
        {senales.map((s) => (
          <button
            key={s.id}
            onClick={() => props.onIr(s.destino)}
            className={clsx(
              'group flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl border text-xs font-medium',
              s.tono === 'urgente'
                ? 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/15'
                : 'bg-warn/10 border-warn/30 text-warn hover:bg-warn/15',
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', s.tono === 'urgente' ? 'bg-danger' : 'bg-warn')} />
            {s.texto}
            <ChevronRight size={12} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default ResumenHoy;
