# DamePerrasPerro — contexto completo del proyecto

> **Para qué es este documento.** Para que una sesión de código nueva (en la nube o en
> otra máquina) pueda continuar el trabajo sin tener delante el historial de las
> conversaciones anteriores. Cuenta qué es el producto, en qué estado real está, cómo
> está construido, **por qué** está construido así, y qué trampas ya pisamos para que no
> se vuelvan a pisar.
>
> Escrito el **5 de octubre de 2026**, sobre el commit `60c78ee`. Los números que trae
> están medidos ese día contra producción, no estimados. Si lees esto mucho después,
> compruébalos otra vez antes de fiarte: hay consultas concretas al final de cada sección.

---

## 1. El producto

**Una frase:** *"El perro que encuentra las perras."* Rastrea subvenciones, ayudas y
convocatorias públicas y privadas, y le dice a cada empresa cuáles puede pedir **ella**.

**El problema real que resuelve.** En España se publican ~45.500 convocatorias al año en
la BDNS (Base de Datos Nacional de Subvenciones). Una pyme o un autónomo no tiene ni
tiempo ni vocabulario para encontrar las suyas: los títulos oficiales son ilegibles
("Orden de 24 de junio de 2026, de la Consejería de Industria, Universidades, Empleo y
Comercio, por la que se convocan subvenciones destinadas a..."), y el 86% de lo que se
publica no le sirve a nadie en concreto porque ya está cerrado o es de concesión directa.

**Cómo monetiza** (previsto, aún no implementado del todo):
1. **Leads a gestorías.** El usuario pulsa "quiero que me la tramiten", se crea un lead y
   una gestoría adherida (ya hay convenio) se lo tramita a cambio de comisión. **Esto ya
   funciona y es la única cosa que ha convertido de verdad.**
2. **Plan Pro a 9,95 €/mes.** Resúmenes y memorias técnicas generadas con IA. La pasarela
   de pago **no está montada**; el campo `users.plan` ya existe y `costs.ts` ya respeta
   `plan = 'pro' | 'team'`.

**Marca.** Tono directo y campechano, nada corporativo. El perro es el protagonista.
Paleta y tipografías en `lib/theme.ts` (`T`, `FONT`, `FONT_DISPLAY`) — **no hay Tailwind,
todo es estilos en línea** con esos tokens.

---

## 2. Estado real a 5 de octubre de 2026

Esta es la parte que conviene leer antes de proponer mejoras.

### El catálogo está sano

| | |
|---|---|
| Filas totales en `convocatorias_publicas` | 2.981 |
| Abiertas ahora mismo | **925** |
| Abiertas con comunidad asignada | 741 |
| Abiertas sin resumen periodístico todavía | 304 |

### El embudo de usuarios no

| Paso | Personas |
|---|---|
| Registradas | 16 |
| Confirman el email | 11 |
| Crean perfil de empresa | **6** |
| Han pedido tramitación (leads) | **1** |

**Diagnóstico honesto: el cuello de botella no es el producto, es la distribución.** El
motor de matching está afinado, el catálogo es grande, las páginas públicas funcionan — y
entran 16 personas. Cualquier trabajo que no sea captación tiene un techo bajísimo ahora
mismo. El único lead que existe (27-08-2026) llegó por el **CTA del email**, no por la
web: ese camino está demostrado y es por donde conviene empujar.

### Coste de la API de Claude, últimos 30 días

| Función | Llamadas | Coste |
|---|---|---|
| `resumen_catalogo` | 1.226 | $1,55 |
| `search_web` | 2 | $0,04 |
| `analyze` | 1 | $0,01 |
| `descubrir_privados` | 1 | $0,004 |
| **Total** | | **~$1,61/mes** |

Bajó de ~$7,70/mes. El trabajo de contención está hecho (sección 9).

**Comprobar estos números otra vez:**
```sql
select count(*) filas,
       count(*) filter (where fecha_fin >= current_date or fecha_fin is null) abiertas,
       count(*) filter (where (fecha_fin >= current_date or fecha_fin is null)
                          and resumen_periodista is null) sin_resumen
from convocatorias_publicas;

select (select count(*) from auth.users) registrados,
       (select count(*) from auth.users where email_confirmed_at is not null) confirmados,
       (select count(distinct user_id) from organizations) con_perfil,
       (select count(*) from leads) leads;
```

---

## 3. Stack

| Pieza | Qué | Dónde corre |
|---|---|---|
| Web | Next.js 14.2.3, App Router, TypeScript | Vercel (plan **Hobby**, equipo `gafasvan`) |
| Datos y auth | Supabase (Postgres + Auth + RLS) | Supabase cloud |
| IA | API de Claude vía `@anthropic-ai/sdk` | — |
| Bot | Node CommonJS, Telegram Bot API, `node-cron` | Railway (`node index.js`) |
| Correo | Resend (transaccional y SMTP de Supabase Auth) | — |
| Analítica | Vercel Web Analytics (solo visitas) + tabla propia `eventos` | — |
| Dominio | `www.dameperrasperro.es` | DonDominio |

**Sin Tailwind, sin librería de componentes, sin ORM.** Estilos en línea con `lib/theme.ts`;
consultas con el cliente de `supabase-js` directamente.

**Repo:** `github.com/oleferry/convocatorias`. Rama de trabajo: `main`. El código vive en
el subdirectorio `convocatorias/` del checkout.

---

## 4. Mapa del repo

### Páginas

| Ruta | Qué es | Acceso |
|---|---|---|
| `/` | Landing (`app/Landing.tsx`) | pública |
| `/ayudas` | Índice de convocatorias abiertas | pública, SEO |
| `/ayudas/[ccaa]` | Por comunidad (17 + Ceuta/Melilla) | pública, SEO |
| `/ayudas/[ccaa]/[sector]` | Por comunidad y sector | pública, SEO |
| `/ayuda/[codigo]` | Ficha individual de una convocatoria | pública, SEO |
| `/aviso-legal`, `/privacidad`, `/condiciones` | Legales | públicas |
| `/auth`, `/auth/reset-password` | Login, registro, recuperar contraseña | pública |
| `/dashboard` | Panel del usuario (1.467 líneas, el fichero gordo) | con sesión |
| `/organizations` | Perfiles de empresa (CNAE/IAE/CCAA/provincia) | con sesión |
| `/admin/leads` | Leads y su estado | solo admin |
| `/admin/costs` | Coste real de la API | solo admin |
| `/admin/embudo` | Embudo de activación | solo admin |

Admin = email en `ADMIN_EMAILS` (ver `lib/admin.ts`). **Ojo:** en componentes de cliente
esa variable no llega al bundle, así que ahí manda el *fallback* escrito en el propio
fichero.

### API

**Crons** (`/api/cron/*`, protegidos con `CRON_SECRET` por `Bearer` o `?key=`):
- `ingest` — ingesta diaria de la BDNS + radar + resúmenes + (día 1) descubrimiento IA
- `bdns-repaso` — repaso diario de lo que la ingesta ya dejó atrás
- `bdns-backfill` — barrido histórico a mano, por ventanas de fecha con `offset`
- `digest` — envío semanal por email y Telegram
- `resumen-catalogo` — empujón manual de resúmenes
- `radar`, `descubrir`, `recordatorio-perfil`

**Del producto:** `grants/analyze`, `memoria`, `resumen`, `search`, `suggestions`,
`leads`, `solicitud` (lead sin cuenta, desde la ficha pública), `tramitar` (enlace
firmado de un clic desde el email), `contacto`, `telegram/link`, `track`.

### `lib/` — qué hace cada cosa

| Fichero | Para qué |
|---|---|
| **`matching.ts`** | **El corazón del producto.** Filtro por capas. Léelo antes de tocar nada de matching. |
| `bdns.ts` | Cliente de la BDNS + normalización del detalle |
| `bdns-sync.ts` | Ingesta: busca, pide detalle, normaliza, hace upsert, mueve el puntero |
| `ai.ts` | Todas las llamadas a Claude (`callAI`), modelos y prompts |
| `costs.ts` | Precio real por llamada + topes de gasto |
| `resumen-catalogo.ts` | Resúmenes periodísticos pendientes (separado de la ingesta a propósito) |
| `public-grants.ts` | Consultas de las páginas públicas |
| `descubrir.ts` | Descubrimiento de ayudas privadas con búsqueda web |
| `radar-sync.ts`, `radar-data.ts`, `eu-funding.ts` | Radar de privadas y fondos europeos |
| `geo.ts` | CCAA, provincias, municipios (catálogo INE) y *slugs* |
| `sectores.ts` | Sectores públicos ↔ letras CNAE |
| `tramitacion.ts` | Enlaces firmados con HMAC + email de documentación |
| `leads-notify.ts` | Aviso por correo de lead nuevo |
| `legal.ts` | Datos del titular. **Rompe el build de producción si faltan** (a propósito) |
| `eventos.ts` | `track()` de cliente + lista blanca de eventos |
| `campo-trampa.ts` | Honeypot antispam del formulario sin cuenta |
| `json-ld.tsx` | Datos estructurados, escapados en un solo sitio |
| `site.ts` | La URL del sitio, en un solo sitio |
| `theme.ts` | Tokens de diseño |
| `admin.ts` | Quién es admin |

### `bot/`

`index.js` es un espejo en CommonJS de parte de `lib/`. **`bot/matching.js` tiene que
mantenerse sincronizado a mano con `lib/matching.ts`.** Es la deuda técnica más peligrosa
del repo: si cambias una capa del filtro en TypeScript y te olvidas del bot, el bot
empieza a mandar ayudas que la web ya descarta, y nadie se da cuenta hasta que un usuario
se queja.

Comandos: `/start`, `/perfil` (elige qué perfil recibe los enlaces que le pegas), y pegarle
una URL para que la analice y cree la ficha.

### Migraciones

19, de `001_schema.sql` a `019_eventos.sql`, en `supabase/migrations/`. Se aplican con
`npx supabase db push`.

---

## 5. El motor de matching — la parte delicada

Está en `lib/matching.ts`. Lo que hace es decidir, para un par (convocatoria, perfil de
empresa), si esa empresa puede pedir esa ayuda. **Todo el valor del producto está aquí:**
una ayuda que no te corresponde no es "ruido", es una pérdida de confianza inmediata.

Llegó a su forma actual después de unas ocho rondas, cada una provocada por un falso
positivo real que el usuario vio en su Telegram. La estructura es: **primero filtros duros
que descartan, después señales que puntúan.**

### Orden de los filtros duros en `matchGrant()`

1. **Concesión directa** → fuera. Ya está adjudicada por nombre a una entidad concreta;
   nadie más puede pedirla.
2. **Plazo cerrado** → fuera.
3. **CAPA 1 — ubicación en texto libre** (`lugaresAjenos`). Si el título dice "en la
   Comunidad de Murcia" y la empresa está en Valladolid, fuera. Esto ataca las ayudas que
   no traen la región en un campo, sino escrita en la letra pequeña.
4. **CAPA 2b — forma jurídica reservada** (`formaIncompatible`). Si la convocatoria es
   solo para cooperativas o empresas de inserción y tú eres una S.L., fuera.
5. **CAPA 3 — parentesco de sector** (`compartenSector` sobre `cnaes_objetivo`). Para lo
   descubierto con IA, que viene con el sector marcado explícitamente.
6. **Comunidad / provincia.** Si es estatal pasa; si es autonómica, tiene que coincidir.
7. **Beneficiario** (`beneficiarioEncaja`): persona física vs jurídica, pyme, etc.
8. **Señales** que suman puntuación.

### La compuerta final

```ts
const señalSuficiente = sectorMatch || kwHits >= 2
```

Es decir: **o coincide el sector, o hay al menos dos palabras clave distintas.** Una sola
palabra clave nunca basta, porque las colisiones por homonimia son brutales en este
dominio (ver sección 13).

### Resultado medido

El ruido bajó de ~113 coincidencias a ~32 entre 8 perfiles de prueba, **sin perder las
legítimas**: el arquitecto conserva sus 14 premios de arquitectura, la panadería sus
premios de panadería, y la empresa agrícola su AgroBank.

### Si vas a tocar esto

- Haz la prueba contra **datos de producción reales**, con perfiles reales, antes y después.
- Comprueba la **simetría**: que una cooperativa siga recibiendo ayudas a cooperativas (eso
  se rompió una vez, sección 13).
- **Replica el cambio en `bot/matching.js`.**

---

## 6. Datos y la BDNS

### La fuente

API REST en `https://www.infosubvenciones.es/bdnstrans/api`. Sin clave. Dos llamadas:
- `/convocatorias/busqueda` — listado paginado por fecha de recepción
- `/convocatorias?numConv=N` — detalle de una

**Volumen:** 250-320 convocatorias nuevas al día en toda España (medido en
septiembre-octubre de 2026; en verano eran ~124). Una llamada de detalle tarda ~0,3 s y
**en paralelo la BDNS devuelve 429**, así que hay que ir de una en una.

**Rendimiento útil: ~14%.** El resto está ya cerrado o es concesión directa.

### Trampas del vocabulario de la BDNS

- **`nivel1` vale `"ESTADO"`, no `"ESTATAL"`.** Todo el código comparaba con `"ESTATAL"`,
  así que durante meses **no entró ni una sola ayuda estatal**. Se normaliza al ingerir
  (`esEstatal` / `normalizeNivel1` en `bdns.ts`). Si ves un filtro que compara `nivel1`
  a mano, revísalo.
- **`presupuestoTotal` NO es lo que puede pedir el solicitante**, es el presupuesto entero
  de la convocatoria. Poner "importe máximo 10.000.000 €" en la tarjeta de un autónomo es
  ridículo y destruye la credibilidad. De ahí vienen `importe_beneficiario` y el campo
  `importe_es_total`.
- `nivel2` en las LOCAL es el municipio o "Diputación de X", no una comunidad: hay que
  resolverlo con el catálogo INE (`resolveLocalGeo`).
- Hay convocatorias con **el plazo escrito en texto** en vez de en el campo de fecha. Se
  rescatan (PR #8); antes se tiraban.

### El puntero de la ingesta

Tabla `bdns_sync_state` (fila `id = 1`), campo `last_fecha_recepcion`. La ingesta avanza
**solo hacia delante** desde ahí.

**Consecuencia importante:** si amplías lo que la ingesta considera (por ejemplo abrirla a
más comunidades, como pasó en septiembre), **las convocatorias que ya quedaron atrás no
vuelven solas**. Hay que lanzar `bdns-backfill` por ventanas de fecha.

A 5-10-2026 el puntero está en **2026-09-22**: sigue recuperando el atasco que arregló el
PR #9, a ~1.100 detalles por noche.

```sql
select last_fecha_recepcion, last_run_at, last_count from bdns_sync_state where id = 1;
```

---

## 7. Crons y automatismos

`vercel.json`:

| Ruta | Cuándo |
|---|---|
| `/api/cron/ingest` | 06:00 diario |
| `/api/cron/bdns-repaso` | 04:30 diario |
| `/api/cron/digest` | 07:00 los lunes |

**Los tres corren. Verificado el 05-10-2026.** Se dudó de esto porque el plan Hobby
documenta un límite de 2 crons; el dato dice que los tres están activos.

Los registros de Vercel no sirven para comprobarlo: en Hobby duran una hora. La forma de
verificarlo es la huella en base de datos, porque cada cron escribe a una hora distinta:

```sql
-- Filas nuevas por hora. Las de las ~04h solo pueden venir de bdns-repaso;
-- las de las ~06h, de ingest.
select created_at::date dia, extract(hour from created_at)::int hora, count(*) n
from convocatorias_publicas
where created_at >= current_date - 7
group by 1, 2 order by 1 desc, 2;
```

El 05-10 salieron 39 filas a las 04:49 y 109 a las 06h; el 03-10, 41 a las 04:40 y 6 a
las 06h. Dos crons distintos la misma noche.

> **Matiz, para no leer mal esta consulta:** una noche sin filas a las 04h **no** prueba
> que el repaso no corriera. Recupera lo que la ingesta dejó atrás, y hay noches en que
> legítimamente no encuentra nada: entonces no crea filas y no deja huella. La consulta
> demuestra que corre, no que corra todos los días. Si algún día hace falta esa certeza,
> hay que hacer que el repaso escriba su propia ejecución en una tabla aunque guarde cero
> — hoy no lo hace.

### El reparto de tiempo dentro de `ingest`

La función tiene 300 s de límite y hace tres cosas, con topes de tiempo explícitos:
1. **Ingesta BDNS** hasta `inicio + 200 s`
2. **Radar** (barato)
3. **Resúmenes** hasta `inicio + 270 s`
4. **Descubrimiento IA** solo el día 1 del mes

Los 30 s que quedan son para responder. Si te la comes entera, **la función muere y el
puntero no se guarda**, así que la noche siguiente repite el mismo trabajo. De ahí los
topes por tiempo y no solo por número.

---

## 8. Medición: el embudo

Los eventos de producto **no** están en Vercel. Motivo: los *custom events* de Vercel Web
Analytics son de plan Pro en adelante y la cuenta está en Hobby, así que los `track()`
habrían sido llamadas mudas. Además Hobby solo guarda un mes.

Están en la tabla **`eventos`** de Supabase, que encima es mejor para esto: el evento
queda atado al usuario real y se puede cruzar con `organizations`, `grants` y `leads`.

**Solo se registra lo que no deja rastro en ninguna tabla**, porque tres de los cuatro
pasos del embudo ya se deducen de los datos (`auth.users`, `organizations`, `leads`) — y
así el embudo es retroactivo en vez de empezar a contar desde cero:

- `ficha_abierta`
- `tramitar_abierto`
- `tramitar_enviado` — el hueco entre este y el anterior dice si el formulario estorba

Lista blanca en `lib/eventos.ts`; la ruta `/api/track` valida contra ella, usa
`sendBeacon`, y **nunca devuelve error**: medir no puede romper la app.

Se ve en **`/admin/embudo`**.

---

## 9. IA y control de costes

### Modelos

```ts
// lib/ai.ts
export const MODELO         = 'claude-haiku-4-5'   // todo
export const MODELO_CALIDAD = 'claude-sonnet-4-6'  // solo `memoria`
```

**Por qué Haiku para casi todo:** las tareas son acotadas —extraer datos de una página,
resumir en tres frases, buscar programas de un sector—, no razonamiento complejo. Un
tercio del precio.

**Por qué `memoria` es la excepción:** es la redacción larga y de criterio, es el documento
que el cliente paga y presenta a la administración, y **no lleva búsqueda web**, así que
ya era barata (~3.000 tokens de salida). Bajarla de modelo no ahorraba casi nada y
arriesgaba justo la calidad del producto de pago.

**Consecuencia técnica de usar Haiku:** el filtrado dinámico de la búsqueda web
(`web_search_20260318`) exige modelo 4.6 o superior, así que con Haiku se usa
`web_search_20250305`. No se pierde nada relevante: el freno de verdad es `max_uses`.

### Los topes, en `lib/costs.ts`

```
DAILY_GLOBAL_CAP_EUR = 1          // tope global diario
DISCOVERY_SHARE      = 0.4        // descubrimiento: como mucho el 40%
MANTENIMIENTO_CAP    = 50%        // resúmenes de catálogo: reservado y no lo frena el global
PER_USER_DAILY_LIMITS = { memoria: 20, resumen: 20, analyze: 15, search_web: 5 }
```

Los usuarios Pro se saltan el tope global. Los resúmenes de catálogo tienen tope propio
**y no los frena el global**, para que un trabajo caro no pueda dejar el catálogo
desactualizado: cuestan ~0,0014 € cada uno, 80 veces menos que una llamada de
descubrimiento.

`PRICING` conserva Sonnet para que las llamadas históricas se sigan calculando bien en
`/admin/costs`.

### Lección aprendida sobre el gasto

El `descubrir_privados` llegó a ser el **82%** del gasto: $0,45 por llamada, porque la
búsqueda web metía ~151.000 tokens de **entrada**. Bajarlo de semanal a mensual y a Haiku
lo dejó en céntimos.

**El error que yo cometí analizando esto:** dije que bajar `max_tokens` de 4000 a 1500
recortaría el coste de 1,17 € a 0,30 €. Falso — el 93% del coste eran tokens de **entrada**
de la búsqueda web, y el cambio ahorró $0,03 de $0,49. **Mira el reparto entrada/salida en
`api_usage_log` antes de proponer un ahorro.**

---

## 10. Legal

`lib/legal.ts` tiene los datos del titular en un solo sitio, y los leen el aviso legal, la
privacidad, las condiciones y los datos estructurados.

La LSSI (art. 10) obliga a identificar al titular; el RGPD (art. 13) a decirlo al recoger
datos. Hasta octubre de 2026 la web **no lo decía en ningún sitio**.

**`comprobarTitular()` para el build de producción si falta razón social, NIF o domicilio.**
Es a propósito: una página legal sin titular aparenta cumplir, y eso es peor que no
tenerla. Las vistas previas sí compilan, con el hueco marcado.

Titular actual: persona física, confirmada por el negocio el 02-10-2026.

---

## 11. Secretos y cómo arrancar

### La regla

**Las claves no se suben a GitHub. Nunca, de ninguna forma.** `.gitignore` ya cubre `.env`
y `.env*.local`, y el histórico completo del repo está limpio: lo único que se ha
commiteado nunca es `.env.local.example`, que lleva valores de relleno.

Que un fichero esté en `.gitignore` significa justo que **no** se sube. No existe forma
"segura" de subir claves a GitHub: si se sube, está filtrada, aunque el repo sea privado
y aunque luego se borre el commit.

### Dónde viven de verdad

| Entorno | Dónde están las claves |
|---|---|
| Producción web | Variables de entorno del proyecto en **Vercel** |
| Bot | Variables de entorno del servicio en **Railway** |
| Tu máquina | `.env.local` (ignorado por git) |

**A 5-10-2026 el `.env.local` local está prácticamente vacío** (solo `NEXT_PUBLIC_APP_URL`
y `DIGEST_FROM`). Las de verdad solo existen en Vercel y Railway.

### Arrancar en una máquina o sesión nueva

```bash
npm install
npx vercel link          # vincula con el proyecto
npx vercel env pull .env.local   # trae las variables desde Vercel
npm run dev
```

Si no puedes usar `vercel env pull`, cópialas a mano del panel de Vercel. La lista de
cuáles hacen falta está en `.env.local.example`.

**Dato importante:** `npm run build` **falla al prerenderizar las 325 páginas públicas si
falta `NEXT_PUBLIC_SUPABASE_URL`** (`Error: supabaseUrl is required`). `npx tsc --noEmit`
sí funciona sin claves. Si ves ese error, no es un bug: te faltan las variables.

### Pendiente de seguridad

> ⚠️ **Rotar `CRON_SECRET`.** Circuló en texto plano en varias conversaciones de trabajo.
> Es la llave que dispara cualquier `/api/cron/*`, **incluido el digest que manda correos a
> todos los registrados**. Se cambia en Vercel y no hace falta tocar código.

---

## 12. Cómo se trabaja en este proyecto

Esto no es decoración: es la razón por la que varios fallos graves se cogieron a tiempo.

1. **Verificar en producción, no solo compilar.** `✓ Compiled successfully` no prueba nada
   de lo que importa aquí. Después de desplegar, se llama al endpoint de verdad, se mira la
   página de verdad, y se comprueba el dato de verdad en la base.
2. **Medir antes de proponer un ahorro o un cambio de volumen.** Dos veces ha pasado que la
   intuición decía una cosa y los datos otra.
3. **Un fallo encontrado se cuenta tal cual**, incluso si lo ha provocado un cambio propio.
4. **Commits en español**, descriptivos, explicando el *por qué* y no solo el *qué*. Los
   comentarios del código también: este repo documenta decisiones, no sintaxis.
5. **`git fetch` + `git pull --rebase` al empezar.** Se trabaja desde varios equipos y entran
   PRs por fuera. Si el pull da conflictos, se para y se consulta.
6. **Nunca `node_modules`, `.env`, `dist` ni `build` en el repo.**

---

## 13. Trampas ya pisadas

Cada una de estas costó un rato y se encontró por un falso positivo real. **Leer antes de
tocar matching, ingesta o resúmenes.**

### Matching

- **Códigos IAE de profesionales mal clasificados.** `P411A` (arquitecto) → se le extraían
  los dígitos "411" → primer dígito 4 → letra C (industria manufacturera), que colisionaba
  con una panadería. Arreglado con el mapa explícito `IAE_ESPECIALES`.
- **Colisiones por homonimia.** "5ª **edición**" del premio contra "**Edición** de
  periódicos"; "otros **campos**" contra "Tierra de **Campos**". De ahí el *whole-word
  matching* con regex, el mínimo de 2 palabras clave y los `STOP_TOKENS` muy ampliados.
- **Asimetría en cooperativas.** Una cooperativa no podía recibir ayudas a cooperativas,
  porque la BDNS las etiqueta "PYME Y PERSONAS FÍSICAS...". Se descubrió con una prueba de
  control, no con un informe de usuario. **Prueba siempre los dos sentidos.**
- **Sector copiado del perfil que descubrió la ayuda.** `descubrir.ts` estampaba los CNAE de
  la empresa que había disparado la búsqueda. La división 47 (todo el comercio al por menor)
  hacía que premios de panadería llegaran a una óptica. Se quitó el estampado y se sustituyó
  por `cnaes_objetivo`, que es el sector real al que va dirigida.

### Ingesta

- **`"ESTADO"` vs `"ESTATAL"`** (sección 6). Meses sin ninguna ayuda estatal.
- **El barrido no avanzaba:** procesaba siempre los primeros 120 candidatos, que en orden
  cronológico ascendente son los más antiguos y por tanto ya cerrados. Se arregló con
  paginación por `offset`.
- **La ingesta solo traía ayudas de las comunidades donde ya había usuarios.** `ccaaSet`
  salía de `organizations`. Como todos los usuarios eran de Castilla y León, el catálogo
  tenía 153 estatales, 40 de Castilla y León y **cero del resto**. Efecto: las 16 páginas
  públicas de las otras comunidades mostraban las **mismas 198** convocatorias, o sea 16
  duplicados que Google descarta. Y era circular: sin ayudas de Aragón no llegan usuarios
  de Aragón, y sin usuarios de Aragón no se ingerían ayudas de Aragón. Quitado el filtro.

### Páginas públicas

- **`.limit()` aplicado antes de filtrar.** `fetchOpenGrantsForCcaa` ordenaba por `fecha_fin`
  ascendente y cortaba a 300 **antes** de descartar las cerradas en JS: gastaba el cupo
  entero en convocatorias caducadas y las tiraba después. Con 377 filas no se notaba; con
  2.336 Cataluña mostraba 112 de 453. **Filtra el plazo en la consulta, no después.** El
  mismo problema afectaba al recuento de `/ayudas` por la vía del `limit(2000)` sobre una
  tabla más grande.
- **Páginas de sector que eran copias de la de su comunidad** (PR #4).

### Presentación

- **Regiones inventadas en los resúmenes.** El prompt no recibía la comunidad, y tres
  convocatorias de Castilla y León se describieron como "Región de Murcia". Ahora se le pasa
  el ámbito real y se le prohíbe explícitamente inventar lugares.
- **Títulos del BOE como título de tarjeta.** Ilegibles. De ahí `tituloCorto()` y el resumen
  periodístico.

### Infraestructura

- **El digest de Telegram se perdía en silencio.** Mensaje de 11.985 caracteres contra un
  límite de 4.096: Telegram rechazaba el envío entero. Se trocea en `TG_LIMITE = 3800`.
- **SMTP de Supabase Auth mal configurado:** apuntaba a `ftp.dameperrasperro.es` (el FTP de
  DonDominio). Resultado: 504 y **ninguna cuenta se creaba**. Tres de los registros sin
  confirmar son de un mismo día por esto. Ahora `smtp.resend.com:465`, usuario `resend`.
- **Error mío con `supabase migration repair`:** marqué como aplicadas las migraciones
  001-014 incluyendo la 014, que nunca se había ejecutado. `users.bot_active_org_id` no
  existía y `/perfil` del bot falló en silencio durante semanas. **No marques como aplicada
  una migración sin comprobar que sus objetos existen.**
- **Faltaban directivas de caché** en varias rutas de cron: `/api/cron/resumen-catalogo`
  devolvía un "restantes" pegado de una ejecución anterior. Todas las rutas de cron llevan
  ahora `dynamic = 'force-dynamic'` y `fetchCache = 'force-no-store'`.

---

## 14. Qué sigue

Ordenado por lo que de verdad mueve la aguja, no por lo que es más entretenido de programar.

### 1. Captación (el cuello de botella real)

16 registrados y 1 lead. Todo lo demás tiene un techo bajísimo mientras esto no se mueva.

- Las 325 páginas públicas **acaban de dejar de ser duplicados** (finales de septiembre).
  Google necesita semanas para volver a rastrearlas. **Hay que vigilar si entra tráfico
  orgánico de verdad** antes de dar el canal por bueno.
- El CTA del email es el único que ha convertido. Merece más peso.
- Dar de alta más gestorías: ya hay una con convenio.

### 2. Seguridad

- **Rotar `CRON_SECRET`** (sección 11).

### 3. Verificaciones abiertas

- Los **304 resúmenes pendientes** se van solos a 40 por noche, unos 8 días. Si se atascan,
  mirar si el tope de mantenimiento está cortando.
- Que el repaso diario corra **todas** las noches y no solo algunas (sección 7): hoy solo
  se puede demostrar que corre, no la regularidad. Requiere que deje registro propio.

**Nota sobre `codigo_bdns`:** los códigos no numéricos son normales, no un error. Las
fuentes que no son la BDNS usan prefijo: `priv-`, `eu-`, `radar-`. Si ves en los registros
una ruta como `/ayuda/www.denia.es` devolviendo 404, es un rastreador pidiendo una URL
inventada, no una fila corrupta — se comprobó el 05-10-2026 y en la tabla solo hay códigos
numéricos y esos tres prefijos.

### 4. Producto, cuando haya usuarios que lo justifiquen

- **Pasarela de pago del plan Pro a 9,95 €/mes.** `users.plan` y los topes por plan ya están
  preparados; falta Stripe.
- Feed `.ics` con los plazos.
- Blog para posicionar.
- **Unificar `bot/matching.js` con `lib/matching.ts`** para que deje de ser un espejo a mano.
  Es la deuda técnica con más probabilidad de morder.

---

## 15. Dónde mirar cada cosa

| Pregunta | Dónde |
|---|---|
| ¿Por qué le llegó esta ayuda a este usuario? | `lib/matching.ts`, y el espejo `bot/matching.js` |
| ¿Cuánto estamos gastando en IA? | `/admin/costs` y la tabla `api_usage_log` |
| ¿La gente usa esto? | `/admin/embudo` y la tabla `eventos` |
| ¿Entran leads? | `/admin/leads` y la tabla `leads` |
| ¿Va la ingesta al día? | `bdns_sync_state.last_fecha_recepcion` |
| ¿Qué variables de entorno hacen falta? | `.env.local.example` |
| ¿Qué se decidió y por qué? | Los comentarios del código y `git log` (mensajes largos, en español) |
