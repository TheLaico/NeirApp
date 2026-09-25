import { FlaskConical } from 'lucide-react';
import { PAYMENTS_MODE } from '../../features/payments/gateway.js';

/** Aviso visible mientras los pagos son simulados (no se mueve dinero). */
export default function SandboxNotice() {
  if (PAYMENTS_MODE !== 'sandbox') return null;
  return (
    <p className="sandbox-notice" role="note">
      <FlaskConical size={18} aria-hidden="true" />
      <span>
        <strong>Modo de pruebas.</strong> Los pagos con Nequi y Mercado Pago están simulados: no se cobra dinero real.
      </span>
    </p>
  );
}
