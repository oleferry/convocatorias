# 🐾 DamePerrasPerro

"El perro que encuentra las perras." Web app + bot de Telegram que rastrea subvenciones,
ayudas y convocatorias (BDNS, fondos UE, premios privados) y las cruza con el perfil de
cada empresa/autónomo. Multi-perfil por usuario, memoria/resumen generados con IA,
leads a gestorías, y un panel de coste real de la API de Claude.

## Estructura
```
convocatorias/
├── app/
│   ├── auth/                    ← Login / registro (Supabase auth)
│   ├── dashboard/                ← Panel principal (convocatorias, sugerencias, memoria/resumen IA)
│   ├── organizations/             ← Gestión de perfiles de empresa (CNAE/IAE/CCAA/provincia)
│   ├── admin/costs/                ← Panel de coste real de la API de Claude
│   ├── admin/leads/                ← Panel de leads → gestorías
│   ├── api/                        ← Endpoints API (ver más abajo)
│   ├── layout.tsx, Landing.tsx      ← Layout raíz + landing pública
│   ├── robots.ts, sitemap.ts        ← SEO (convenciones de metadata de Next.js)
│   └── opengraph-image.tsx, twitter-image.tsx  ← Imagen social generada dinámicamente
├── lib/
│   ├── supabase.ts / supabase-server.ts  ← Clientes Supabase (browser / servidor+admin)
│   ├── ai.ts                              ← Llamadas a Claude (analyze, memoria, resumen, radar…)
│   ├── admin.ts                           ← Emails con acceso admin (ADMIN_EMAILS)
│   ├── costs.ts                           ← Coste real por llamada a Claude → api_usage_log
│   ├── bdns.ts / bdns-sync.ts             ← Cliente BDNS + sync incremental al catálogo
│   ├── eu-funding.ts / radar-data.ts / radar-sync.ts / descubrir.ts  ← Radar de fondos UE y privados
│   ├── matching.ts / geo.ts               ← Motor de matching perfil↔convocatoria
│   ├── theme.ts / types.ts                ← Tokens de marca ("Rastro") + tipos TS
│   └── og-image.tsx                       ← Generador de la imagen OG/Twitter
├── bot/                          ← Bot de Telegram (deploy en Railway, `npm start`)
├── supabase/migrations/          ← 001 → 013, ver abajo
├── public/data/                  ← Catálogos oficiales INE (CNAE, IAE, provincias, municipios)
├── diseno-referencia.jsx         ← Prototipo visual histórico (ya no representa el UI actual)
├── .env.local.example
└── README.md
```

## Despliegue paso a paso

### 1. Supabase (base de datos)
1. https://supabase.com → New project
2. SQL Editor → ejecutar las migraciones `supabase/migrations/001_schema.sql` → `013_resumen_ia.sql`, **en orden**
3. Settings → API → copiar URL, anon key y service_role key

### 2. Telegram
1. Telegram → @BotFather → `/newbot` → guardar el token y el username

### 3. Anthropic API
1. https://console.anthropic.com → API Keys → Create Key

### 4. Resend (email del digest, opcional)
1. https://resend.com → dominio verificado → API Key

### 5. GitHub + Vercel (web)
1. Subir el repo a GitHub
2. https://vercel.com → Add New Project → conectar el repo
3. Añadir las variables de entorno (ver abajo) → Deploy

### 6. Railway (solo el bot de Telegram)
1. https://railway.app → New Project → GitHub repo
2. Root Directory: `bot`
3. Start Command: `npm start`
4. Añadir las mismas variables de entorno que en Vercel

## Variables de entorno

```
# Web (Vercel) — imprescindibles
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server-only, salta RLS — NUNCA en el navegador
ANTHROPIC_API_KEY           # /api/grants/analyze, /api/search, memoria, resumen, radar
NEXT_PUBLIC_APP_URL         # p.ej. https://www.dameperrasperro.es

# Admin
ADMIN_EMAILS                # emails con acceso a /admin/leads y /admin/costs (coma-separados)

# Digest semanal + leads (opcionales, sin ellos el digest solo va por Telegram)
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
RESEND_API_KEY
DIGEST_FROM                 # remitente, p.ej. "DamePerrasPerro <hola@dameperrasperro.es>"
LEADS_NOTIFY_EMAIL          # a quién avisar de leads nuevos (si no, usa el primero de ADMIN_EMAILS)

# Crons manuales (opcional)
CRON_SECRET                 # protege /api/cron/* si se llaman a mano fuera de Vercel Cron
```

