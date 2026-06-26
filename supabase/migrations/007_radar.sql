-- ================================================================
--  Radar: distinguir el origen de cada entrada del catálogo
--   'bdns'    = ingesta automática de la BDNS (pública)
--   'privada' = premios/becas/aceleradoras de empresas y fundaciones
--   'europea' = fondos y programas europeos
-- ================================================================

alter table public.convocatorias_publicas add column if not exists fuente text default 'bdns';
create index if not exists convpub_fuente_idx on public.convocatorias_publicas(fuente);
