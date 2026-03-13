# AeroReclaim Dashboard

Dashboard interactivo para gestionar las tareas del proyecto AeroReclaim, conectado directamente a la base de datos de Notion.

## Características

- **Kanban Board** con drag & drop entre columnas (Pendiente → En Progreso → Completada)
- **Timeline / Gantt** visual por fecha límite, coloreado por categoría
- **Panel de métricas** con estadísticas, progreso, tareas urgentes y distribución por categoría
- **Filtros** por prioridad, categoría, estado y búsqueda de texto
- **Crear tareas** directamente desde el dashboard
- **Editar notas** inline en cada card
- **Marcar como completada** con un clic
- **Auto-refresh** cada 5 minutos
- Dark mode nativo

---

## Setup rápido

### 1. Clonar / copiar el proyecto

```bash
cd aeroreclaim-dashboard
npm install
```

### 2. Crear la Notion Integration

1. Ve a [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Crea una nueva integración ("AeroReclaim Dashboard")
3. Copia el **Internal Integration Token** (`secret_xxx...`)
4. Abre tu base de datos **AeroReclaim — Task Tracker** en Notion
5. Clic en `···` → **Connections** → añade la integración que acabas de crear

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=abb1607fb6b0460782fc0d268a7ce21f
```

### 4. (Recomendado) Añadir propiedad "Estado" a Notion

Para habilitar las 3 columnas del Kanban (Pendiente / En Progreso / Completada), añade a tu base de datos una propiedad:

| Nombre | Tipo | Opciones |
|--------|------|----------|
| Estado | Select | `Pendiente`, `En Progreso`, `Completada` |

> Si no la añades, el dashboard funciona igualmente usando el campo `Completada` (checkbox), pero sólo tendrás 2 estados: Pendiente y Completada.

### 5. Arrancar

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## Estructura del proyecto

```
aeroreclaim-dashboard/
├── .env.example
├── .env.local           ← Tus credenciales (no subir a git)
├── package.json
├── tailwind.config.ts
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── globals.css
    │   └── api/
    │       └── notion/
    │           └── tasks/
    │               ├── route.ts        ← GET (listar) + POST (crear)
    │               └── [id]/
    │                   └── route.ts    ← PATCH (actualizar)
    ├── lib/
    │   └── notion.ts    ← Cliente Notion + parsers
    ├── types/
    │   └── index.ts     ← Tipos TS + constantes de colores
    └── components/
        ├── Dashboard.tsx          ← Componente principal (estado global)
        ├── KanbanBoard.tsx        ← Drag & drop multi-columna
        ├── KanbanColumn.tsx       ← Columna individual (droppable)
        ├── TaskCard.tsx           ← Card de tarea (sortable)
        ├── TimelineView.tsx       ← Vista Gantt SVG
        ├── MetricsPanel.tsx       ← Estadísticas + donut chart
        ├── FilterBar.tsx          ← Filtros + búsqueda
        └── CreateTaskModal.tsx    ← Modal de nueva tarea
```

---

## Tech stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| Estilos | Tailwind CSS |
| Animaciones | Framer Motion |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Charts | Recharts |
| Fechas | date-fns |
| Iconos | Lucide React |
| Notion API | @notionhq/client |

---

## Propiedades de Notion esperadas

| Propiedad | Tipo Notion | Requerida |
|-----------|-------------|-----------|
| Tarea | Title | ✅ |
| Prioridad | Select (`P1 - Urgente`, `P2 - Alta`, `P3 - Media`) | ✅ |
| Categoria | Select | ✅ |
| Fecha Limite | Date | ✅ |
| Notas | Rich Text | ✅ |
| Completada | Checkbox | ✅ |
| Estado | Select (`Pendiente`, `En Progreso`, `Completada`) | Recomendado |

---

## Seguridad

- El token de Notion **nunca** se expone al frontend — todas las llamadas pasan por las API Routes de Next.js
- Añade `.env.local` a tu `.gitignore` (Next.js lo hace por defecto)

---

## Build para producción

```bash
npm run build
npm start
```

O despliega en Vercel con las variables de entorno configuradas en el dashboard de Vercel.
