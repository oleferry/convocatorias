-- ================================================================
--  Dashboard de costes (admin): registro de uso de la API de Claude
--  (medido con exactitud por llamada) + costes fijos editables para
--  lo que no se puede medir por llamada (Railway, Vercel, Supabase...).
-- ================================================================
create table if not exists public.api_usage_log (
  id                    bigint generated always as identity primary key,
  created_at            timestamptz default now(),
  provider              text not null default 'anthropic',
  feature               text not null,              -- 'analyze','search_web','descubrir_privados','memoria'
  source                text not null default 'web' check (source in ('web','bot','cron')),
  model                 text,
  input_tokens          int default 0,
  output_tokens         int default 0,
  cache_creation_tokens int default 0,
  cache_read_tokens     int default 0,
  cost_usd              numeric(10,6) default 0,
  user_id               uuid references public.users(id) on delete set null,
  org_id                uuid references public.organizations(id) on delete set null
);
create index if not exists api_usage_log_created_idx on public.api_usage_log(created_at desc);
create index if not exists api_usage_log_feature_idx on public.api_usage_log(feature);

create table if not exists public.fixed_costs (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  amount_eur  numeric(10,2) not null,
  period      text not null default 'monthly' check (period in ('monthly','yearly','one_time')),
  notes       text,
  active      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Sin políticas para authenticated/anon: solo accesible con service_role
-- (el panel /admin/costes lo consulta vía API con la clave de servicio).
alter table public.api_usage_log enable row level security;
alter table public.fixed_costs enable row level security;

drop trigger if exists fixed_costs_updated_at on public.fixed_costs;
create trigger fixed_costs_updated_at before update on public.fixed_costs
  for each row execute procedure public.set_updated_at();

-- Costes fijos de partida (edítalos desde el panel /admin/costes)
insert into public.fixed_costs (name, amount_eur, period, notes) values
  ('Railway — bot de Telegram', 5, 'monthly', 'Ajusta al plan real de Railway'),
  ('Vercel', 0, 'monthly', 'Hobby/free tier mientras no se supere el límite'),
  ('Supabase', 0, 'monthly', 'Free tier mientras no se supere el límite'),
  ('Dominio dameperrasperro.es', 12, 'yearly', 'Renovación anual en Dondominio')
on conflict (name) do nothing;
