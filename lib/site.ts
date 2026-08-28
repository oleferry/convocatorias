// Dónde vive el sitio, en un solo sitio.
//
// Esta constante estaba copiada a mano en siete ficheros: el layout, el
// sitemap, el robots y cuatro rutas de API. Mientras el valor coincida no pasa
// nada; el día que cambie el dominio, se cambia en cinco de los siete y el
// sitio empieza a decir dos cosas distintas sobre sí mismo.
//
// No es hipotético: en otro proyecto de esta cartera pasó exactamente eso —el
// dominio repetido en siete puntos, el cambio aplicado a medias, y el sitemap
// mandando a Google a URLs que redirigían—. Aquí se corta antes.
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.dameperrasperro.es'
