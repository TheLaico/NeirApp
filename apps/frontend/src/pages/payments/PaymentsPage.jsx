import { useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import PaymentMethodPicker from '../../components/payments/PaymentMethodPicker.jsx';
import SandboxNotice from '../../components/payments/SandboxNotice.jsx';
import { usePayments } from '../../features/payments/PaymentsContext.jsx';
import { isValidNequiPhone } from '../../features/payments/providers.js';
import '../checkout/checkout-page.css';
import './payments-page.css';

/** Página "Métodos de pago": medio predeterminado (Nequi, Mercado Pago o efectivo) y celular de Nequi. */
export default function PaymentsPage({ user, onLogout }) {
  const { defaultId, nequiPhone, setDefault, setNequiPhone } = usePayments();
  const [phone, setPhone] = useState(nequiPhone || user.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [saved, setSaved] = useState(false);

  const choose = (id) => {
    setDefault(id);
    setSaved(false);
  };

  const save = () => {
    if (defaultId === 'nequi' && !isValidNequiPhone(phone)) {
      setPhoneError('Ingresa un celular válido de 10 dígitos que empiece por 3.');
      return;
    }
    if (phone.trim()) setNequiPhone(phone.replace(/\D/g, ''));
    setPhoneError('');
    setSaved(true);
  };

  return (
    <PageShell
      user={user}
      onLogout={onLogout}
      title="Métodos de pago"
      subtitle="Elige con qué prefieres pagar tus pedidos. Podrás cambiarlo en cada compra."
    >
      <div className="page-narrow">
        <SandboxNotice />
        <section className="page-card" style={{ marginTop: 16 }}>
          <h2>Medio de pago predeterminado</h2>
          <PaymentMethodPicker
            value={defaultId}
            onChange={choose}
            phone={phone}
            onPhoneChange={(v) => {
              setPhone(v);
              setPhoneError('');
              setSaved(false);
            }}
            phoneError={phoneError}
          />
          <div className="form-actions">
            <button type="button" className="btn-solid" onClick={save}>
              Guardar
            </button>
            {saved && (
              <span className="saved" role="status">
                ✓ Preferencia guardada
              </span>
            )}
          </div>
          <p className="privacy-note">
            No guardamos números de tarjeta ni datos de tus cuentas. El pago lo procesa directamente Nequi o Mercado Pago.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
