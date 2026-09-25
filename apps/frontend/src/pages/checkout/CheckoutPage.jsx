import { CheckCircle2, LocateFixed, Loader2, MapPin, ShoppingBag, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import PaymentMethodPicker from '../../components/payments/PaymentMethodPicker.jsx';
import SandboxNotice from '../../components/payments/SandboxNotice.jsx';
import { useCart } from '../../features/cart/CartContext.jsx';
import { useOrders } from '../../features/orders/OrdersContext.jsx';
import { gateway } from '../../features/payments/gateway.js';
import { usePayments } from '../../features/payments/PaymentsContext.jsx';
import { isValidNequiPhone, maskPhone, PROVIDERS } from '../../features/payments/providers.js';
import { getCurrentPosition, isInsideDeliveryArea, mapLink } from '../../lib/geo.js';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import './checkout-page.css';

const NEQUI_TIMEOUT_MS = 5 * 60 * 1000; // la solicitud de Nequi vence a los 5 minutos
const POLL_MS = 2000;

/** Página "Finalizar pedido": entrega, medio de pago y estado del pago. */
export default function CheckoutPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { groups, totalCop, totalItems, clear } = useCart();
  const { defaultId, nequiPhone, setNequiPhone } = usePayments();
  const orders = useOrders();

  const [provider, setProvider] = useState(defaultId);
  const [phone, setPhone] = useState(nequiPhone || user.phone || '');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  // Ubicación actual del cliente (guía para el repartidor): { lat, lng, accuracy }
  const [coords, setCoords] = useState(null);
  const [geo, setGeo] = useState({ loading: false, error: '' });

  // form → starting → waiting → success | failed
  const [step, setStep] = useState('form');
  const [attempt, setAttempt] = useState(null); // { order, reference, provider, startedAt }
  const [failReason, setFailReason] = useState('');
  const finished = useRef(false);

  const items = useMemo(
    () =>
      groups.flatMap((g) =>
        g.lines.map((l) => ({
          storeId: g.storeId,
          storeName: g.storeName,
          productId: l.product.id,
          name: l.product.name,
          priceCop: l.product.price_cop,
          quantity: l.quantity,
        })),
      ),
    [groups],
  );

  const finalize = (outcome, order, reason = '') => {
    if (finished.current) return;
    finished.current = true;
    if (outcome === 'approved') {
      orders.update(order.id, {
        status: 'confirmed',
        payment: { status: order.payment.provider === 'cash' ? 'cash_on_delivery' : 'approved' },
      });
      clear();
      setStep('success');
    } else {
      orders.update(order.id, { status: 'payment_failed', payment: { status: 'rejected' } });
      setFailReason(reason || 'El pago no fue aprobado.');
      setStep('failed');
    }
  };

  // Mientras el pago está pendiente se consulta su estado cada pocos segundos.
  useEffect(() => {
    if (step !== 'waiting' || !attempt) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        if (attempt.provider === 'nequi' && Date.now() - attempt.startedAt > NEQUI_TIMEOUT_MS) {
          await gateway.resolve?.(attempt.reference, 'rejected').catch(() => {});
          if (!cancelled) finalize('rejected', attempt.order, 'La solicitud de Nequi venció. Intenta de nuevo.');
          return;
        }
        const status = await gateway.check(attempt.reference);
        if (cancelled) return;
        if (status === 'approved') finalize('approved', attempt.order);
        else if (status === 'rejected') finalize('rejected', attempt.order, 'El pago fue rechazado.');
      } catch {
        /* un fallo de red no cancela el pago: se reintenta en la siguiente consulta */
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, attempt]);

  const useMyLocation = async () => {
    setGeo({ loading: true, error: '' });
    try {
      const position = await getCurrentPosition();
      if (!isInsideDeliveryArea(position)) {
        setCoords(null);
        setGeo({ loading: false, error: 'Tu ubicación está fuera de la zona de entrega: solo entregamos en Neira, Caldas.' });
        return;
      }
      setCoords(position);
      setGeo({ loading: false, error: '' });
    } catch (err) {
      setGeo({ loading: false, error: err.message });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (address.trim().length < 5) next.address = 'Escribe la dirección de entrega (calle, carrera y barrio).';
    if (provider === 'nequi' && !isValidNequiPhone(phone)) next.phone = 'Ingresa un celular válido de 10 dígitos que empiece por 3.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;

    setStep('starting');
    finished.current = false;
    const order = orders.create({
      items,
      totalCop,
      delivery: { address: address.trim(), notes: notes.trim(), location: coords ?? undefined },
      payment: { provider, status: 'pending', phone: provider === 'nequi' ? phone.replace(/\D/g, '') : undefined },
    });

    try {
      if (provider === 'nequi') setNequiPhone(phone.replace(/\D/g, ''));
      const result = await gateway.start({
        provider,
        amountCop: totalCop,
        phone: provider === 'nequi' ? phone.replace(/\D/g, '') : undefined,
        description: `Pedido NeirAPP ${order.id}`,
        orderId: order.id,
      });
      orders.update(order.id, { payment: { reference: result.reference } });
      const started = { order: { ...order, payment: { ...order.payment, reference: result.reference } }, reference: result.reference, provider, startedAt: Date.now() };
      setAttempt(started);

      if (result.status === 'approved') return finalize('approved', started.order);
      // Mercado Pago real: se envía al cliente a la página de pago de Mercado Pago.
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return undefined;
      }
      setStep('waiting');
    } catch (err) {
      orders.update(order.id, { status: 'payment_failed', payment: { status: 'rejected' } });
      setFormError(err.message || 'No pudimos iniciar el pago. Intenta de nuevo.');
      setStep('form');
    }
    return undefined;
  };

  const retry = () => {
    setAttempt(null);
    setFailReason('');
    setStep('form');
  };

  /* ---------- Estados ---------- */
  if (step === 'success' && attempt) {
    const { order } = attempt;
    return (
      <PageShell user={user} onLogout={onLogout} title="¡Pedido confirmado!">
        <div className="page-narrow">
          <section className="page-card result-card ok">
            <CheckCircle2 size={56} aria-hidden="true" />
            <h2>Gracias por tu compra</h2>
            <p>
              Tu pedido <strong>{order.id}</strong> por <strong>{formatCop(order.totalCop)}</strong> quedó registrado.
              {order.payment.provider === 'cash' ? ' Pagarás en efectivo al recibirlo.' : ` Pago aprobado con ${PROVIDERS[order.payment.provider].label}.`}
            </p>
            <div className="result-actions">
              <button type="button" className="btn-solid" onClick={() => navigate('/pedidos')}>
                Ver mis pedidos
              </button>
              <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
                Seguir comprando
              </button>
            </div>
          </section>
        </div>
      </PageShell>
    );
  }

  if (step === 'failed') {
    return (
      <PageShell user={user} onLogout={onLogout} title="No pudimos completar el pago">
        <div className="page-narrow">
          <section className="page-card result-card bad">
            <XCircle size={56} aria-hidden="true" />
            <h2>Pago no aprobado</h2>
            <p>{failReason} Tu carrito sigue intacto: puedes intentarlo de nuevo o elegir otro medio de pago.</p>
            <div className="result-actions">
              <button type="button" className="btn-solid" onClick={retry}>
                Intentar de nuevo
              </button>
            </div>
          </section>
        </div>
      </PageShell>
    );
  }

  if (step === 'waiting' && attempt) {
    const info = PROVIDERS[attempt.provider];
    return (
      <PageShell user={user} onLogout={onLogout} title="Esperando tu pago">
        <div className="page-narrow">
          <section className="page-card result-card waiting" aria-live="polite">
            <Loader2 className="spin" size={52} aria-hidden="true" />
            {attempt.provider === 'nequi' ? (
              <>
                <h2>Aprueba el pago en Nequi</h2>
                <p>
                  Enviamos una solicitud de <strong>{formatCop(attempt.order.totalCop)}</strong> al Nequi{' '}
                  <strong>{maskPhone(attempt.order.payment.phone ?? '')}</strong>. Abre la app y aprúebala. Vence en 5 minutos.
                </p>
              </>
            ) : (
              <>
                <h2>Completa el pago en {info.label}</h2>
                <p>
                  Paga <strong>{formatCop(attempt.order.totalCop)}</strong> en la ventana de {info.label}. Esta página se
                  actualiza sola cuando el pago se confirme.
                </p>
              </>
            )}
            <p className="ref">Referencia: {attempt.reference}</p>

            {gateway.mode === 'sandbox' && (
              <div className="sandbox-box">
                <SandboxNotice />
                <p>Simula la respuesta de {info.label}:</p>
                <div className="result-actions">
                  <button type="button" className="btn-solid" onClick={() => gateway.resolve(attempt.reference, 'approved')}>
                    Aprobar pago
                  </button>
                  <button type="button" className="btn-ghost btn-danger" onClick={() => gateway.resolve(attempt.reference, 'rejected')}>
                    Rechazar pago
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </PageShell>
    );
  }

  /* ---------- Formulario ---------- */
  if (totalItems === 0 && step === 'form') {
    return (
      <PageShell user={user} onLogout={onLogout} title="Finalizar pedido">
        <div className="page-narrow">
          <section className="page-card">
            <div className="empty-state">
              <ShoppingBag size={46} aria-hidden="true" />
              <p>Tu carrito está vacío.</p>
              <small>Agrega productos de una tienda para hacer tu pedido.</small>
              <button type="button" className="btn-solid" onClick={() => navigate('/')}>
                Explorar tiendas
              </button>
            </div>
          </section>
        </div>
      </PageShell>
    );
  }

  const busy = step === 'starting';

  return (
    <PageShell user={user} onLogout={onLogout} title="Finalizar pedido" subtitle="Revisa tu pedido, indica dónde entregarlo y elige cómo pagar.">
      <form className="checkout-grid" onSubmit={submit} noValidate>
        <div className="checkout-main">
          <SandboxNotice />

          <section className="page-card">
            <h2>Entrega</h2>
            <div className="form-field">
              <label htmlFor="co-address">Dirección de entrega</label>
              <input
                id="co-address"
                value={address}
                autoComplete="street-address"
                placeholder="Ej: Carrera 9 # 10-25, barrio Centro"
                aria-invalid={errors.address ? 'true' : undefined}
                onChange={(e) => setAddress(e.target.value)}
              />
              {errors.address && <small className="err">{errors.address}</small>}
            </div>

            <div className="geo-box">
              <button type="button" className="btn-ghost geo-btn" onClick={useMyLocation} disabled={geo.loading}>
                {geo.loading ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <LocateFixed size={17} aria-hidden="true" />}
                {geo.loading ? 'Buscando tu ubicación…' : coords ? 'Actualizar mi ubicación' : 'Usar mi ubicación actual'}
              </button>
              {coords && (
                <p className="geo-ok" role="status">
                  <MapPin size={16} aria-hidden="true" />
                  <span>
                    Ubicación guardada (precisión de unos {coords.accuracy} m). El repartidor la verá en el mapa.{' '}
                    <a href={mapLink(coords)} target="_blank" rel="noreferrer">
                      Ver en el mapa
                    </a>{' '}
                    ·{' '}
                    <button type="button" className="link-btn" onClick={() => setCoords(null)}>
                      Quitar
                    </button>
                  </span>
                </p>
              )}
              {geo.error && (
                <p className="geo-err" role="alert">
                  {geo.error}
                </p>
              )}
              {!coords && !geo.error && (
                <small className="geo-hint">Opcional: comparte tu ubicación exacta para que el repartidor te encuentre más fácil.</small>
              )}
            </div>
            <div className="form-field" style={{ marginTop: 14 }}>
              <label htmlFor="co-notes">Indicaciones para el repartidor (opcional)</label>
              <input id="co-notes" value={notes} maxLength={200} placeholder="Ej: Casa azul, portón negro" onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>

          <section className="page-card">
            <h2>Medio de pago</h2>
            <PaymentMethodPicker
              value={provider}
              onChange={setProvider}
              phone={phone}
              onPhoneChange={(v) => {
                setPhone(v);
                setErrors((er) => ({ ...er, phone: undefined }));
              }}
              phoneError={errors.phone}
            />
          </section>
        </div>

        <aside className="checkout-summary page-card" aria-label="Resumen del pedido">
          <h2>Resumen</h2>
          {groups.map((g) => (
            <div key={g.storeId} className="sum-group">
              <h3>{g.storeName}</h3>
              <ul>
                {g.lines.map(({ product, quantity }) => (
                  <li key={product.id}>
                    <span>
                      {quantity} × {product.name}
                    </span>
                    <strong>{formatCop(product.price_cop * quantity)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="sum-total">
            <span>Total</span>
            <strong>{formatCop(totalCop)}</strong>
          </div>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn-solid pay-now" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="spin" size={18} aria-hidden="true" /> Procesando…
              </>
            ) : provider === 'cash' ? (
              'Confirmar pedido'
            ) : (
              `Pagar ${formatCop(totalCop)}`
            )}
          </button>
          <p className="sum-note">Al pagar aceptas los Términos y Condiciones de NeirAPP.</p>
        </aside>
      </form>
    </PageShell>
  );
}
