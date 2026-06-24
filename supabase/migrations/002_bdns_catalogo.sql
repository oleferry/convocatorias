-- ================================================================
--  BDNS — Catálogo público de convocatorias (Fase 1: ingesta)
--  Fuente: https://www.infosubvenciones.es/bdnstrans/api
--  El catálogo es GLOBAL (no por usuario). El matching cruza este
--  catálogo contra los filtros de cada perfil (organizations).
-- ================================================================

-- ── Catálogo de convocatorias públicas (BDNS) ──────────────────
create table public.convocatorias_publicas (
  codigo_bdns       text primary key,           -- numeroConvocatoria / codigoBDNS
  id_bdns           bigint,
  titulo            text not null,              -- descripcion
  tipo_convocatoria text,
  nivel1            text,                        -- ESTATAL / AUTONOMICA / LOCAL
  ccaa_raw          text,                        -- nivel2 tal cual viene (mayúsculas)
  ccaa              text,                        -- normalizado a nombre estándar (lib/types CCAA)
  organo            text,                        -- nivel3
  presupuesto_total numeric,                     -- presupuestoTotal (importe)
  finalidad         text,                        -- descripcionFinalidad
  beneficiarios     text[],                      -- tiposBeneficiarios[].descripcion
  sectores          jsonb,                       -- [{codigo, descripcion}]
  regiones          text[],                      -- regiones[].descripcion (NUTS)
  bases_desc        text,                        -- descripcionBasesReguladoras
  bases_url         text,                        -- urlBasesReguladoras
  sede_url          text,                        -- sedeElectronica
  es_ayuda_estado   boolean default false,
  mrr               boolean default false,       -- financiado por fondos MRR/Next Gen
  abierto           boolean default false,
  fecha_inicio      date,                        -- fechaInicioSolicitud
  fecha_fin         date,                        -- fechaFinSolicitud (plazo de solicitud)
  fecha_recepcion   date,                        -- alta en BDNS (clave del sync incremental)
  raw               jsonb,                       -- respuesta completa por si hace falta
  synced_at         timestamptz default now(),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index convpub_fecha_fin_idx    on public.convocatorias_publicas(fecha_fin);
create index convpub_abierto_idx       on public.convocatorias_publicas(abierto);
create index convpub_ccaa_idx          on public.convocatorias_publicas(ccaa);
create index convpub_nivel1_idx        on public.convocatorias_publicas(nivel1);
create index convpub_recepcion_idx     on public.convocatorias_publicas(fecha_recepcion);
create index convpub_regiones_idx      on public.convocatorias_publicas using gin(regiones);

-- ── Estado de la sincronización incremental ────────────────────
create table public.bdns_sync_state (
  id                   int primary key default 1,
  last_fecha_recepcion date,        -- última fecha de recepción procesada
  last_run_at          timestamptz,
  last_count           int default 0,
  check (id = 1)                    -- fila única
);
insert into public.bdns_sync_state (id) values (1) on conflict do nothing;

-- ── Relación con las convocatorias guardadas por el usuario ─────
-- Cuando un usuario guarda una convocatoria del catálogo, se copia a
-- public.grants. Guardamos codigo_bdns para deduplicar y permitir el
-- origen 'bdns'.
alter table public.grants drop constraint if exists grants_source_check;
alter table public.grants add constraint grants_source_check
  check (source in ('manual','ia_url','ia_texto','ia_search','bot','api','bdns'));
alter table public.grants add column if not exists codigo_bdns text;
create index if not exists grants_codigo_bdns_idx on public.grants(user_id, codigo_bdns);

-- ── updated_at automático (reutiliza public.set_updated_at) ─────
create trigger convpub_updated_at before update on public.convocatorias_publicas
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────
-- Catálogo: cualquier usuario autenticado puede LEER. La escritura la
-- hace solo el worker con la service_role key (que salta RLS).
alter table public.convocatorias_publicas enable row level security;
create policy "convpub_read" on public.convocatorias_publicas
  for select to authenticated using (true);

-- Estado de sync: sin políticas → solo accesible con service_role.
alter table public.bdns_sync_state enable row level security;
