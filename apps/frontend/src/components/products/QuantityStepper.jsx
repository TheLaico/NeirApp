import { Minus, Plus } from 'lucide-react';
import { MAX_QUANTITY } from '../../features/cart/CartContext.jsx';

export default function QuantityStepper({ quantity, onChange, label = '' }) {
  return (
    <div className="stepper" role="group" aria-label={`Cantidad${label ? ` de ${label}` : ''}`}>
      <button type="button" aria-label="Quitar uno" onClick={() => onChange(quantity - 1)}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <span aria-live="polite">{quantity}</span>
      <button
        type="button"
        aria-label="Agregar uno"
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => onChange(quantity + 1)}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
