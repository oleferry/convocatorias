-- Eventos de producto para medir el embudo de activación.
--
-- Por qué en Supabase y no en Vercel Web Analytics: los eventos personalizados
-- de Vercel son de plan Pro en adelante (la cuenta está en Hobby), y aun
-- teniéndolos guardarían solo 1 mes y no se podrían cruzar con organizations,
-- grants ni leads. Aquí el evento queda atado al usuario real y es consultable
-- con SQL para siempre.
--
-- Solo registramos eventos que NO se deducen ya de una fila existente: el alta
-- está en auth.users, el perfil en organizations y la tramitación en leads.
-- Lo que falta es lo que no deja rastro: abrir una ficha y abrir el formulario
-- de tramitación sin llegar a enviarlo.

create table if not exists eventos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  nombre      text not null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists eventos_nombre_fecha_idx on eventos (nombre, created_at desc);
create index if not exists eventos_user_idx on eventos (user_id, created_at desc);

alter table eventos enable row level security;

-- Nadie lee desde el cliente: el panel de admin y la escritura van por
-- service_role, que se salta RLS. Sin políticas, la tabla queda cerrada.
