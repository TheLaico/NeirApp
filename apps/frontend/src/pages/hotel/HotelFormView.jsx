import { CheckCircle2, Eye, ImagePlus, Loader2, MapPin, Star, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { NeiraMap } from '../../features/map/NeiraMap.jsx';
import { uploadImage } from '../../features/media/api.js';
import { AMENITIES, KINDS, MAX_PHOTOS, inNeira, phoneLabel } from '../../features/lodging/model.js';

const DESCRIPTION_MAX = 1000;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const toDraft = (h, user) => ({
  name: h?.name ?? '',
  kind: h?.kind ?? 'hotel',
  tagline: h?.tagline ?? '',
  description: h?.description ?? '',
  address: h?.address ?? '',
  lat: h?.lat ?? null,
  lng: h?.lng ?? null,
  phone: phoneLabel(h?.phone ?? ''),
  whatsapp: phoneLabel(h?.whatsapp ?? ''),
  email: h?.email ?? user?.email ?? '',
  price_from_cop: h?.price_from_cop ? String(h.price_from_cop) : '',
  photos: h?.photos ?? [],
  amenities: h?.amenities ?? [],
  check_in: h?.check_in ?? '15:00',
  check_out: h?.check_out ?? '12:00',
  is_listed: h?.is_listed ?? true,
});

// Errores de la API → campo donde se muestran.
const FIELD_OF = {
  invalid_hotel_name: 'name',
  invalid_hotel_description: 'description',
  invalid_hotel_location: 'location',
  invalid_hotel_phone: 'phone',
  invalid_hotel_whatsapp: 'whatsapp',
  invalid_hotel_email: 'email',
  invalid_hotel_price: 'price_from_cop',
  invalid_hotel_photos: 'photos',
};

/** "Mi hotel": la ficha que ven los turistas en Hospedaje, con fotos, servicios y el punto en el mapa de Neira. */
export default function HotelFormView({ user, hotel, onSave, onPublic }) {
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

  const toggleAmenity = (id) => set({ amenities: form.amenities.includes(id) ? form.amenities.filter((a) => a !== id) : [...form.amenities, id] });

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (form.photos.length === 0) found.photos = 'Agrega al menos una foto de tu hotel.';
    if (form.name.trim().length < 2) found.name = 'Escribe el nombre del hotel.';
    if (form.description.trim().length < 20) found.description = 'Cuenta cómo es tu hotel (al menos 20 letras).';
    if (!form.address.trim()) found.address = 'Escribe la dirección o la vereda.';
    if (form.lat === null) found.location = 'Toca el mapa para marcar dónde queda tu hotel.';
    if (form.phone.replace(/\D/g, '').length < 7) found.phone = 'Escribe un teléfono de contacto.';
    if (!(Number(form.price_from_cop) > 0)) found.price_from_cop = 'Escribe el precio por noche más bajo.';
    setErrors(found);
    if (Object.keys(found).length) {
      setTimeout(() => box.current?.querySelector('[aria-invalid="true"], .sp-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
      return;
    }
    setStatus('saving');
    try {
      const saved = await onSave({ ...form, price_from_cop: Number(form.price_from_cop) });
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
          <h1>Mi hotel</h1>
          <p>Así te verán los turistas en Hospedaje: tus fotos, lo que ofreces, el precio por noche y dónde quedas en el mapa de Neira.</p>
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
          {errors.photos ? <small className="sp-error">{errors.photos}</small> : <small className="sp-muted">Hasta {MAX_PHOTOS} fotos: fachada, habitaciones, piscina, vista… La principal sale en la lista.</small>}
        </section>

        <section className="sp-form-card">
          <h2>Tu hotel</h2>
          <div className="sp-grid2">
            <label className="sp-field">
              Nombre
              <input {...field('name')} maxLength={80} placeholder="Ej: Hotel Mirador de Neira" />
              {errors.name && <small className="sp-error">{errors.name}</small>}
            </label>
            <label className="sp-field">
              Tipo de hospedaje
              <select {...field('kind')}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sp-field wide">
              <span>
                Frase corta <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('tagline')} maxLength={100} placeholder="Ej: Tu descanso con la mejor vista de Neira" />
            </label>
            <label className="sp-field wide">
              Descripción
              <textarea {...field('description')} rows={5} maxLength={DESCRIPTION_MAX} placeholder="Habitaciones, capacidad, qué hay cerca, planes, políticas…" />
              <small className="sp-count">
                {form.description.length}/{DESCRIPTION_MAX}
              </small>
              {errors.description && <small className="sp-error">{errors.description}</small>}
            </label>
            <label className="sp-field">
              Precio por noche desde (COP)
              <input {...field('price_from_cop')} inputMode="numeric" placeholder="180000" onChange={(e) => set({ price_from_cop: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
              {errors.price_from_cop && <small className="sp-error">{errors.price_from_cop}</small>}
            </label>
            <div className="sp-grid2 htp-times">
              <label className="sp-field">
                Llegada desde
                <input type="time" {...field('check_in')} />
              </label>
              <label className="sp-field">
                Salida hasta
                <input type="time" {...field('check_out')} />
              </label>
            </div>
          </div>
        </section>

        <section className="sp-form-card">
          <h2>Servicios</h2>
          <ul className="htp-amenities">
            {AMENITIES.map(({ id, label, Icon }) => {
              const on = form.amenities.includes(id);
              return (
                <li key={id}>
                  <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggleAmenity(id)}>
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
            <MapPin size={15} aria-hidden="true" /> Toca el mapa en el punto exacto de tu hotel. Así aparece en "Ver mapa" de Hospedaje.
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
              <input {...field('email')} type="email" placeholder="reservas@tuhotel.co" />
              {errors.email && <small className="sp-error">{errors.email}</small>}
            </label>
          </div>
        </section>

        <label className="sp-check">
          <input type="checkbox" checked={form.is_listed} onChange={(e) => set({ is_listed: e.target.checked })} />
          <span>
            <strong>Mostrar mi hotel en Hospedaje</strong>
            <small>Desmárcalo para ocultarlo por un tiempo sin borrar nada (por ejemplo, si cierras por temporada).</small>
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
            {status === 'saving' && <Loader2 size={17} className="sp-spin" aria-hidden="true" />} {hotel ? 'Guardar cambios' : 'Publicar mi hotel'}
          </button>
        </div>
      </form>
    </div>
  );
}
