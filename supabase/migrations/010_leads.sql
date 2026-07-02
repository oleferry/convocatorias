-- ================================================================
--  Leads / monetización: cuando un usuario quiere ayuda con una
--  convocatoria, se registra un lead. Tú lo gestionas (derivar a una
--  gestoría) y registras la comisión. Idempotente.
-- ================================================================
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users(id) on delete set null,
  org_id         uuid references public.organizations(id) on delete set null,
  -- Convocatoria de interés (instantánea)
  codigo_bdns    text,
  grant_titulo   text not null,
  grant_url      text,
  fuente         text,
  -- Contacto que deja el interesado
  contacto_nombre    text,
  contacto_email     text,
  contacto_telefono  text,
  mensaje            text,
  -- Gestión / monetización
  estado         text default 'nuevo' check (estado in ('nuevo','contactado','derivado','ganado','perdido')),
  gestoria       text,
  importe_estimado   numeric,
  comision_pct       numeric,
  comision_estimada  numeric,
  notas_admin    text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists leads_estado_idx on public.leads(estado);
create index if not exists leads_created_idx on public.leads(created_at desc);

-- RLS: el usuario crea y ve SUS leads. La gestión (ver todos, actualizar) la
-- hace el admin vía service_role (salta RLS) desde /api/admin/leads.
alter table public.leads enable row level security;
drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
  for select to authenticated using (auth.uid() = user_id);

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute procedure public.set_updated_at();
