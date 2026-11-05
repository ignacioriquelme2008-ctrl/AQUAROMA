# PayPal Sandbox en el carrito

## Preparación

1. Configurar PAYPAL_ENV=sandbox, PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en el archivo .env local. Usar credenciales de la aplicación Sandbox, nunca Live. La integración queda deshabilitada con NODE_ENV=production.
2. En una base existente, ejecutar npm run db:paypal (ya aplicado en esta máquina). Las instalaciones nuevas incluyen la tabla en database/aquaroma.sql.
3. Ejecutar npm start o npm run dev y abrir http://localhost:3000/carrito.

## Demostración

1. Iniciar sesión con un cliente, agregar productos y revisar la dirección de entrega.
2. Elegir PayPal Sandbox y confirmar el pedido. El stock se descuenta al confirmar, igual que con los demás medios de pago. El pedido queda confirmado y su pago pendiente.
3. El carrito muestra el pedido pendiente, el total CLP, el total USD, la tasa completa y la fecha de la cotización. Revisar este importe antes de pulsar PayPal.
4. Aprobar con una cuenta Personal Sandbox del comprador, distinta de la cuenta Business receptora. El dinero es ficticio; el pedido sí queda registrado en la base local.
5. Tras una captura COMPLETED por el importe esperado, el pago queda aprobado y el pedido pagado. Se abre el comprobante. Una captura PENDING no aprueba el pedido.

Si se cancela la ventana, el pedido permanece pendiente. Se puede reabrir el pago desde Ver pedido o el comprobante, o cancelar el pedido para devolver el stock. Si se pierde la respuesta al capturar, usar Comprobar pago nuevamente. Los reintentos reutilizan la orden y una clave de idempotencia; también se consulta PayPal para recuperar capturas ya completadas.

## Conversión

Fuente: https://www.exchangerate-api.com/docs/free (Open Access, base USD). Se usa CLP por USD, sin tasa fija de respaldo. Se rechazan cotizaciones con más de 48 horas desde su fecha de publicación. Si la consulta falla, solo se permite una cotización en caché que siga dentro de ese límite; se indica el fallo de actualización en los datos del servicio.

Se divide el total CLP por la tasa usando sus decimales y se redondea el resultado final a dos decimales. La tasa, su fecha y el monto USD se guardan dentro de la misma transacción del pedido. Esa cotización queda fija para el pedido y es el monto que se envía y comprueba contra PayPal. La estimación previa del carrito puede cambiar al confirmar si se actualizó la cotización o un precio.

Es una tasa diaria de referencia, no la tasa propia de PayPal. Si el comprador paga desde otra moneda, PayPal o su banco puede aplicar otra conversión o comisiones. No representa una conversión comercial exacta de PayPal.

## Verificación

npm run test:paypal

Pruebas: conversión y redondeo, autenticación, aislamiento por cliente, orden incorrecta, importe alterado, captura pendiente, captura completa, recuperación e idempotencia. La aprobación interactiva final requiere ingresar a PayPal con una cuenta Personal Sandbox.

La antigua URL /pago/paypal/sandbox redirige al carrito; la vista aislada y el importe fijo PAYPAL_TEST_AMOUNT se retiraron.
