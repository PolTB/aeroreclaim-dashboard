'use client';

import clsx from 'clsx';
import { euros } from '@/lib/finanzas';

// Piezas comunes de la pestaña Finanzas (FinanzasPanel y FinanzasPrevision).

export const conSigno = (n: number) => (n > 0 ? `+${euros(n)}` : euros(n));

export function Tarjeta({ titulo, subtitulo, children, className, accion }: {
  titulo: string; subtitulo?: string; children: React.ReactNode; className?: string; accion?: React.ReactNode;
}) {
  return (
    <section className={clsx('bg-surface-card border border-edge/70 rounded-2xl p-4 sm:p-5 shadow-card min-w-0', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
          {subtitulo && <p className="text-[11px] text-ink-muted mt-0.5">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Cifra({ etiqueta, valor, nota, serie }: {
  etiqueta: string; valor: string; nota: React.ReactNode; serie?: 'entra' | 'sale';
}) {
  return (
    <div className="bg-surface-elevated/60 border border-edge/60 rounded-xl px-3 py-2.5 min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        {serie && <span className={clsx('w-2 h-2 rounded-sm shrink-0', serie === 'entra' ? 'bg-serie-entra' : 'bg-serie-sale')} />}
        {etiqueta}
      </p>
      <p className="text-lg sm:text-2xl font-bold text-ink tabular-nums mt-0.5 truncate">{valor}</p>
      <div className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5">{nota}</div>
    </div>
  );
}

/** Interruptor de dos o más opciones (Cada mes / Acumulado, Semanas / Meses…). */
export function Opciones<T extends string>({ valor, opciones, onChange, etiqueta }: {
  valor: T; opciones: { key: T; nombre: string }[]; onChange: (v: T) => void; etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex shrink-0 p-0.5 rounded-lg bg-surface-elevated border border-edge/60">
      {opciones.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === valor}
          onClick={() => onChange(o.key)}
          className={clsx(
            'px-2 py-0.5 text-[11px] rounded-md transition-colors',
            o.key === valor ? 'bg-accent/20 text-ink font-semibold ring-1 ring-accent/40' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

/**
 * Fila de columnas: al pasar por encima (o tocar) se elige una y el texto de
 * arriba cuenta sus números. `pinta(i)` dibuja las barras de cada columna;
 * con `cero` (en % desde arriba) se dibuja la raya del cero en vez de la base.
 */
export function Columnas({ n, sel, onSel, etiqueta, aria, pinta, cero, alto = 'h-32', etiquetaCorta }: {
  n: number; sel: number; onSel: (i: number) => void;
  etiqueta: (i: number) => string; aria: (i: number) => string; pinta: (i: number) => React.ReactNode;
  cero?: number; alto?: string; etiquetaCorta?: boolean;
}) {
  return (
    <div>
      <div className={clsx('relative flex items-stretch gap-1 sm:gap-1.5 mt-2', alto, cero == null && 'border-b border-edge-bright')}>
        {cero != null && (
          <span aria-hidden className="absolute left-0 right-0 h-px bg-ink-muted pointer-events-none" style={{ top: `${cero}%` }} />
        )}
        {Array.from({ length: n }, (_, i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => onSel(i)}
            onFocus={() => onSel(i)}
            onClick={() => onSel(i)}
            aria-label={aria(i)}
            className={clsx('relative flex-1 min-w-0 flex items-end justify-center gap-0.5 rounded-md px-0.5', i === sel && 'bg-surface-hover')}
          >
            {pinta(i)}
          </button>
        ))}
      </div>
      <div className="flex gap-1 sm:gap-1.5 mt-1">
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'flex-1 min-w-0 text-center text-[10px] whitespace-nowrap overflow-hidden',
              i === sel ? 'text-ink font-semibold' : 'text-ink-muted',
              // Con muchas columnas en el móvil, una etiqueta sí y otra no.
              etiquetaCorta && i % 2 === 1 && i !== sel && 'invisible sm:visible',
            )}
          >
            {etiqueta(i)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barra de una columna alrededor del cero: hacia arriba si es positiva, hacia abajo si no. */
export function BarraCeroVertical({ valor, lo, hi, className }: { valor: number; lo: number; hi: number; className?: string }) {
  const rango = hi - lo || 1;
  const cero = (hi / rango) * 100;
  const alto = Math.max(valor === 0 ? 0 : 1.5, (Math.abs(valor) / rango) * 100);
  return (
    <span
      className={clsx(
        'absolute left-1/2 -translate-x-1/2 w-2.5 sm:w-4',
        valor >= 0 ? 'bg-serie-entra rounded-t' : 'bg-serie-sale rounded-b',
        className,
      )}
      style={valor >= 0 ? { bottom: `${100 - cero}%`, height: `${alto}%` } : { top: `${cero}%`, height: `${alto}%` }}
    />
  );
}

/** Posición del cero (en % desde arriba) para una serie con positivos y negativos. */
export function posicionCero(valores: number[]) {
  const lo = Math.min(0, ...valores);
  const hi = Math.max(0, ...valores);
  return { lo, hi, cero: (hi / (hi - lo || 1)) * 100 };
}
