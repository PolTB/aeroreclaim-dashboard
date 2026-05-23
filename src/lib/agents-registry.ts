// agents-registry.ts
// Mirror del AGENTS_REGISTRY.md del repo aeroreclaim-ceo (source of truth).
// EL AUDITOR (dashboard-auditor) valida que ambos coinciden semanalmente.
// Última sincronización: 2026-05-23

export interface Agent {
  alias?: string;
  name: string;
  layer: 'subagent' | 'external' | 'gas';
  model?: string;
  platform?: string;
  capacidad: string;
  currentAer?: string | null;
  lastActivity?: string | null;
  health?: 'green' | 'yellow' | 'red';
}

export const AGENTS: Agent[] = [
  // ─── A. Subagentes Claude Code (.claude/agents/) ────────────────────────────
  {
    alias: 'EL OPERARIO',
    name: 'aer-executor',
    layer: 'subagent',
    model: 'Sonnet',
    platform: 'Claude Code Desktop',
    capacidad: 'Ejecuta AERs bajo/medio riesgo con Done claro: commits blog, sync Sheets, queries Notion, skills CEO. NUNCA emails, NUNCA gasto, NUNCA crea AERs.',
    currentAer: null,
    lastActivity: '2026-05-23',
    health: 'green',
  },
  {
    alias: 'EL INSPECTOR',
    name: 'aer-controller',
    layer: 'subagent',
    model: 'Sonnet',
    platform: 'Claude Code Desktop',
    capacidad: 'Verifica 4 reglas antes de cerrar AER: Done cumplido, outputs reales, cero gasto sin OK, alineación NORTE.',
    currentAer: null,
    lastActivity: '2026-05-23',
    health: 'green',
  },
  {
    alias: 'EL VIGÍA',
    name: 'strategic-watchdog',
    layer: 'subagent',
    model: 'Haiku',
    platform: 'Claude Code Desktop (scheduled)',
    capacidad: 'Escanea 5 frentes del NEGOCIO diariamente: drift AERs, deadlines legales, KPI vs curva, modo constructor, drift NORTE.',
    currentAer: null,
    lastActivity: '2026-05-23',
    health: 'green',
  },
  {
    alias: 'EL AUDITOR',
    name: 'dashboard-auditor',
    layer: 'subagent',
    model: 'Haiku',
    platform: 'Claude Code Desktop (scheduled lunes 09:00)',
    capacidad: 'Escanea 5 frentes del SISTEMA: drift CLAUDE.md↔dashboard, AGENTS_REGISTRY stale, AERs huérfanas, tabs mintiendo, ACTIVE_CONTEXT↔Notion.',
    currentAer: null,
    lastActivity: '2026-05-23',
    health: 'green',
  },
  {
    name: 'aer-context-builder',
    layer: 'subagent',
    model: 'Sonnet',
    platform: 'Claude Code Desktop (helper)',
    capacidad: 'Helper de aer-executor: compila contexto necesario para crear AER nueva en Notion. Lee ACTIVE_CONTEXT, casos, reglas, código.',
    currentAer: null,
    lastActivity: '2026-05-23',
    health: 'green',
  },

  // ─── B. Agentes externos ────────────────────────────────────────────────────
  {
    name: 'CoWork (Admin)',
    layer: 'external',
    platform: 'CoWork → "Admin AeroReclaim"',
    capacidad: 'Gmail inbox, drafts en AERs Notion, Drive, gestión correo entrante.',
    currentAer: null,
    lastActivity: '2026-05-05',
    health: 'green',
  },
  {
    name: 'Claude Tech',
    layer: 'external',
    platform: 'CoWork → "Tech & Pipeline"',
    capacidad: 'Código (dashboard, web, GAS), debugging, bugs pipeline.',
    currentAer: 'AER-124, AER-135, AER-162',
    lastActivity: '2026-05-05',
    health: 'yellow',
  },
  {
    name: 'Claude SEO',
    layer: 'external',
    platform: 'CoWork → "SEO & Contenido"',
    capacidad: 'Artículos blog (solo texto .md o .docx).',
    currentAer: null,
    lastActivity: '2026-04-18',
    health: 'green',
  },
  {
    name: 'Claude Marketing',
    layer: 'external',
    platform: 'claude.ai → "Marketing & Outreach"',
    capacidad: 'Emails, copywriting, captions, keywords Ads, listas outbound.',
    currentAer: 'AER-122, AER-140, AER-147, AER-149',
    lastActivity: '2026-05-05',
    health: 'yellow',
  },
  {
    name: 'Claude Legal',
    layer: 'external',
    platform: 'CoWork → "Legal-Ops"',
    capacidad: 'Análisis CE 261, scoring, dossiers AESA (cuando skill no basta).',
    currentAer: null,
    lastActivity: '2026-04-23',
    health: 'green',
  },
  {
    name: 'Claude Design',
    layer: 'external',
    platform: 'claude.ai (paleta)',
    capacidad: 'Prototipos visuales, one-pagers, materiales marketing.',
    currentAer: null,
    lastActivity: '2026-04-21',
    health: 'green',
  },
  {
    name: 'Comet',
    layer: 'external',
    platform: 'Perplexity',
    capacidad: 'Browser sin terminal: Drive UI, Apps Script console, Instagram, formularios web.',
    currentAer: 'AER-57, AER-58, AER-60, AER-63, AER-97…',
    lastActivity: '2026-05-11',
    health: 'yellow',
  },
  {
    name: 'Paperclip',
    layer: 'external',
    platform: 'localhost:3100',
    capacidad: 'Agentes autónomos programados: Legal-Ops, Tech, Marketing.',
    currentAer: 'AER-137',
    lastActivity: '2026-04-24',
    health: 'yellow',
  },
  {
    name: 'Claude in Chrome',
    layer: 'external',
    platform: 'Extensión Chrome con sesión Pol',
    capacidad: 'Browser con cookies reales: Google Ads, Gmail UI, paneles con login.',
    currentAer: null,
    lastActivity: '2026-04-29',
    health: 'green',
  },

  // ─── C. Pipeline GAS ────────────────────────────────────────────────────────
  {
    name: 'Lead Receiver',
    layer: 'gas',
    platform: 'MandatoDigital.gs',
    capacidad: 'Recibe POST formulario → crea row Sheet Leads. Trigger: onFormSubmit + doPost.',
    health: 'green',
  },
  {
    name: 'Legal Scoring',
    layer: 'gas',
    platform: 'LegalScoring.gs',
    capacidad: 'Scoring CE 261 → APROBADO / RECHAZADO / REVISIÓN_MANUAL. Trigger: 5 min.',
    health: 'green',
  },
  {
    name: 'Onboarding',
    layer: 'gas',
    platform: 'OnboardingAgent.gs',
    capacidad: 'Email bienvenida + PDF mandato adjunto. Trigger: 15 min.',
    health: 'green',
  },
  {
    name: 'Extrajudicial',
    layer: 'gas',
    platform: 'ExtrajudicialAgent.gs',
    capacidad: 'Genera carta CE 261 + envío aerolínea. Tras MANDATE_SIGNED.',
    health: 'green',
  },
  {
    name: 'AESA',
    layer: 'gas',
    platform: 'AESAAgent.gs',
    capacidad: 'Dossier AESA si silencio 30d. T+30d desde extrajudicial.',
    health: 'green',
  },
  {
    name: 'Collection',
    layer: 'gas',
    platform: 'CollectionAgent.gs',
    capacidad: 'Cobro + factura 25%+IVA. Tras pago aerolínea.',
    health: 'green',
  },
];

export const REGISTRY_LAST_UPDATED = '2026-05-23';
