-- ================================================================
--  Recordatorio "termina tu perfil": quien se registra pero nunca crea
--  un perfil de empresa no puede recibir NADA (no hay con qué cruzar
--  las convocatorias). Guardamos cuándo se le avisó para no insistir.
-- ================================================================
alter table public.users add column if not exists perfil_recordatorio_at timestamptz;
