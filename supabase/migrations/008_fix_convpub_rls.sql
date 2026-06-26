-- ================================================================
--  FIX: el catálogo no se leía desde la app (RLS bloqueaba la lectura).
--  Re-crea la política de lectura del catálogo como pública (datos
--  abiertos de subvenciones). Idempotente: se puede ejecutar varias veces.
-- ================================================================
alter table public.convocatorias_publicas enable row level security;
drop policy if exists "convpub_read" on public.convocatorias_publicas;
create policy "convpub_read" on public.convocatorias_publicas
  for select using (true);
