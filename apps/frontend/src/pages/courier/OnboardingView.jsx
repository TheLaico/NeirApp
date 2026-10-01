import { Hourglass, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { courierApi, usePolled, VEHICLES } from '../../features/courier/api.js';

/** Registro del repartidor (vehículo y documento) y espera de la verificación de un administrador. */
export default function OnboardingView({ profile, onCreated }) {
  const [values, setValues] = useState({ vehicle_type: 'motorcycle', plate: '', id_document_number: '' });
  // Solo los vehículos que un administrador habilitó se pueden elegir; los demás se ven como "próximamente".
  const { data: types } = usePolled(courierApi.vehicleTypes, { enabled: !profile });
  const isEnabled = (value) => types?.find((t) => t.vehicle_type === value)?.is_enabled ?? value === 'motorcycle';
  // Si el elegido dejó de estar habilitado, se usa el primero que sí lo esté.
  const vehicle = isEnabled(values.vehicle_type) ? values.vehicle_type : (VEHICLES.find((v) => isEnabled(v.value))?.value ?? values.vehicle_type);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (profile) {
    return (
      <div className="cr-state">
        <Hourglass size={44} aria-hidden="true" />
        <h1>Estamos verificando tus datos</h1>
        <p>Un administrador revisará tu documento y tu vehículo. Cuando te aprueben, aquí verás los pedidos disponibles.</p>
        <button type="button" className="cr-btn ghost" onClick={onCreated}>
          Ya me aprobaron, actualizar
        </button>
      </div>
    );
  }

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const needsPlate = vehicle !== 'bike';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (values.id_document_number.trim().length < 4) return setError('Escribe tu número de documento.');
    if (needsPlate && !values.plate.trim()) return setError('Escribe la placa de tu vehículo.');
    setSaving(true);
    try {
      await courierApi.createProfile({
        vehicle_type: vehicle,
        plate: needsPlate ? values.plate.trim() : null,
        id_document_number: values.id_document_number.trim(),
      });
      await onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="cr-card cr-form" onSubmit={onSubmit} noValidate>
      <h2>Completa tu perfil de repartidor</h2>
      <p className="cr-muted">Necesitamos estos datos para verificarte antes de que puedas tomar pedidos.</p>
      <label>
        Vehículo
        <select value={vehicle} onChange={set('vehicle_type')}>
          {VEHICLES.map((v) => (
            <option key={v.value} value={v.value} disabled={!isEnabled(v.value)}>
              {v.label}
              {isEnabled(v.value) ? '' : ' (próximamente)'}
            </option>
          ))}
        </select>
      </label>
      {needsPlate && (
        <label>
          Placa
          <input value={values.plate} onChange={set('plate')} autoCapitalize="characters" placeholder="ABC123" />
        </label>
      )}
      <label>
        Número de documento
        <input value={values.id_document_number} onChange={set('id_document_number')} inputMode="numeric" placeholder="1234567890" />
      </label>
      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="cr-btn primary" disabled={saving}>
        {saving && <Loader2 size={18} className="cr-spin" aria-hidden="true" />}
        Enviar para verificación
      </button>
    </form>
  );
}
