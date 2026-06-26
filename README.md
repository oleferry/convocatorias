# 📑 Gestor de Convocatorias v2

Web app + Bot de Telegram para gestionar subvenciones con IA. Multi-perfil por usuario.

## Estructura
```
convocatorias/
├── app/                    ← Web Next.js
│   ├── auth/               ← Login / Registro
│   ├── dashboard/          ← Panel principal
│   ├── organizations/      ← Gestión de perfiles de empresa
│   ├── api/                ← Endpoints API
│   └── layout.tsx
├── lib/
│   ├── supabase.ts         ← Cliente browser
│   ├── supabase-server.ts  ← Cliente servidor
│   ├── ai.ts               ← Análisis y búsqueda con Claude
│   └── types.ts            ← Tipos TypeScript + constantes
├── bot/
│   └── index.js            ← Bot de Telegram (deploy en Railway)
├── supabase/migrations/
│   └── 001_schema.sql      ← Schema completo de BD
├── diseno-referencia.jsx   ← Prototipo visual aprobado
├── .env.local.example      ← Variables de entorno necesarias
└── README.md
```

## Despliegue paso a paso

### 1. Supabase (base de datos)
1. https://supabase.com → New project
2. SQL Editor → pegar contenido de `supabase/migrations/001_schema.sql` → Run
3. Settings → API → copiar URL, anon key y service_role key

### 2. Bot de Telegram
1. Telegram → @BotFather → /newbot
2. Guardar el token

### 3. Anthropic API
1. https://console.anthropic.com → API Keys → Create Key

### 4. GitHub
1. Crear repo en github.com
2. Subir esta carpeta

### 5. Vercel (web)
1. https://vercel.com → Add New Project → conectar repo GitHub
2. Añadir variables de entorno (ver .env.local.example)
3. Deploy

### 6. Railway (bot)
1. https://railway.app → New Project → GitHub repo
2. Root Directory: `bot`
3. Start Command: `node index.js`
4. Añadir las mismas variables de entorno
5. Deploy

## Variables de entorno necesarias
```
# Web (Vercel)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY            # /api/grants/analyze y /api/search
NEXT_PUBLIC_APP_URL

# Bot + Worker (Railway) — además de las dos NEXT_PUBLIC_SUPABASE_*
SUPABASE_SERVICE_ROLE_KEY   # acceso de servidor (salta RLS) — NUNCA en el navegador
TELEGRAM_BOT_TOKEN          # bot de Telegram + envío del digest
RESEND_API_KEY              # email del digest (opcional; sin él, solo Telegram)
DIGEST_FROM                 # remitente, p.ej. "Convocatorias <hola@tudominio.es>"
```

## Componentes y despliegue
- **Web** (`/app`, `/lib`) → Vercel. Raíz del repo = raíz de la app Next.js.
- **Bot de Telegram** (`/bot`) → Railway · Root `bot` · `npm start`. Vinculación de cuenta, comandos y alertas de plazo (cron diario).
- **Worker** (`/worker`) → Railway · Root `worker` · `npm start`. Orquesta:
  - **Ingesta BDNS** (`ingest-bdns.js`): catálogo `convocatorias_publicas`, sync incremental diario.
  - **Digest semanal** (`digest.js`): convocatorias que encajan con cada perfil → Telegram + email (Resend). Lunes 08:00.
  - Pruebas locales sin BD: `npm run ingest:dry`, `npm run digest:sample`.

## Migraciones (ejecutar en orden en el SQL Editor de Supabase)
1. `001_schema.sql` — esquema base (usuarios, perfiles, convocatorias…).
2. `002_bdns_catalogo.sql` — catálogo público BDNS + estado de sync.
3. `003_digest.sql` — control de envíos del digest.
4. `004_memoria.sql` — columna de memoria en grants.
5. `005_telegram_link.sql` — vinculación segura de Telegram.
6. `006_catalogos.sql` — CNAE múltiple + provincia en perfiles.
7. `007_radar.sql` — columna `fuente` (bdns / privada / europea).

## Crons (Vercel) — funcionan sin Railway
Definidos en `vercel.json`. Necesitan `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
- **`/api/cron/ingest`** (diario 06:00): ingesta BDNS al catálogo + refresco del radar (privadas + europeas reales del EU Funding Portal).
- **`/api/cron/digest`** (lunes 07:00): digest semanal por usuario (Telegram + email Resend).
- **`/api/cron/radar`**: disparo manual del radar.
- Todos se pueden lanzar a mano: `https://TU_DOMINIO/api/cron/<ruta>?key=CRON_SECRET`.

## ✅ Activación (checklist)
1. Supabase → SQL Editor → ejecutar migraciones 001→007.
2. Vercel → Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_USERNAME`, `NEXT_PUBLIC_APP_URL`, y para el digest `TELEGRAM_BOT_TOKEN` + `RESEND_API_KEY` + `DIGEST_FROM`; opcional `CRON_SECRET`. Redeploy.
3. Dispara una vez `/api/cron/ingest?key=...` y `/api/cron/radar?key=...` → el catálogo se llena y "Sugeridas" muestra BDNS + privadas + europeas.
4. (Solo el bot de Telegram —avisos de plazo y "pégame un link"— necesita Railway, Root `bot`, `npm start`.)

## Coste estimado
- Supabase: gratis
- Vercel: gratis
- Railway: ~3€/mes
- Anthropic API: ~5-15€/mes según uso
- Total: ~8-18€/mes

## Para Claude Code
Cuando abras Claude Code en esta carpeta, dile:
"Aplica el diseño de diseno-referencia.jsx a todos los componentes,
corrige errores de TypeScript, instala dependencias y prepara para deploy en Vercel."
