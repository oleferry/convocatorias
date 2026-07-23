-- ================================================================
--  Perfil activo del bot: qué empresa/organización recibe lo que el
--  usuario le pegue por Telegram (link, /sugerencias, /buscar) cuando
--  tiene más de un perfil. Se selecciona con /perfil <nombre> y se
--  recuerda hasta que se cambie.
-- ================================================================
alter table public.users add column if not exists bot_active_org_id uuid references public.organizations(id) on delete set null;
