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
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TELEGRAM_BOT_TOKEN
NEXT_PUBLIC_APP_URL
```

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
