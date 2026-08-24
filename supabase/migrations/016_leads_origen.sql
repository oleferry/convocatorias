-- ================================================================
--  Origen del lead: desde dónde pidió la tramitación el usuario
--  (formulario de la web, botón del email del digest, o botón del
--  bot de Telegram). Útil para saber qué canal convierte mejor.
-- ================================================================
alter table public.leads add column if not exists origen text default 'web';
