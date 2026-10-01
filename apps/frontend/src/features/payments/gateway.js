/**
 * Pasarela de pagos: la interfaz que usa el checkout, con dos implementaciones.
 *
 *  - "sandbox" (por defecto): SIMULA Nequi y Mercado Pago en el navegador. No mueve dinero.
 *    Sirve para desarrollar y probar el flujo completo (pendiente → aprobado / rechazado).
 *  - "live": llama al backend, que es quien habla con Nequi y Mercado Pago (las llaves secretas nunca
 *    van en el frontend). Ver frontend/docs/pagos.md para el contrato que el backend debe cumplir.
 *
 * Se elige con VITE_PAYMENTS_MODE=sandbox|live.
 *
 * Interfaz:
 *   start({ provider, amountCop, phone, description, orderId }) -> { reference, status, checkoutUrl? }
 *   check(reference)                                            -> 'pending' | 'approved' | 'rejected'
 *   resolve(reference, outcome)                                 -> solo sandbox: fuerza el resultado
 */

export const PAYMENTS_MODE = import.meta.env.VITE_PAYMENTS_MODE === 'live' ? 'live' : 'sandbox';

const SANDBOX_KEY = 'neirapp.frontend.sandbox-payments';

const readSandbox = () => {
  try {
    return JSON.parse(localStorage.getItem(SANDBOX_KEY)) ?? {};
  } catch {
    return {};
  }
};
const writeSandbox = (data) => {
  try {
    localStorage.setItem(SANDBOX_KEY, JSON.stringify(data));
  } catch {
    /* sin almacenamiento: el estado simulado se pierde al recargar */
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sandboxGateway = {
  mode: 'sandbox',

  async start({ provider, amountCop }) {
    await delay(600); // como una llamada de red
    const reference = `SBX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    // El efectivo se confirma solo; Nequi y Mercado Pago quedan pendientes hasta que el cliente los apruebe.
    const status = provider === 'cash' ? 'approved' : 'pending';
    writeSandbox({ ...readSandbox(), [reference]: { status, provider, amountCop } });
    return { reference, status, checkoutUrl: null };
  },

  async check(reference) {
    return readSandbox()[reference]?.status ?? 'rejected';
  },

  async resolve(reference, outcome) {
    const all = readSandbox();
    if (all[reference]) writeSandbox({ ...all, [reference]: { ...all[reference], status: outcome } });
  },
};

const json = async (res) => {
  if (!res.ok) throw new Error(`El servidor de pagos respondió ${res.status}.`);
  return res.json();
};

const liveGateway = {
  mode: 'live',

  async start({ provider, amountCop, phone, description, orderId }) {
    const data = await json(
      await fetch('/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          amount_cop: amountCop,
          phone: phone || undefined,
          description,
          order_reference: orderId,
          // Mercado Pago devuelve al cliente a esta dirección con el resultado
          return_url: `${window.location.origin}/checkout`,
        }),
      }),
    );
    return { reference: data.id, status: data.status, checkoutUrl: data.checkout_url ?? null };
  },

  async check(reference) {
    const data = await json(await fetch(`/api/v1/payments/${encodeURIComponent(reference)}`));
    return data.status;
  },

  async resolve() {
    throw new Error('resolve() solo existe en modo sandbox.');
  },
};

export const gateway = PAYMENTS_MODE === 'live' ? liveGateway : sandboxGateway;
