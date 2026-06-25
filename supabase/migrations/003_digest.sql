-- ================================================================
--  Digest semanal — control de envíos (evita repetir convocatorias)
-- ================================================================

create table public.digest_sent (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  codigo_bdns text not null,
  channel     text,                 -- 'email' | 'telegram' | 'both'
  sent_at     timestamptz default now(),
  unique (user_id, codigo_bdns)     -- una convocatoria se envía una sola vez por usuario
);

create index digest_sent_user_idx on public.digest_sent(user_id);

-- RLS: el usuario puede leer sus propios envíos; la escritura la hace el
-- worker con service_role (salta RLS).
alter table public.digest_sent enable row level security;
create policy "digest_sent_own" on public.digest_sent
  for select to authenticated using (auth.uid() = user_id);
