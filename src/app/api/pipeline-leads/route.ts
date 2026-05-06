import { NextResponse } from 'next/server';

// ─── Config ───────────────────────────────────────────────────────────────────
const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '10zEyvd3P57DidwOi2UM1VnXHDnPrIWMnpTSbdZ4zX-E';
const API_KEY  = process.env.GOOGLE_SHEETS_API_KEY ?? '';

// Cadence thresholds
const CADENCE = [
  { status: 'mandato_enviado', label: 'Mandato enviado', minDay: 0,  maxDay: 1,  color: 'green'  },
  { status: 'recordatorio_1',  label: 'Recordatorio 1',  minDay: 2,  maxDay: 4,  color: 'yellow' },
  { status: 'recordatorio_2',  label: 'Recordatorio 2',  minDay: 5,  maxDay: 6,  color: 'orange' },
  { status: 'ultimo_intento',  label: 'Último intento',  minDay: 7,  maxDay: 13, color: 'red'    },
  { status: 'perdido',         label: 'Perdido',         minDay: 14, maxDay: 999, color: 'gray'  },
];

function getCadenceStatus(days: number) {
  return CADENCE.find(c => days >= c.minDay && days <= c.maxDay) ?? CADENCE[CADENCE.length - 1];
}

function nextActionLabel(days: number): string {
  if (days <= 1)  return 'Enviar recordatorio 1 en ' + (2 - days) + ' día(s)';
  if (days <= 4)  return 'Enviar recordatorio 2 en ' + (5 - days) + ' día(s)';
  if (days <= 6)  return 'Enviar último intento en ' + (7 - days) + ' día(s)';
  if (days <= 13) return 'Cierre inminente — ' + (14 - days) + ' día(s) restantes';
  return 'Marcar como perdido';
}

function addDays(date: Date, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(from: Date | string, to: Date): number {
  const a = from instanceof Date ? from : new Date(from);
  return Math.max(0, Math.floor((to.getTime() - a.getTime()) / 86400000));
}

interface PipelineLead {
  caseId: string;
  name: string;
  email: string;
  flight: string;
  airline: string;
  compensation: number;
  status: string;
  statusLabel: string;
  statusColor: string;
  daysSinceMandate: number;
  nextAction: string;
  nextActionDate: string;
  welcomeSentDate: string | null;
}

async function fetchPipelineLeads(): Promise<PipelineLead[]> {
  if (!API_KEY) return getMockLeads();

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;

  // Read both tabs in parallel
  const [obRes, leadsRes] = await Promise.all([
    fetch(`${base}/Onboarding_Queue!A:Z?key=${API_KEY}`, { next: { revalidate: 30 } }),
    fetch(`${base}/Leads!A:Z?key=${API_KEY}`,            { next: { revalidate: 30 } }),
  ]);

  const results: PipelineLead[] = [];
  const today = new Date();

  // ── Onboarding_Queue: status=BIENVENIDA_ENVIADA, no MANDATE_SIGNED ──────────
  if (obRes.ok) {
    const data = await obRes.json();
    const rows: string[][] = data.values ?? [];
    if (rows.length >= 2) {
      const hdr = rows[0].map((h: string) => h.trim().toLowerCase());
      const col = (n: string) => hdr.indexOf(n);

      const colCaseId      = col('case_id');
      const colName        = col('passenger_name');
      const colEmail       = col('passenger_email');
      const colFlight      = col('flight_number');
      const colAirline     = col('airline_name');
      const colComp        = col('compensation_eur');
      const colStatus      = col('status');
      const colWelcome     = col('welcome_sent_date');
      const colMandateSig  = col('mandate_signed');

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const get = (c: number) => (c >= 0 && c < r.length ? String(r[c] ?? '').trim() : '');

        const status      = get(colStatus);
        const mandateSig  = get(colMandateSig);
        const caseId      = get(colCaseId);
        const email       = get(colEmail);
        const name        = get(colName);

        if (!caseId || !email) continue;
        if (email.includes('@aeroreclaim.com') || email.includes('ptusquets@')) continue;
        if (mandateSig === 'TRUE' || mandateSig === '1' || status === 'FIRMADO') continue;
        if (!['BIENVENIDA_ENVIADA', 'APROBADO', 'MANDATE_PENDING', 'PENDIENTE'].includes(status)) continue;

        const rawWelcome  = get(colWelcome);
        const welcomeDate = rawWelcome
          ? rawWelcome.includes('/') ? rawWelcome.split('/').reverse().join('-') : rawWelcome
          : null;
        const refDate     = welcomeDate ? new Date(welcomeDate) : today;
        const days        = daysBetween(refDate, today);
        const cadence     = getCadenceStatus(days);

        results.push({
          caseId,
          name,
          email,
          flight:            get(colFlight),
          airline:           get(colAirline),
          compensation:      parseInt(get(colComp), 10) || 0,
          status:            cadence.status,
          statusLabel:       cadence.label,
          statusColor:       cadence.color,
          daysSinceMandate:  days,
          nextAction:        nextActionLabel(days),
          nextActionDate:    addDays(refDate, days <= 1 ? 2 : days <= 4 ? 5 : days <= 6 ? 7 : 14),
          welcomeSentDate:   welcomeDate,
        });
      }
    }
  }

  return results.sort((a, b) => b.daysSinceMandate - a.daysSinceMandate);
}

function getMockLeads(): PipelineLead[] {
  const today = new Date();
  return [
    {
      caseId: 'AR-20260501-092925-116',
      name: 'Matheus Aledon Lima',
      email: 'matheusaledonn@gmail.com',
      flight: 'TO4624',
      airline: 'Transavia France',
      compensation: 250,
      status: 'recordatorio_1',
      statusLabel: 'Recordatorio 1',
      statusColor: 'yellow',
      daysSinceMandate: 5,
      nextAction: 'Enviar recordatorio 2 en 0 día(s)',
      nextActionDate: addDays(today, 0),
      welcomeSentDate: addDays(today, -5),
    },
    {
      caseId: 'AR-20260504-072923-972',
      name: 'Keily Paola Rivera Rivera',
      email: 'keilyrivera97.kr@gmail.com',
      flight: 'UX15',
      airline: 'Air Europa',
      compensation: 600,
      status: 'mandato_enviado',
      statusLabel: 'Mandato enviado',
      statusColor: 'green',
      daysSinceMandate: 2,
      nextAction: 'Enviar recordatorio 1 en 0 día(s)',
      nextActionDate: addDays(today, 0),
      welcomeSentDate: addDays(today, -2),
    },
  ];
}

export async function GET() {
  try {
    const leads = await fetchPipelineLeads();

    const activeLeads = leads.filter(l => l.status !== 'perdido');
    const totalEur    = activeLeads.reduce((s, l) => s + l.compensation, 0);
    const oldestDays  = activeLeads.length > 0 ? Math.max(...activeLeads.map(l => l.daysSinceMandate)) : 0;

    return NextResponse.json({
      leads: activeLeads,
      kpis: {
        activeCount:    activeLeads.length,
        totalEur,
        oldestDays,
        conversion30d:  null, // future: calculate from historical data
      },
      source: API_KEY ? 'sheets' : 'mock',
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[pipeline-leads GET]', err);
    // Return mock data on error so UI always renders
    const mock = getMockLeads();
    return NextResponse.json({
      leads: mock,
      kpis: { activeCount: mock.length, totalEur: mock.reduce((s, l) => s + l.compensation, 0), oldestDays: 5, conversion30d: null },
      source: 'mock_fallback',
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
