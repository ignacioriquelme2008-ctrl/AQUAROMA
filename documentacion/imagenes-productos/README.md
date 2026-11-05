# Serie uniforme de productos AQUAROMA

Recreada con la herramienta integrada `image_gen`, usando las fotografías originales como referencias de identidad y una imagen maestra de Limón como plantilla de composición.

## Composición final

- Mismo formato vertical 3:4, botella frontal y centrada, escala y encuadre uniformes.
- Fondo natural con lago, bosque, montañas, vegetación y agua, siguiendo la corrección del usuario.
- Mismo diseño de etiqueta blanca, marca AQUAROMA, agua transparente y presentación de 500 ml.
- Por sabor cambian el nombre y la ilustración de la etiqueta, el color de la tapa y los ingredientes y hojas del entorno.
- Las versiones iniciales con fondo de estudio fueron descartadas y no se usan en la web.

## Archivos

Las once imágenes finales se guardan en `public/img/productos/uniformes/`, como JPEG de calidad 92, manteniendo la resolución de los resultados generados. Los originales permanecen intactos en `public/img/productos/`.

`utils/imagenesProductos.js` selecciona la serie nueva para los once productos actuales y conserva la ruta original para otros productos. Si una imagen nueva no está disponible, usa la original.

Inicio, catálogo, ficha del producto, carrito y favoritas usan esta selección común. No se modificaron registros de productos, precios, existencias ni filtros.

Los archivos `generacion-grupo-a.json` y `generacion-grupo-b.json` conservan los prompts exactos utilizados y la correspondencia entre sabores, referencias y resultados. `seleccion.json` enumera los once archivos finales.

Las imágenes generadas son recreaciones comerciales de las referencias; no son fotografías de un nuevo envase físico.
