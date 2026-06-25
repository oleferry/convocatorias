-- ================================================================
--  Memoria v1 — borrador de memoria generado con IA por convocatoria
-- ================================================================

alter table public.grants add column if not exists memoria text;
alter table public.grants add column if not exists memoria_updated_at timestamptz;
