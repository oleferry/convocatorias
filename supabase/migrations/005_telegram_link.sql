-- ================================================================
--  Vinculación segura de Telegram por enlace de un solo uso
--  El dashboard genera un token; el bot lo canjea en /start <token>.
-- ================================================================

create table public.telegram_link_tokens (
  token       text primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index telegram_link_tokens_user_idx on public.telegram_link_tokens(user_id);

-- RLS: cada usuario gestiona sus propios tokens. El bot usa service_role (salta RLS).
alter table public.telegram_link_tokens enable row level security;
create policy "tlt_own" on public.telegram_link_tokens
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
