-- ================================================================
--  CONVOCATORIAS APP — Schema v2
--  Diseñado para:
--  ✅ Multi-perfil por usuario (varias empresas + autónomo)
--  ✅ Usuarios independientes (cada uno sus datos)
--  ✅ BD preparada para colaboración, roles, documentos, alertas
-- ================================================================

-- ── 1. USUARIOS (extiende auth.users de Supabase) ─────────────
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  telegram_id   bigint unique,
  telegram_linked_at timestamptz,
  -- Preferencias globales del usuario
  alert_days    int[] default '{7,3,1}',   -- días antes del plazo para alertar
  language      text default 'es',
  timezone      text default 'Europe/Madrid',
  -- Plan (preparado para freemium futuro)
  plan          text default 'free' check (plan in ('free','pro','team')),
  plan_expires_at timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 2. ORGANIZACIONES (perfiles de empresa por usuario) ────────
--  Un usuario puede tener: Empresa A, Empresa B, Autónomo, etc.
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  -- Identidad
  name          text not null,              -- "Mi SL", "Consultoría X", "Autónomo"
  tipo_entidad  text default 'pyme'
                check (tipo_entidad in ('pyme','autonomo','gran_empresa','asociacion','fundacion','cooperativa','otro')),
  -- Clasificación (filtros de elegibilidad)
  ccaa          text default 'Madrid',
  municipio     text,
  cnae          text,                        -- código 4 dígitos
  cnae_desc     text,                        -- descripción textual
  iae           text,                        -- epígrafe IAE
  iae_desc      text,
  -- Tamaño
  empleados     int,
  facturacion   text,                        -- rango texto, ej "< 2M€"
  anio_constitucion int,
  -- Búsqueda IA
  actividad     text,                        -- descripción libre de la actividad
  keywords      text,                        -- palabras clave separadas por comas
  -- Metadatos
  color         text default '#1B2A4A',      -- color identificativo en la UI
  emoji         text default '🏢',
  is_default    boolean default false,       -- perfil activo por defecto
  is_archived   boolean default false,
  -- Preparado para colaboración futura (UI no implementada aún)
  -- Cuando se añada: otros usuarios podrán ser invitados a ver/editar
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Solo puede haber un perfil default por usuario
create unique index org_default_per_user
  on public.organizations(user_id)
  where is_default = true;

-- ── 3. COLABORADORES (preparado, UI pendiente) ─────────────────
--  Permite invitar a gestores/asesores a ver las convocatorias de una organización
create table public.org_collaborators (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  user_id       uuid references public.users(id) on delete cascade,
  invited_email text,                        -- si aún no tiene cuenta
  role          text default 'viewer'
                check (role in ('owner','editor','viewer')),
  invited_by    uuid references public.users(id),
  accepted_at   timestamptz,
  created_at    timestamptz default now(),
  unique(org_id, user_id)
);

-- ── 4. CONVOCATORIAS ───────────────────────────────────────────
create table public.grants (
  id            uuid primary key default gen_random_uuid(),
  -- Pertenencia
  user_id       uuid not null references public.users(id) on delete cascade,
  org_id        uuid references public.organizations(id) on delete set null,
  -- Datos de la convocatoria
  titulo        text not null,
  organismo     text,
  tipo          text default 'publica'
                check (tipo in ('publica','concurso','privada','europeo')),
  ambito        text default 'nacional'
                check (ambito in ('local','autonómico','nacional','europeo','internacional')),
  importe_max   text,                        -- importe máximo (texto flexible)
  importe_min   text,                        -- mínimo si hay rango
  cofinanciacion text,                       -- % que debe poner la empresa
  plazo_solicitud date,                      -- fecha límite de solicitud
  plazo_ejecucion date,                      -- fecha fin de ejecución del proyecto
  fecha_publicacion date,
  -- Contenido
  resumen       text,
  requisitos    text,                        -- uno por línea
  documentacion text,                        -- documentos requeridos, uno por línea
  url           text,                        -- URL oficial
  url_bases     text,                        -- URL bases reguladoras
  elegibilidad  text,
  -- Clasificación interna
  status        text default 'pendiente'
                check (status in ('pendiente','revisada','en_proceso','presentada','resuelta_positiva','resuelta_negativa','descartada')),
  prioridad     int default 2 check (prioridad in (1,2,3)),  -- 1=alta, 2=media, 3=baja
  tags          text[],                      -- etiquetas libres
  notas         text,
  -- Resultado (si se resolvió)
  resultado_importe text,
  resultado_fecha   date,
  resultado_notas   text,
  -- Origen
  source        text default 'manual'
                check (source in ('manual','ia_url','ia_texto','ia_search','bot','api')),
  auto_found    boolean default false,
  match_score   int,
  match_reason  text,
  -- Metadatos
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index grants_user_id_idx    on public.grants(user_id);
create index grants_org_id_idx     on public.grants(org_id);
create index grants_plazo_idx      on public.grants(plazo_solicitud);
create index grants_status_idx     on public.grants(status);
create index grants_tags_idx       on public.grants using gin(tags);

-- ── 5. HISTORIAL DE ESTADOS (preparado, UI pendiente) ──────────
create table public.grant_history (
  id            uuid primary key default gen_random_uuid(),
  grant_id      uuid not null references public.grants(id) on delete cascade,
  user_id       uuid references public.users(id),
  status_from   text,
  status_to     text,
  nota          text,
  created_at    timestamptz default now()
);

-- ── 6. DOCUMENTOS ADJUNTOS (preparado, UI pendiente) ───────────
--  Almacenados en Supabase Storage
create table public.grant_documents (
  id            uuid primary key default gen_random_uuid(),
  grant_id      uuid not null references public.grants(id) on delete cascade,
  user_id       uuid references public.users(id),
  nombre        text not null,
  tipo          text,                        -- 'memoria','presupuesto','nif','otro'
  storage_path  text not null,              -- ruta en Supabase Storage
  size_bytes    int,
  created_at    timestamptz default now()
);

-- ── 7. BÚSQUEDAS AUTÓNOMAS (historial) ─────────────────────────
create table public.search_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  org_id        uuid references public.organizations(id) on delete set null,
  -- Resultado
  results_count int default 0,
  added_count   int default 0,
  -- Origen
  trigger       text default 'manual'
                check (trigger in ('manual','cron_weekly','bot')),
  created_at    timestamptz default now()
);

