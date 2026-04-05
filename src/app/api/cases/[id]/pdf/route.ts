import { NextResponse } from 'next/server';

// ─── Formal letter generator ──────────────────────────────────────────────────
//
// Returns a print-ready HTML document with Content-Type: text/html; charset=utf-8
// so that ALL Unicode characters (ñ, á, é, ó, ü, etc.) render correctly.
// The caller opens this URL in a new tab and uses browser print-to-PDF.
//
// Bug fixed: encoding — the root cause of the previous PDFGenerator failure was
// a missing charset declaration and non-UTF-8 encoding. This implementation
// declares charset=utf-8 in both the HTTP header and the HTML meta tag, and
// never performs any lossy byte conversion.

interface CaseParams {
  id: string;
}

export async function GET(
  _req: Request,
  { params }: { params: CaseParams },
) {
  const { id } = params;

  // ── Fetch case data from our own API ────────────────────────────────────────
  // We re-use the existing /api/cases endpoint so this route is always in sync.
  let caso: Record<string, unknown> | null = null;

  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const res = await fetch(`${base}/api/cases`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as { cases: Record<string, unknown>[] };
      caso = data.cases.find((c) => c.id === id) ?? null;
    }
  } catch {
    // fall through to error below
  }

  if (!caso) {
    return new NextResponse('Caso no encontrado', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const pasajero      = String(caso.pasajero      ?? '—');
  const vuelo         = String(caso.vuelo         ?? '—');
  const ruta          = String(caso.ruta          ?? '—');
  const fecha         = String(caso.fecha         ?? '—');
  const compensacion  = Number(caso.compensacion  ?? 0);
  const today         = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Determine airline name from flight code (IATA prefix)
  const airlineMap: Record<string, string> = {
    UX: 'Air Europa',
    IB: 'Iberia',
    VY: 'Vueling Airlines',
    FR: 'Ryanair',
    U2: 'easyJet',
    W6: 'Wizz Air',
    BW: 'Caribbean Airlines',
    AV: 'Avianca',
    CM: 'Copa Airlines',
  };
  const iataCode = vuelo.slice(0, 2).toUpperCase();
  const aerolinea = airlineMap[iataCode] ?? `${iataCode} Airlines`;

  const html = /* html */`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Carta Formal — ${pasajero}</title>
  <style>
    /* ── Print-optimised layout ── */
    @page {
      size: A4;
      margin: 25mm 20mm 25mm 25mm;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
    }
    /* Screen preview wrapper */
    @media screen {
      body { padding: 40px; max-width: 800px; margin: 0 auto; }
      .print-hint {
        background: #f0f4ff;
        border: 1px solid #c7d2fe;
        border-radius: 6px;
        padding: 10px 16px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        color: #3730a3;
        margin-bottom: 32px;
      }
    }
    @media print { .print-hint { display: none; } }

    /* ── Letter structure ── */
    .header-logo {
      font-family: system-ui, Arial, sans-serif;
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #1e40af;
      margin-bottom: 4px;
    }
    .header-sub {
      font-family: system-ui, Arial, sans-serif;
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 32px;
    }
    .date-line { text-align: right; margin-bottom: 24px; }
    .subject {
      font-weight: bold;
      text-decoration: underline;
      margin-bottom: 20px;
    }
    p { margin-bottom: 14px; text-align: justify; }
    .firma { margin-top: 48px; }
    .firma p { margin-bottom: 4px; text-align: left; }
    .firma .name { font-weight: bold; margin-top: 8px; }
    .ref-box {
      border: 1px solid #94a3b8;
      padding: 10px 14px;
      margin: 24px 0;
      font-size: 10.5pt;
    }
    .ref-box strong { display: inline-block; width: 130px; }
    hr { border: none; border-top: 1px solid #cbd5e1; margin: 32px 0; }
    footer {
      font-family: system-ui, Arial, sans-serif;
      font-size: 8.5pt;
      color: #94a3b8;
      text-align: center;
      margin-top: 48px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
  </style>
</head>
<body>

<div class="print-hint">
  📄 Carta formal lista para imprimir. Usa <strong>Archivo → Imprimir → Guardar como PDF</strong> (o Ctrl+P).
</div>

<!-- Letterhead -->
<div class="header-logo">AeroReclaim</div>
<div class="header-sub">
  Reclamaciones aéreas · Reg. CE 261/2004 · info@aeroreclaim.com · aeroreclaim.com
</div>

<!-- Date -->
<div class="date-line">Madrid, a ${today}</div>

<!-- Recipient -->
<p>
  A la atención del Departamento de Atención al Cliente<br />
  <strong>${aerolinea}</strong>
</p>

<!-- Subject -->
<p class="subject">
  Asunto: Reclamación de compensación por vuelo retrasado/cancelado —
  Reglamento (CE) n.° 261/2004 del Parlamento Europeo
</p>

<!-- Reference box -->
<div class="ref-box">
  <strong>Pasajero:</strong> ${pasajero}<br />
  <strong>Vuelo:</strong> ${vuelo}<br />
  <strong>Ruta:</strong> ${ruta}<br />
  <strong>Fecha del vuelo:</strong> ${fecha}<br />
  <strong>Compensación:</strong> ${compensacion.toLocaleString('es-ES')} €
</div>

<!-- Body -->
<p>
  Muy señores míos:
</p>

<p>
  Por medio de la presente y en nombre y representación de D./Dña.
  <strong>${pasajero}</strong> (en adelante, «el/la pasajero/a»), me dirijo a ustedes
  con el fin de reclamar formalmente la compensación económica que corresponde
  de conformidad con lo establecido en el Reglamento (CE) n.° 261/2004 del
  Parlamento Europeo y del Consejo, de 11 de febrero de 2004.
</p>

<p>
  El/la pasajero/a disponía de una reserva confirmada para el vuelo
  <strong>${vuelo}</strong>, con origen y destino <strong>${ruta}</strong>, con
  fecha prevista de salida el <strong>${fecha}</strong>, operado por
  <strong>${aerolinea}</strong>.
</p>

<p>
  El/la pasajero/a se vio afectado/a por un retraso o cancelación de dicho vuelo
  que, de acuerdo con el Reglamento (CE) n.° 261/2004, genera el derecho a percibir
  una compensación económica de <strong>${compensacion.toLocaleString('es-ES')} €</strong>,
  en función de la distancia de la ruta afectada y la naturaleza del incidente.
</p>

<p>
  En virtud de lo anterior, solicitamos que procedan al abono íntegro de la
  compensación indicada mediante transferencia bancaria a la cuenta que se les
  facilitará una vez acusen recibo de la presente carta, en un plazo máximo de
  <strong>14 días naturales</strong> desde la recepción de este escrito.
</p>

<p>
  En caso de no recibir respuesta en el plazo indicado, nos reservamos el derecho
  de iniciar las acciones legales o administrativas oportunas ante la Agencia
  Estatal de Seguridad Aérea (AESA) y/o los tribunales competentes, con la
  consiguiente repercusión de costas y gastos adicionales.
</p>

<p>
  Quedamos a su disposición para cualquier aclaración que estimen necesaria.
</p>

<p>Atentamente,</p>

<div class="firma">
  <p>En representación de <strong>${pasajero}</strong></p>
  <p class="name">AeroReclaim</p>
  <p>Reclamaciones aéreas — CE 261/2004</p>
  <p>info@aeroreclaim.com | aeroreclaim.com</p>
</div>

<hr />

<footer>
  AeroReclaim · Reclamaciones aéreas en España bajo el Reglamento CE 261/2004 ·
  Este documento ha sido generado automáticamente el ${today}.
</footer>

</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      // charset=utf-8 in both the HTTP header and the HTML meta tag ensures
      // all Spanish characters (ñ, á, é, í, ó, ú, ü, ¿, ¡ …) render correctly.
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
