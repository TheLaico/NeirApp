import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ridesApi } from '../../features/rides/api.js';
import { phoneLabel } from '../../features/rides/model.js';
import ImageField from '../supplier/ImageField.jsx';

const toDraft = (d, user) => ({
  name: d?.name ?? user.name ?? '',
  phone: phoneLabel(d?.phone ?? user.phone ?? ''),
  plate: d?.plate_label ?? '',
  vehicle_model: d?.vehicle_model ?? '',
  model_year: d?.model_year ? String(d.model_year) : '',
  color: d?.color ?? '',
  capacity: d?.capacity ?? 3,
  photo_url: d?.photo_url ?? '',
  vehicle_photo_url: d?.vehicle_photo_url ?? '',
});

const FIELD_OF = {
  invalid_driver_name: 'name',
  invalid_driver_phone: 'phone',
  invalid_plate: 'plate',
  invalid_vehicle: 'vehicle',
  invalid_driver_photo: 'photos',
};

/** "Mi perfil": los datos que ve el cliente cuando el conductor acepta (nombre, foto, celular, placa, motocarro). */
export default function ProfileView({ user, driver, onSaved }) {
  const [form, setForm] = useState(() => toDraft(driver, user));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
    setStatus('');
  };
  const field = (name) => ({ value: form[name], onChange: (e) => set({ [name]: e.target.value }), 'aria-invalid': Boolean(errors[name]) });

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Escribe tu nombre.';
    if (!/^3\d{9}$/.test(form.phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''))) found.phone = 'Escribe tu celular de 10 dígitos.';
    if (form.plate.replace(/[\s-]/g, '').length < 5) found.plate = 'Escribe la placa del motocarro.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setStatus('saving');
    try {
      const saved = await ridesApi.saveMe({ ...form, model_year: Number(form.model_year) || 0, capacity: Number(form.capacity) });
      setForm(toDraft(saved, user));
      setStatus('saved');
      onSaved(saved);
    } catch (err) {
      const name = FIELD_OF[err.code];
      setErrors(name ? { [name]: err.message } : { server: err.message });
      setStatus('');
    }
  };

  return (
    <div className="spp-view">
      <div className="spp-head">
        <h1>{driver ? 'Mi perfil' : 'Crea tu perfil de conductor'}</h1>
        <p>Esto es lo que ve el cliente cuando aceptas su solicitud: tu nombre y foto, tu celular para llamarte y la placa del motocarro para reconocerlo.</p>
      </div>
      <form className="sp-form" onSubmit={submit} noValidate>
        <section className="sp-form-card">
          <h2>Fotos</h2>
          <div className="spp-images">
            <ImageField label="Tu foto" hint="De frente, con buena luz." shape="square" value={form.photo_url} onChange={(url) => set({ photo_url: url })} />
            <ImageField label="Foto del motocarro" hint="Que se vea bien el color y la placa. Si no subes una, usamos el dibujo del motocarro." value={form.vehicle_photo_url} onChange={(url) => set({ vehicle_photo_url: url })} />
          </div>
          {errors.photos && <small className="sp-error">{errors.photos}</small>}
        </section>
        <section className="sp-form-card">
          <h2>Tus datos</h2>
          <div className="sp-grid2">
            <label className="sp-field">
              Nombre
              <input {...field('name')} maxLength={80} placeholder="Ej: Juan Pérez" />
              {errors.name && <small className="sp-error">{errors.name}</small>}
            </label>
            <label className="sp-field">
              Celular
              <input {...field('phone')} type="tel" inputMode="tel" placeholder="310 123 4567" />
              {errors.phone && <small className="sp-error">{errors.phone}</small>}
            </label>
          </div>
        </section>
        <section className="sp-form-card">
          <h2>Tu motocarro</h2>
          <div className="sp-grid2">
            <label className="sp-field">
              Placa
              <input {...field('plate')} maxLength={9} placeholder="Ej: NEI-123" style={{ textTransform: 'uppercase' }} />
              {errors.plate && <small className="sp-error">{errors.plate}</small>}
            </label>
            <label className="sp-field">
              Pasajeros que lleva
              <select {...field('capacity')}>
                <option value={1}>1 persona</option>
                <option value={2}>2 personas</option>
                <option value={3}>3 personas</option>
              </select>
            </label>
            <label className="sp-field">
              <span>
                Marca y referencia <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('vehicle_model')} maxLength={60} placeholder="Ej: Bajaj RE" />
            </label>
            <div className="sp-grid2">
              <label className="sp-field">
                <span>
                  Año <span className="sp-optional">(opcional)</span>
                </span>
                <input {...field('model_year')} inputMode="numeric" maxLength={4} placeholder="2023" onChange={(e) => set({ model_year: e.target.value.replace(/\D/g, '') })} />
              </label>
              <label className="sp-field">
                <span>
                  Color <span className="sp-optional">(opcional)</span>
                </span>
                <input {...field('color')} maxLength={30} placeholder="Verde y blanco" />
              </label>
            </div>
          </div>
          {errors.vehicle && <small className="sp-error">{errors.vehicle}</small>}
        </section>
        {errors.server && (
          <p className="sp-error" role="alert">
            {errors.server}
          </p>
        )}
        <div className="sp-form-actions">
          {status === 'saved' && (
            <span className="sp-ok" role="status">
              <CheckCircle2 size={18} aria-hidden="true" /> Guardamos tu perfil.
            </span>
          )}
          <button type="submit" className="sp-btn primary" disabled={status === 'saving'}>
            {status === 'saving' && <Loader2 size={17} className="sp-spin" aria-hidden="true" />} {driver ? 'Guardar cambios' : 'Crear mi perfil'}
          </button>
        </div>
      </form>
    </div>
  );
}