-- ── 8. ALERTAS ENVIADAS (preparado, evita duplicados) ──────────
create table public.alerts_sent (
  id            uuid primary key default gen_random_uuid(),
  grant_id      uuid not null references public.grants(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  channel       text check (channel in ('telegram','email','push')),
  days_before   int,
  sent_at       timestamptz default now(),
  unique(grant_id, user_id, channel, days_before)   -- evita duplicados
);

-- ── 9. WEBHOOKS SALIENTES (preparado, UI pendiente) ────────────
create table public.webhooks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  url           text not null,
  secret        text,
  events        text[],                     -- ['grant.created','grant.status_changed']
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────
alter table public.users             enable row level security;
alter table public.organizations     enable row level security;
alter table public.org_collaborators enable row level security;
alter table public.grants            enable row level security;
alter table public.grant_history     enable row level security;
alter table public.grant_documents   enable row level security;
alter table public.search_runs       enable row level security;
alter table public.alerts_sent       enable row level security;
alter table public.webhooks          enable row level security;

-- Usuarios
create policy "users_own" on public.users
  for all using (auth.uid() = id);

-- Organizaciones: el usuario ve las suyas
create policy "orgs_own" on public.organizations
  for all using (auth.uid() = user_id);

-- Colaboradores: ves las orgs donde participas (preparado)
create policy "collab_own" on public.org_collaborators
  for all using (auth.uid() = user_id or auth.uid() = invited_by);

-- Grants: el usuario ve los suyos
create policy "grants_own" on public.grants
  for all using (auth.uid() = user_id);

-- Historial, documentos, alertas, búsquedas, webhooks
create policy "history_own"   on public.grant_history   for all using (auth.uid() = user_id);
create policy "docs_own"      on public.grant_documents for all using (auth.uid() = user_id);
create policy "runs_own"      on public.search_runs     for all using (auth.uid() = user_id);
create policy "alerts_own"    on public.alerts_sent     for all using (auth.uid() = user_id);
create policy "webhooks_own"  on public.webhooks        for all using (auth.uid() = user_id);

-- ── TRIGGERS ───────────────────────────────────────────────────

-- Crear usuario en public.users al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger users_updated_at         before update on public.users         for each row execute procedure public.set_updated_at();
create trigger orgs_updated_at          before update on public.organizations  for each row execute procedure public.set_updated_at();
create trigger grants_updated_at        before update on public.grants         for each row execute procedure public.set_updated_at();

-- Log automático de cambios de estado en grants
create or replace function public.log_grant_status_change()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into public.grant_history (grant_id, user_id, status_from, status_to)
    values (new.id, new.user_id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger grants_status_history
  after update on public.grants
  for each row execute procedure public.log_grant_status_change();

-- Asegurar que solo hay un org default por usuario
create or replace function public.ensure_single_default_org()
returns trigger language plpgsql as $$
begin
  if new.is_default = true then
    update public.organizations
    set is_default = false
    where user_id = new.user_id and id != new.id;
  end if;
  return new;
end;
$$;

create trigger orgs_single_default
  before insert or update on public.organizations
  for each row execute procedure public.ensure_single_default_org();
