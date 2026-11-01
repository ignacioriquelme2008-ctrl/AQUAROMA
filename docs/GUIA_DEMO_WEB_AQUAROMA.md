# Guía de presentación de la página web · AQUAROMA

Guía para la persona que manejará el navegador durante la presentación. Se enfoca exclusivamente en preparar y mostrar el sitio funcionando; las diapositivas y la exposición del problema quedan a cargo del resto del equipo.

> **Meta de la demo:** contar una sola historia: un cliente personaliza y compra un producto; luego el negocio recibe y gestiona ese pedido.

## 1. Preparación el día anterior

- [ ] Ejecutar el proyecto y recorrer una compra completa, hasta llegar al comprobante.
- [ ] Probar también el ingreso al panel de administración y abrir un pedido.
- [ ] Confirmar que se conocen las contraseñas de las cuentas de demostración de cliente y administrador. No anotarlas en una diapositiva ni en este documento.
- [ ] Confirmar que el catálogo tenga productos activos y stock suficiente para la compra de prueba.
- [ ] Elegir de antemano una bebida, un aroma, una dirección y un medio de pago disponibles.
- [ ] Dejar el carrito del cliente vacío después del ensayo.
- [ ] Preparar un video corto de respaldo con la compra y la gestión del pedido.
- [ ] No hacer cambios de código, datos ni configuración después del último ensayo exitoso.

## 2. Preparación 15 minutos antes

1. Iniciar MySQL.
2. Abrir PowerShell en la carpeta del proyecto:

   ```powershell
   cd C:\Users\ignac\OneDrive\Desktop\aquaroma
   npm start
   ```

3. Abrir `http://localhost:3000` y comprobar que la página carga.
4. Preparar dos ventanas:
   - **Ventana normal:** iniciar sesión como cliente y abrir `/catalogo`.
   - **Ventana incógnito:** iniciar sesión como administrador y abrir `/admin`.
5. Comprobar una vez que ambas sesiones funcionan. Luego volver a dejar la ventana del cliente en el catálogo y el carrito vacío.
6. Ajustar el zoom del navegador al 110–125 %, cerrar pestañas innecesarias y silenciar notificaciones.
7. Dejar el video de respaldo accesible, pero no abierto encima del sitio.

**No reinicies ni restaures la base de datos antes de presentar.** Podrías borrar los datos o las cuentas que necesitas para la demo.

## 3. Recorrido hablado de la web

Duración objetivo: **4–5 minutos**. Si el equipo dispone de menos tiempo, usa la versión breve de la sección 5.

### A. Entrada al sitio — 10 segundos

**Haz:** muestra el catálogo ya abierto.

**Di:**

> “Ahora les mostraré AQUAROMA funcionando en la página. Primero haré el recorrido como cliente y después veremos cómo el administrador recibe y gestiona esa compra.”

### B. Catálogo y filtros — 20 segundos

**Haz:** muestra los productos y aplica un filtro que tenga resultados.

**Di:**

> “Este es el catálogo de productos disponibles. Puedo filtrar por aroma o tipo de agua para encontrar más rápido lo que busco.”

### C. Personalización — 25 segundos

**Haz:** abre un producto activo, elige un aroma disponible y selecciona una intensidad.

**Di:**

> “En la ficha puedo personalizar la bebida: elijo el aroma y su intensidad. Así el cliente arma una combinación según su preferencia.”

### D. Carrito, cantidades y total — 35 segundos

**Haz:** agrega el producto, abre el carrito, muestra el resumen y, si está preparado, cambia la cantidad o agrega otro producto.

**Di:**

> “La bebida personalizada queda en el carrito. Aquí puedo revisar los productos y cantidades, y el resumen muestra subtotal, IVA, envío y total antes de confirmar.”

Si el ensayo confirmó el límite de stock y hay tiempo, intenta una cantidad superior a la disponible:

> “El sistema también comprueba el stock y no permite pedir más unidades de las disponibles.”

No gastes tiempo provocando un error si no está ensayado.

