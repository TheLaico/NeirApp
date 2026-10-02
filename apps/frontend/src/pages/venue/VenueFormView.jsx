import { CheckCircle2, Eye, ImagePlus, Loader2, MapPin, Star, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { NeiraMap } from '../../features/map/NeiraMap.jsx';
import { uploadImage } from '../../features/media/api.js';
import { MAX_PHOTOS, inNeira, phoneLabel } from '../../features/lodging/model.js';
import { CATEGORIES, DAYS, FEATURES, PRICE_UNITS } from '../../features/venues/model.js';

const DESCRIPTION_MAX = 1000;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const toDraft = (h, user) => ({
  name: h?.name ?? '',
  category: h?.category ?? 'restaurant',
  tagline: h?.tagline ?? '',
  description: h?.description ?? '',
  address: h?.address ?? '',
  lat: h?.lat ?? null,
  lng: h?.lng ?? null,
  phone: phoneLabel(h?.phone ?? ''),
  whatsapp: phoneLabel(h?.whatsapp ?? ''),
  email: h?.email ?? user?.email ?? '',
  price_cop: h?.price_cop ? String(h.price_cop) : '',
  price_unit: h?.price_unit ?? 'person',
  photos: h?.photos ?? [],
  features: h?.features ?? [],
  open_time: h?.open_time ?? '12:00',
  close_time: h?.close_time ?? '22:00',
  open_days: h?.open_days ?? [0, 1, 2, 3, 4, 5, 6],
  max_people: String(h?.max_people ?? 20),
  is_listed: h?.is_listed ?? true,
});

// Errores de la API → campo donde se muestran.
const FIELD_OF = {
  invalid_venue_name: 'name',
  invalid_venue_description: 'description',
  invalid_venue_location: 'location',
  invalid_venue_phone: 'phone',
  invalid_venue_whatsapp: 'whatsapp',
  invalid_venue_email: 'email',
  invalid_venue_price: 'price_cop',
  invalid_venue_photos: 'photos',
  invalid_venue_schedule: 'schedule',
  invalid_venue_capacity: 'max_people',
};

/** "Mi lugar": la ficha que ven los clientes en Reservas, con fotos, horario, servicios y el punto en el mapa de Neira. */
export default function VenueFormView({ user, venue: hotel, onSave, onPublic }) {
  const [form, setForm] = useState(() => toDraft(hotel, user));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef(null);
  const box = useRef(null);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      if ('lat' in patch) delete next.location;
      delete next.server;
      return next;
    });
    setStatus('');
  };
  const field = (name) => ({ value: form[name], onChange: (e) => set({ [name]: e.target.value }), 'aria-invalid': Boolean(errors[name]) });

  const addPhotos = async (files) => {
    const room = MAX_PHOTOS - form.photos.length;
    const batch = [...files].filter((f) => TYPES.includes(f.type)).slice(0, Math.max(room, 0));
    if (!batch.length) {
      setErrors((e) => ({ ...e, photos: room <= 0 ? `Puedes subir hasta ${MAX_PHOTOS} fotos.` : 'Elige fotos JPG, PNG o WebP.' }));
      return;
    }
    setUploading(batch.length);
    for (const file of batch) {
      try {
        const url = await uploadImage(file);
        setForm((f) => ({ ...f, photos: [...f.photos, url] }));
        setErrors((e) => ({ ...e, photos: undefined }));
      } catch (err) {
        setErrors((e) => ({ ...e, photos: err.message }));
      }
      setUploading((n) => n - 1);
    }
  };

  const toggleFeature = (id) => set({ features: form.features.includes(id) ? form.features.filter((a) => a !== id) : [...form.features, id] });
  const toggleDay = (d) => set({ open_days: form.open_days.includes(d) ? form.open_days.filter((x) => x !== d) : [...form.open_days, d].sort() });

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (form.photos.length === 0) found.photos = 'Agrega al menos una foto de tu lugar.';
    if (form.name.trim().length < 2) found.name = 'Escribe el nombre del lugar.';
    if (form.description.trim().length < 20) found.description = 'Cuenta cómo es tu lugar (al menos 20 letras).';
    if (!form.address.trim()) found.address = 'Escribe la dirección o la vereda.';
    if (form.lat === null) found.location = 'Toca el mapa para marcar dónde queda tu lugar.';
    if (form.phone.replace(/\D/g, '').length < 7) found.phone = 'Escribe un teléfono de contacto.';
    if (!form.open_days.length) found.schedule = 'Elige al menos un día en que atiendes.';
    else if (form.open_time === form.close_time) found.schedule = 'La hora de apertura y la de cierre no pueden ser iguales.';
    if (!(Number(form.max_people) >= 1 && Number(form.max_people) <= 500)) found.max_people = 'Escribe cuántas personas recibes por reserva (1 a 500).';
    setErrors(found);
    if (Object.keys(found).length) {
      setTimeout(() => box.current?.querySelector('[aria-invalid="true"], .sp-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
      return;
    }
    setStatus('saving');
    try {
      const saved = await onSave({ ...form, price_cop: Number(form.price_cop) || 0, max_people: Number(form.max_people) });
      setForm(toDraft(saved, user));
      setStatus('saved');
    } catch (err) {
      const name = FIELD_OF[err.code];
      setErrors(name ? { [name]: err.message } : { server: err.message });
      setStatus('');
    }
  };

  const pin = form.lat !== null ? { lat: form.lat, lng: form.lng } : null;

  return (
    <div className="spp-view" ref={box}>
      <div className="spp-head htp-head">
        <div>
          <h1>Mi lugar</h1>
          <p>Así te verán los clientes en Reservas: tus fotos, tu horario, lo que ofreces y dónde quedas en el mapa de Neira.</p>
        </div>
        {hotel && (
          <button type="button" className="sp-btn outline" onClick={onPublic}>
            <Eye size={16} aria-hidden="true" /> Ver mi ficha
          </button>
        )}
      </div>
      <form className="sp-form" onSubmit={submit} noValidate>
        <section className="sp-form-card">
          <h2>Fotos</h2>
          <ul className="htp-photos">
            {form.photos.map((url, n) => (
              <li key={url}>
                <img src={url} alt={`Foto ${n + 1}`} />
                {n === 0 ? (
                  <span className="htp-cover">
                    <Star size={11} fill="currentColor" aria-hidden="true" /> Principal
                  </span>
                ) : (
                  <button type="button" className="htp-cover-btn" onClick={() => set({ photos: [url, ...form.photos.filter((p) => p !== url)] })}>
                    Usar de principal
                  </button>
                )}
                <button type="button" className="htp-photo-remove" aria-label={`Quitar foto ${n + 1}`} onClick={() => set({ photos: form.photos.filter((p) => p !== url) })}>
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
            {Array.from({ length: uploading }, (_, n) => (
              <li key={`up-${n}`} className="htp-photo-loading">
                <Loader2 size={24} className="sp-spin" aria-label="Subiendo foto" />
              </li>
            ))}
            {form.photos.length + uploading < MAX_PHOTOS && (
              <li>
                <button type="button" className="htp-photo-add" onClick={() => fileInput.current?.click()} aria-invalid={Boolean(errors.photos)}>
                  <ImagePlus size={24} aria-hidden="true" />
                  <span>Agregar fotos</span>
                </button>
              </li>
            )}
          </ul>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) addPhotos(e.target.files);
              e.target.value = '';
            }}
          />
          {errors.photos ? <small className="sp-error">{errors.photos}</small> : <small className="sp-muted">Hasta {MAX_PHOTOS} fotos: fachada, mesas, cancha, salón… La principal sale en la lista.</small>}
        </section>

        <section className="sp-form-card">
          <h2>Tu lugar</h2>
          <div className="sp-grid2">
            <label className="sp-field">
              Nombre
              <input {...field('name')} maxLength={80} placeholder="Ej: Restaurante El Fogón" />
              {errors.name && <small className="sp-error">{errors.name}</small>}
            </label>
            <label className="sp-field">
              Tipo de lugar
              <select {...field('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.one}
                  </option>
                ))}
              </select>
            </label>
            <label className="sp-field wide">
              <span>
                Frase corta <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('tagline')} maxLength={100} placeholder="Ej: Comida típica con el mejor sazón" />
            </label>
            <label className="sp-field wide">
              Descripción
              <textarea {...field('description')} rows={5} maxLength={DESCRIPTION_MAX} placeholder="Qué ofreces, capacidad, planes, políticas de reserva…" />
              <small className="sp-count">
                {form.description.length}/{DESCRIPTION_MAX}
              </small>
              {errors.description && <small className="sp-error">{errors.description}</small>}
            </label>
            <div className="sp-grid2 htp-times">
              <label className="sp-field">
                <span>
                  Precio desde <span className="sp-optional">(opcional)</span>
                </span>
                <input {...field('price_cop')} inputMode="numeric" placeholder="25000" onChange={(e) => set({ price_cop: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
                {errors.price_cop && <small className="sp-error">{errors.price_cop}</small>}
              </label>
              <label className="sp-field">
                Se cobra
                <select {...field('price_unit')}>
                  {PRICE_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="sp-field">
              Máximo de personas por reserva
              <input {...field('max_people')} inputMode="numeric" onChange={(e) => set({ max_people: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
              {errors.max_people && <small className="sp-error">{errors.max_people}</small>}
            </label>
          </div>
        </section>

        <section className="sp-form-card">
          <h2>Horario de atención</h2>
          <p className="sp-muted">Los clientes solo pueden pedir reservas en estos días y horas. Si cierras después de medianoche (por ejemplo de 8:00 p. m. a 2:00 a. m.), la madrugada cuenta como parte del día en que abriste.</p>
          <ul className="htp-amenities vnf-days" aria-label="Días que atiendes">
            {DAYS.map((d, n) => {
              const on = form.open_days.includes(n);
              return (
                <li key={d}>
                  <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggleDay(n)}>
                    {d}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="sp-grid2 htp-times vnf-hours">
            <label className="sp-field">
              Abre
              <input type="time" {...field('open_time')} />
            </label>
            <label className="sp-field">
              Cierra
              <input type="time" {...field('close_time')} />
            </label>
          </div>
          {errors.schedule && <small className="sp-error">{errors.schedule}</small>}
        </section>

        <section className="sp-form-card">
          <h2>Servicios</h2>
          <ul className="htp-amenities">
            {FEATURES.map(({ id, label, Icon }) => {
              const on = form.features.includes(id);
              return (
                <li key={id}>
                  <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggleFeature(id)}>
                    <Icon size={18} aria-hidden="true" /> {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="sp-form-card">
          <h2>Ubicación</h2>
          <label className="sp-field">
            Dirección o vereda
            <input {...field('address')} maxLength={120} placeholder="Ej: Vía Neira - Manizales km 2" />
            {errors.address && <small className="sp-error">{errors.address}</small>}
          </label>
          <p className="sp-muted htp-map-help">
            <MapPin size={15} aria-hidden="true" /> Toca el mapa en el punto exacto de tu lugar. Así aparece en el mapa de Reservas.
          </p>
          <div className="htp-map" aria-invalid={Boolean(errors.location)}>
            <NeiraMap
              stores={[]}
              pin={pin}
              onPick={(lat, lng) => (inNeira(lat, lng) ? set({ lat, lng }) : setErrors((e) => ({ ...e, location: 'Ese punto queda por fuera del mapa de Neira.' })))}
              className="htp-map-canvas"
            />
          </div>
          {errors.location ? <small className="sp-error">{errors.location}</small> : pin && <small className="sp-muted">Punto marcado: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</small>}
        </section>

        <section className="sp-form-card">
          <h2>Contacto</h2>
          <div className="sp-grid2">
            <label className="sp-field">
              Teléfono
              <input {...field('phone')} type="tel" inputMode="tel" placeholder="606 851 2345 o 310 123 4567" />
              {errors.phone && <small className="sp-error">{errors.phone}</small>}
            </label>
            <label className="sp-field">
              <span>
                WhatsApp <span className="sp-optional">(recomendado)</span>
              </span>
              <input {...field('whatsapp')} type="tel" inputMode="tel" placeholder="310 123 4567" />
              {errors.whatsapp && <small className="sp-error">{errors.whatsapp}</small>}
            </label>
            <label className="sp-field wide">
              <span>
                Correo <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('email')} type="email" placeholder="reservas@tulugar.co" />
              {errors.email && <small className="sp-error">{errors.email}</small>}
            </label>
          </div>
        </section>

        <label className="sp-check">
          <input type="checkbox" checked={form.is_listed} onChange={(e) => set({ is_listed: e.target.checked })} />
          <span>
            <strong>Mostrar mi lugar en Reservas</strong>
            <small>Desmárcalo para ocultarlo por un tiempo sin borrar nada (por ejemplo, si cierras por vacaciones).</small>
          </span>
        </label>

        {errors.server && (
          <p className="sp-error" role="alert">
            {errors.server}
          </p>
        )}
        <div className="sp-form-actions">
          {status === 'saved' && (
            <span className="sp-ok" role="status">
              <CheckCircle2 size={18} aria-hidden="true" /> Guardamos los cambios.
            </span>
          )}
          <button type="submit" className="sp-btn primary" disabled={status === 'saving' || uploading > 0}>
            {status === 'saving' && <Loader2 size={17} className="sp-spin" aria-hidden="true" />} {hotel ? 'Guardar cambios' : 'Publicar mi lugar'}
          </button>
        </div>
      </form>
    </div>
  );
}
