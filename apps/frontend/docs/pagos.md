# Pagos: Nequi y Mercado Pago

## Estado actual

El flujo completo funciona en el frontend: **carrito → checkout → pago → pedido en "Mis pedidos"**.

| Pieza | Dónde |
|---|---|
| Página de checkout (entrega, medio de pago, resumen) | `src/pages/checkout/CheckoutPage.jsx` |
| Selector Nequi / Mercado Pago / efectivo | `src/components/payments/PaymentMethodPicker.jsx` |
| Pasarela (interfaz + implementaciones) | `src/features/payments/gateway.js` |
| Pedidos del cliente | `src/features/orders/OrdersContext.jsx` (guardados en el navegador) |
| Preferencia de pago | `src/features/payments/PaymentsContext.jsx` |

Hay **dos modos**, según `VITE_PAYMENTS_MODE`:

- **`sandbox` (por defecto)**: SIMULA Nequi y Mercado Pago. No se cobra dinero. En la pantalla de espera aparecen
  los botones "Aprobar pago" y "Rechazar pago" para probar cada resultado.
- **`live`**: llama al backend (contrato de abajo). **El backend de pagos todavía no existe.**

> Ni las llaves de Nequi ni las de Mercado Pago pueden ir en el frontend: cualquiera las vería en el navegador.
> Los cobros reales los hace el backend.

## Contrato del backend (modo `live`)

### `POST /api/v1/payments`

```json
{
  "provider": "nequi | mercadopago | cash",
  "amount_cop": 24500,
  "phone": "3001234567",
  "description": "Pedido NeirAPP NP-ABC123",
  "order_reference": "NP-ABC123",
  "return_url": "https://tu-dominio/checkout"
}
```

Respuesta:

```json
{ "id": "pay_123", "status": "pending | approved | rejected", "checkout_url": "https://... (solo Mercado Pago)" }
```

- **Nequi** (API Nequi Conecta, "pago con notificación push"): el backend envía la solicitud al `phone` y responde
  `pending`. Nequi avisa la aprobación por *webhook* o se consulta su estado.
- **Mercado Pago** (Checkout Pro): el backend crea una *preferencia* con el `Access Token` y devuelve su
  `init_point` como `checkout_url`. El frontend redirige al cliente allí; Mercado Pago lo devuelve a `return_url`.
- **cash**: responde `approved` de inmediato (se paga al recibir).

### `GET /api/v1/payments/{id}`

```json
{ "status": "pending | approved | rejected" }
```

El frontend lo consulta cada 2 s mientras el pago está pendiente. El estado real debe actualizarse con los
*webhooks* de Nequi y Mercado Pago (verificando su firma), no con lo que diga el navegador.

## Lo que falta para cobrar de verdad

1. **Credenciales** (las pone quien administra el negocio, nunca en el código):
   - Mercado Pago: cuenta de vendedor y `Access Token` (hay credenciales de prueba para desarrollar).
   - Nequi: acceso a Nequi Conecta (requiere solicitarlo a Nequi y firmar como comercio).
2. **Endpoints** anteriores en el backend, con los *webhooks* y la verificación de firmas.
3. **Sesión real**: hoy el login del frontend es simulado en el navegador. El backend necesita un usuario
   autenticado (JWT) para asociar cada pago a un cliente y a un pedido.
4. Pasar los pedidos a `POST /api/v1/orders` del backend (ya existe en la rama `neirapp-architecture-plan`) en
   lugar de guardarlos en el navegador.
5. Cambiar `VITE_PAYMENTS_MODE=live`.
