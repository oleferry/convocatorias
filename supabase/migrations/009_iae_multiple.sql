-- ================================================================
--  IAE múltiple en el perfil (igual que cnaes[]). El catálogo IAE se
--  sirve como JSON estático desde /public/data/iae.json; aquí solo
--  guardamos la selección del usuario. Idempotente.
-- ================================================================
alter table public.organizations add column if not exists iaes text[];
