-- ================================================================
--  Resumen IA de la convocatoria (bases): fechas, importe, quién puede
--  solicitarlo, condiciones, para qué es. Distinto de la "memoria"
--  (que es el borrador para PRESENTAR la solicitud). Se genera solo a
--  petición del usuario (botón manual) y se cachea en el propio grant.
-- ================================================================
alter table public.grants add column if not exists resumen_ia text;
alter table public.grants add column if not exists resumen_ia_updated_at timestamptz;
