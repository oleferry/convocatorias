-- ================================================================
--  Catálogos: CNAE múltiple + provincia
--  Los catálogos (CNAE 629 clases, 52 provincias, 8132 municipios) se
--  sirven como JSON estático desde /public/data; aquí solo guardamos
--  la selección del usuario.
-- ================================================================

alter table public.organizations add column if not exists cnaes text[];
alter table public.organizations add column if not exists provincia text;