`ADMIN_EMAILS` solo llega a server components/API routes — el check de admin en el
dashboard (cliente) usa el fallback hardcodeado en `lib/admin.ts`, no esta variable.

## Componentes y despliegue
- **Web** (`/app`, `/lib`) → Vercel. Raíz del repo = raíz de la app Next.js.
- **Bot de Telegram** (`/bot`) → Railway · Root `bot` · `npm start`. Vinculación de cuenta, comandos, "pégame un link", alertas de plazo (cron diario propio).
- La ingesta BDNS, el radar y el digest semanal **no** dependen de Railway: corren como Vercel Cron.

## Migraciones (ejecutar en orden en el SQL Editor de Supabase)
1. `001_schema.sql` — esquema base (usuarios, perfiles, convocatorias, historial, RLS).
2. `002_bdns_catalogo.sql` — catálogo público BDNS + estado de sync incremental.
3. `003_digest.sql` — control de envíos del digest semanal.
4. `004_memoria.sql` — columna `memoria` (borrador de solicitud con IA) en `grants`.
5. `005_telegram_link.sql` — vinculación segura de Telegram (token de un solo uso).
6. `006_catalogos.sql` — CNAE múltiple + provincia en perfiles.
7. `007_radar.sql` — columna `fuente` (bdns / privada / europea) en el catálogo.
8. `008_fix_convpub_rls.sql` — arregla la política de lectura pública del catálogo.
9. `009_iae_multiple.sql` — IAE múltiple en perfiles.
10. `010_leads.sql` — tabla `leads` (monetización vía gestorías).
11. `011_provincia_catalogo.sql` — provincia derivada para convocatorias de ámbito local.
12. `012_costes.sql` — `api_usage_log` (coste real por llamada a Claude) + `fixed_costs`.
13. `013_resumen_ia.sql` — columna `resumen_ia` (resumen de las bases de la convocatoria) en `grants`.

## Crons (Vercel)
Definidos en `vercel.json`. Necesitan `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
- **`/api/cron/ingest`** (diario 06:00): ingesta BDNS al catálogo + refresco del radar (privadas + europeas), y los lunes además dispara el descubrimiento IA de nuevos privados.
- **`/api/cron/digest`** (lunes 07:00): digest semanal por usuario (Telegram + email Resend).
- **`/api/cron/radar`** y **`/api/cron/descubrir`**: existen como rutas pero **no** están en `vercel.json` — solo se disparan a mano (`?key=CRON_SECRET`) o como efecto del cron de `ingest` de los lunes.
- El plan Hobby de Vercel limita a 2 crons con granularidad diaria — por eso el radar va empaquetado dentro de `ingest` en vez de tener su propio horario. Para separarlo hace falta Vercel Pro.

## SEO y analítica
- `app/robots.ts` / `app/sitemap.ts`: indexa la landing, bloquea `/dashboard`, `/organizations`, `/admin`, `/api`.
- `app/opengraph-image.tsx` / `twitter-image.tsx`: tarjeta social generada en el momento (sin depender de un asset de diseño).
- `@vercel/analytics`: montado en `layout.tsx`. Requiere activar "Web Analytics" una vez en el dashboard de Vercel (gratis en Hobby).

## ✅ Activación (checklist)
1. Supabase → SQL Editor → ejecutar migraciones 001→013.
2. Vercel → Environment Variables: todas las de la sección de arriba que apliquen → Redeploy.
3. Dispara una vez `/api/cron/ingest?key=...` → el catálogo se llena y "Sugeridas" muestra BDNS + privadas + europeas.
4. El bot de Telegram (avisos de plazo, "pégame un link") necesita Railway, Root `bot`, `npm start`.
5. Activa "Web Analytics" en el dashboard de Vercel para que `@vercel/analytics` empiece a registrar tráfico.

## Coste estimado
- Supabase: gratis (free tier)
- Vercel: gratis (Hobby)
- Railway (solo bot de Telegram): ~5€/mes
- Anthropic API: variable según uso — coste real y desglose por función en `/admin/costs`
- Dominio: ~12€/año
