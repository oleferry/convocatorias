-- ================================================================
--  Provincia derivada para convocatorias LOCALES (ayuntamientos,
--  diputaciones). Se resuelve en la ingesta vía lib/geo.ts a partir
--  del municipio/organismo o del NUTS3 de 'regiones'. Idempotente.
-- ================================================================
alter table public.convocatorias_publicas add column if not exists provincia text;
create index if not exists convpub_provincia_idx on public.convocatorias_publicas(provincia);
