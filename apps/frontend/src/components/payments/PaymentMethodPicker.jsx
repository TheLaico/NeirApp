import { CheckCircle2 } from 'lucide-react';
import { PROVIDER_IDS, PROVIDERS } from '../../features/payments/providers.js';

/**
 * Selector de medio de pago (Nequi, Mercado Pago o efectivo). Si se elige Nequi pide el celular,
 * porque Nequi envía la notificación de aprobación a ese número.
 */
export default function PaymentMethodPicker({ value, onChange, phone, onPhoneChange, phoneError }) {
  return (
    <div className="pay-picker" role="radiogroup" aria-label="Medio de pago">
      {PROVIDER_IDS.map((id) => {
        const { label, description, Icon, color } = PROVIDERS[id];
        const selected = value === id;
        return (
          <div key={id} className={`pay-option${selected ? ' selected' : ''}`}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              className="pay-option-main"
              onClick={() => onChange(id)}
            >
              <span className="pay-option-icon" style={{ background: color }}>
                <Icon size={22} color="#fff" aria-hidden="true" />
              </span>
              <span className="pay-option-text">
                <strong>{label}</strong>
                <span>{description}</span>
              </span>
              <span className="pay-option-check" aria-hidden="true">
                {selected ? <CheckCircle2 size={24} fill="currentColor" color="#fff" /> : <span className="pay-radio" />}
              </span>
            </button>

            {id === 'nequi' && selected && (
              <div className="form-field pay-phone">
                <label htmlFor="nequi-phone">Celular con Nequi</label>
                <input
                  id="nequi-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="300 123 4567"
                  value={phone}
                  maxLength={14}
                  aria-invalid={phoneError ? 'true' : undefined}
                  onChange={(e) => onPhoneChange(e.target.value)}
                />
                {phoneError ? <small className="err">{phoneError}</small> : <small>Te enviaremos la solicitud de pago a este número.</small>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
