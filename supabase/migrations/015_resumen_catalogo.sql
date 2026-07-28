-- ================================================================
--  Resumen periodístico + importe real por beneficiario, generados
--  UNA VEZ por convocatoria (no por usuario) al ingerirla del catálogo
--  BDNS. presupuestoTotal de la BDNS es el total de la partida para
--  toda la convocatoria, no lo que recibe cada solicitante — ese dato
--  real solo aparece en texto libre (anuncio), de ahí anuncio_texto.
-- ================================================================
alter table public.convocatorias_publicas add column if not exists anuncio_texto text;
alter table public.convocatorias_publicas add column if not exists resumen_periodista text;
alter table public.convocatorias_publicas add column if not exists importe_beneficiario text;
alter table public.convocatorias_publicas add column if not exists resumen_generado_at timestamptz;

-- Al guardar una sugerencia como grant, marca si el importe mostrado es el
-- presupuesto total de la convocatoria (sin importe_beneficiario disponible)
-- o el importe real por beneficiario — para poder avisar en la UI solo
-- cuando corresponda, sin perder ese dato al copiarlo a `grants`.
alter table public.grants add column if not exists importe_es_total boolean default false;