### E. Confirmar la compra y comprobante — 35 segundos

**Haz:** elige una dirección guardada o completa los datos; selecciona un medio de pago y confirma. Muestra el comprobante.

**Di:**

> “Confirmo el pedido con una dirección y un medio de pago. Al terminar, la página entrega un comprobante con el detalle de la compra. El pago queda pendiente de confirmación por la tienda.”

### F. Historial del cliente — 15 segundos

**Haz:** abre **Mis pedidos** y muestra el pedido recién creado.

**Di:**

> “Después de comprar, el cliente puede volver a Mis pedidos para revisar su compra y su estado.”

### G. Cambio a administrador — 5 segundos

**Haz:** cambia a la ventana incógnita donde ya está abierta la sesión de administrador.

**Di:**

> “Ahora cambio al panel de administración para mostrar cómo el negocio ve ese mismo pedido.”

### H. Panel y pedido — 35 segundos

**Haz:** muestra el panel; entra a **Pedidos**, abre el pedido de la demo y cambia su estado solo a **Pagado** o **En preparación**.

**Di:**

> “El panel reúne información para la operación. En Pedidos aparece la compra que acabamos de hacer; el administrador puede revisarla y actualizar su estado. El cliente verá ese avance en su historial.”

No cambies a **Enviado** salvo que tengas preparados la empresa de transporte y el código de seguimiento.

### I. Productos o stock (opcional) — 25 segundos

Elige **solo una** sección si queda tiempo. No edites datos reales en plena presentación.

- **Productos:** muestra la lista y la opción de editar o desactivar. Di: “Desde aquí se gestionan los productos y sus imágenes; también se puede desactivar un producto sin borrarlo del historial.”
- **Stock:** muestra las existencias por sucursal y los movimientos. Di: “El stock se consulta por sucursal y los cambios quedan registrados.”

### J. Entrega al siguiente expositor — 5 segundos

**Di:**

> “Ese es el recorrido de la página, desde la compra del cliente hasta la gestión del negocio. Le paso la palabra a **[nombre]** para continuar.”

## 4. Ruta de navegación para memorizar

```text
Cliente: /catalogo
  → filtro
  → producto y personalización
  → /carrito
  → confirmar
  → comprobante
  → Mis pedidos

Administrador: /admin
  → Pedidos
  → pedido recién creado
  → Pagado o En preparación
```

## 5. Versión breve (aprox. 90 segundos)

1. Catálogo: “Aquí el cliente encuentra y filtra productos.”
2. Producto: elige aroma e intensidad. “Puede personalizar su bebida.”
3. Carrito: muestra total. “Revisa cantidades, IVA y envío antes de comprar.”
4. Confirmar y comprobante. “La compra queda registrada y recibe su comprobante.”
5. Admin: abre el pedido y cambia a Pagado. “El negocio recibe el pedido y actualiza su estado.”

## 6. Si algo falla

- **La página no carga:** refresca una sola vez. Si no vuelve, usa el video de respaldo.
- **Falla MySQL o el servidor:** no intentes reparar ni reiniciar servicios durante la exposición; pasa al video.
- **No recuerdas una ruta:** usa los enlaces del menú en vez de escribirla manualmente.
- **El pedido no aparece de inmediato:** no improvises cambios en la base; continúa con otro pedido previamente preparado o muestra el respaldo.
- **Te quedas atrás de tiempo:** omite perfil, favoritas, edición de productos y stock; conserva compra, comprobante y pedido en administración.

Frase para continuar con calma:

> “Para cuidar el tiempo, voy a mostrar el resultado principal del flujo y continúo con la gestión del pedido.”

## 7. Recordatorios

- Narra lo que el público está viendo; evita los silencios mientras cargas páginas.
- No muestres Trello, historias de usuario, terminal, contraseñas ni mensajes personales.
- No borres productos reales ni hagas cambios irreversibles.
- No prometas funciones que no vayas a demostrar.
- Mantén el recorrido centrado en la página: **personalización → compra → comprobante → gestión del pedido**.
