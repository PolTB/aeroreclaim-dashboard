'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Terminal, Inbox, RefreshCw, Sun, Moon, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardData } from '@/lib/useDashboardData';
import { CasosPanel } from './CasosPanel';
import { CommandCenter } from './CommandCenter';
import { BandejaPanel } from './BandejaPanel';
import { ResumenHoy, construirSenales, type Vista } from './ResumenHoy';

// ─── Dashboard ────────────────────────────────────────────────────────────────
// Tres pestañas, y sólo tres: Casos (el dinero), Delegaciones (el trabajo
// delegado) y Bandeja (lo que sólo puede hacer Pol). Las otras seis del
// refactor de mayo —Kanban, Norte, Roadmap, Agentes, Blog y Health— se
// retiraron el 29/08/2026 porque no se usaban: mostraban estado de sistemas,
// no decisiones. Siguen en el historial de git si alguna vuelve a hacer falta.

const PESTAÑAS: { id: Vista; label: string; icono: React.ReactNode }[] = [
  { id: 'casos',        label: 'Casos',        icono: <Briefcase size={13} /> },
  { id: 'delegaciones', label: 'Delegaciones', icono: <Terminal size={13} /> },
  { id: 'bandeja',      label: 'Bandeja',      icono: <Inbox size={13} /> },
];

export function Dashboard() {
  const data = useDashboardData();
  const [vista, setVista] = useState<Vista>('casos');
  const [isDark, setIsDark] = useState(true);

  // Tema: se recuerda entre sesiones. Por defecto, oscuro.
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const dark = stored !== 'light';
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  // La pestaña abierta también se recuerda: si Pol vive en Delegaciones, que
  // el dashboard abra en Delegaciones.
  useEffect(() => {
    const stored = localStorage.getItem('vista') as Vista | null;
    if (stored && PESTAÑAS.some((p) => p.id === stored)) setVista(stored);
  }, []);

  function cambiarVista(v: Vista) {
    setVista(v);
    try { localStorage.setItem('vista', v); } catch { /* almacenamiento no disponible */ }
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  const señales = construirSenales(data);
  const contadorPestaña: Record<Vista, number> = {
    casos: señales.filter((s) => s.destino === 'casos').length,
    delegaciones: señales.filter((s) => s.destino === 'delegaciones').length,
    bandeja: señales.filter((s) => s.destino === 'bandeja').length,
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Cabecera */}
      <header className="sticky top-0 z-30 border-b border-edge/60 bg-surface/85 backdrop-blur-md">
        {/* En móvil la cabecera se parte en dos filas: con logo, tres pestañas
            y dos botones en una sola línea de 375 px, la página se iba en
            scroll horizontal. */}
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-2 sm:py-0 sm:h-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2.5 sm:shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                A
              </div>
              <span className="text-sm font-semibold text-ink">AeroReclaim</span>
            </div>
            {/* En móvil las acciones viven aquí, junto al logo */}
            <div className="flex items-center gap-1 sm:hidden">
              <button
                onClick={data.refresh}
                disabled={data.refreshing || data.loading}
                className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-card"
                title="Actualizar ahora"
              >
                <RefreshCw size={14} className={clsx((data.refreshing || data.loading) && 'animate-spin text-accent')} />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-card"
                title={isDark ? 'Modo claro' : 'Modo oscuro'}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>

          <nav className="flex bg-surface-card border border-edge/70 rounded-xl p-1 gap-0.5">
            {PESTAÑAS.map((p) => (
              <button
                key={p.id}
                onClick={() => cambiarVista(p.id)}
                className={clsx(
                  'relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium',
                  vista === p.id
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink-secondary hover:bg-surface-hover',
                )}
              >
                {p.icono}
                <span>{p.label}</span>
                {contadorPestaña[p.id] > 0 && vista !== p.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-warn" title="Requiere atención" />
                )}
              </button>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <span className="hidden lg:block text-[10px] text-ink-muted">
              {data.lastRefresh
                ? `Actualizado ${formatDistanceToNow(data.lastRefresh, { locale: es, addSuffix: true })}`
                : 'Cargando…'}
            </span>
            <button
              onClick={data.refresh}
              disabled={data.refreshing || data.loading}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-card border border-transparent hover:border-edge/60"
              title="Actualizar ahora"
            >
              <RefreshCw size={14} className={clsx((data.refreshing || data.loading) && 'animate-spin text-accent')} />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-card border border-transparent hover:border-edge/60"
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-5 flex flex-col gap-5">
        {/* Hoy */}
        {data.loading ? (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Loader2 size={13} className="animate-spin text-accent" />
            Leyendo Notion y el pipeline…
          </div>
        ) : (
          <ResumenHoy {...data} onIr={cambiarVista} />
        )}

        {/* Contenido.
            Sin AnimatePresence a propósito: con mode="wait" el panel saliente
            se quedaba montado y la pestaña no cambiaba nunca. La animación de
            entrada por sí sola basta y no puede bloquear la navegación. */}
        <div>
          <motion.div
            key={vista}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {vista === 'casos' && (
              <CasosPanel
                radar={data.radar}
                sheetCases={data.sheetCases}
                error={data.errors.radar}
                loading={data.loading}
              />
            )}
            {vista === 'delegaciones' && (
              <CommandCenter
                commands={data.commands}
                loading={data.loading}
                error={data.errors.commands}
                onRefresh={data.refresh}
                onPatch={data.patchCommand}
                onRemove={data.removeCommand}
              />
            )}
            {vista === 'bandeja' && (
              <BandejaPanel
                tareas={data.bandeja}
                error={data.errors.bandeja}
                loading={data.loading}
                onEstado={data.setBandejaEstado}
              />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
