-- ================================================================
--  Sector objetivo de los programas descubiertos con IA.
--  El radar de privados busca programas PARA un perfil concreto. Sin
--  guardar para quién eran, esos premios acababan llegando a cualquiera
--  que compartiera una palabra suelta (unos premios de arquitectura a un
--  periódico digital, por la palabra "edición"). Guardamos los CNAE del
--  perfil que disparó la búsqueda para exigir parentesco real de sector.
-- ================================================================
alter table public.convocatorias_publicas add column if not exists cnaes_objetivo text[];
