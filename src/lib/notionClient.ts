import { Client } from '@notionhq/client';

// ─── Cliente de Notion con reintentos ────────────────────────────────────────
// Notion corta con 429 ("You have been rate limited") cuando el mismo token
// pasa de unas 3 peticiones por segundo. El token lo comparten el dashboard,
// la franja Hoy y las herramientas del CEO, así que un pico de cualquiera
// dejaba la Bandeja en blanco (28/10/2026). El cliente 2.x no reintenta: lo
// hacemos aquí, esperando lo que diga Retry-After (máx. 4 s) hasta 3 veces.

const REINTENTOS = 3;
const MAX_ESPERA_MS = 4000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchConReintentos: typeof fetch = async (input, init) => {
  for (let intento = 0; ; intento++) {
    const res = await fetch(input, init);
    const reintentable = res.status === 429 || res.status === 502 || res.status === 503;
    if (!reintentable || intento >= REINTENTOS) return res;
    const retryAfter = Number(res.headers.get('retry-after'));
    const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** intento;
    await esperar(Math.min(ms, MAX_ESPERA_MS));
  }
};

export function notionClient(auth: string | undefined): Client {
  return new Client({ auth, fetch: fetchConReintentos as never });
}
