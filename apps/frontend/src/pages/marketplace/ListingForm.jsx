import { CalendarDays, ImagePlus, Loader2, Star, Tag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadImage } from '../../features/media/api.js';
import { CATEGORIES, RENT_PERIODS } from '../../features/marketplace/model.js';

const MAX_PHOTOS = 8;
const MAX_DESCRIPTION = 1000;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// "+573101234567" → "310 123 4567".
const localPhone = (phone) =>
  (phone ?? '')
    .replace(/\D/g, '')
    .replace(/^57(?=\d{10}$)/, '')
    .replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

const empty = (user) => ({
  photos: [],
  title: '',
  kind: 'sale',
  rentPeriod: 'month',
  price: '',
  negotiable: false,
  category: '',
  quantity: '1',
  description: '',
  whatsapp: localPhone(user.phone),
});

const fromItem = (item) => ({
  photos: item.photos,
  title: item.title,
  kind: item.kind,
  rentPeriod: item.rent_period,
  price: item.price_cop == null ? '' : String(item.price_cop),
  negotiable: item.negotiable,
  category: item.category,
  quantity: String(item.quantity),
  description: item.description,
  whatsapp: localPhone(item.whatsapp),
});

// Errores de la API → campo donde se muestran.
const FIELD_OF = {
  invalid_listing_title: 'title',
  invalid_listing_price: 'price',
  invalid_listing_quantity: 'quantity',
  invalid_listing_description: 'description',
  invalid_listing_photos: 'photos',
  invalid_seller_phone: 'whatsapp',
};

const digits = (s) => s.replace(/\D/g, '');

/** Formulario para publicar o editar un mueble (ventana sobre "Mis publicaciones"). */
export default function ListingForm({ user, item, onSave, onClose }) {
  const [form, setForm] = useState(() => (item ? fromItem(item) : empty(user)));
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      delete next.server;
      return next;
    });
  };

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

  const validate = () => {
    const found = {};
    if (form.photos.length === 0) found.photos = 'Agrega al menos una foto del mueble.';
    if (form.title.trim().length < 3) found.title = 'Escribe el nombre del mueble.';
    if (!form.category) found.category = 'Elige una categoría.';
    if (!form.negotiable && !digits(form.price)) found.price = 'Escribe el precio o marca que lo negocias por chat.';
    if (form.price && !(Number(digits(form.price)) > 0)) found.price = 'Escribe un precio válido.';
    if (!(Number(form.quantity) >= 1 && Number(form.quantity) <= 999)) found.quantity = 'Entre 1 y 999.';
    if (form.description.trim().length < 10) found.description = 'Cuenta cómo es el mueble (al menos 10 letras).';
    if (!/^3\d{9}$/.test(digits(form.whatsapp).replace(/^57(?=\d{10}$)/, ''))) found.whatsapp = 'Escribe un WhatsApp de 10 dígitos.';
    return found;
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      box.current?.querySelector('[aria-invalid="true"], .mq-photos-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        kind: form.kind,
        rent_period: form.rentPeriod,
        price_cop: digits(form.price) ? Number(digits(form.price)) : null,
        negotiable: form.negotiable,
        category: form.category,
        quantity: Number(form.quantity),
        description: form.description.trim(),
        photos: form.photos,
        whatsapp: form.whatsapp,
      });
    } catch (err) {
      const field = FIELD_OF[err.code];
      setErrors(field ? { [field]: err.message } : { server: err.message });
      setSaving(false);
    }
  };

  const priceText = form.price ? Number(digits(form.price)).toLocaleString('es-CO') : '';

  return (
    <div className="mq-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="mq-dialog wide" role="dialog" aria-modal="true" aria-labelledby="mq-form-title">
        <div className="mq-dialog-head">
          <h2 id="mq-form-title">{item ? 'Editar publicación' : 'Publicar un mueble'}</h2>
          <button type="button" className="mq-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <form className="mq-form" onSubmit={submit} noValidate>
          <fieldset>
            <legend>Fotos</legend>
            <ul className="mq-photos">
              {form.photos.map((url, n) => (
                <li key={url}>
                  <img src={url} alt={`Foto ${n + 1}`} />
                  {n === 0 ? (
                    <span className="mq-cover">
                      <Star size={11} fill="currentColor" aria-hidden="true" /> Portada
                    </span>
                  ) : (
                    <button type="button" className="mq-cover-btn" onClick={() => set({ photos: [url, ...form.photos.filter((p) => p !== url)] })}>
                      Usar de portada
                    </button>
                  )}
                  <button type="button" className="mq-photo-remove" aria-label={`Quitar foto ${n + 1}`} onClick={() => set({ photos: form.photos.filter((p) => p !== url) })}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {Array.from({ length: uploading }, (_, n) => (
                <li key={`up-${n}`} className="mq-photo-loading">
                  <Loader2 size={24} className="mq-spin" aria-label="Subiendo foto" />
                </li>
              ))}
              {form.photos.length + uploading < MAX_PHOTOS && (
                <li>
                  <button type="button" className="mq-photo-add" onClick={() => fileInput.current?.click()}>
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
            {errors.photos ? <small className="mq-error mq-photos-error">{errors.photos}</small> : <small className="mq-help">Hasta {MAX_PHOTOS} fotos con buena luz. La primera es la portada.</small>}
          </fieldset>

          <label className="mq-field">
            Nombre del mueble
            <input value={form.title} maxLength={80} placeholder="Ej: Sofá moderno en L" aria-invalid={Boolean(errors.title)} onChange={(e) => set({ title: e.target.value })} />
            {errors.title && <small className="mq-error">{errors.title}</small>}
          </label>

          <fieldset>
            <legend>¿Lo vendes o lo alquilas?</legend>
            <div className="mq-chips" role="radiogroup">
              {[
                { id: 'sale', label: 'Venta', Icon: Tag },
                { id: 'rent', label: 'Alquiler', Icon: CalendarDays },
              ].map(({ id, label, Icon }) => (
                <button key={id} type="button" role="radio" aria-checked={form.kind === id} className={form.kind === id ? 'on' : ''} onClick={() => set({ kind: id })}>
                  <Icon size={16} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mq-row">
            <label className="mq-field">
              {form.kind === 'rent' ? 'Precio del alquiler' : 'Precio'} {form.negotiable && <span className="mq-optional">(opcional)</span>}
              <span className="mq-money">
                <span aria-hidden="true">$</span>
                <input inputMode="numeric" value={priceText} placeholder="0" aria-invalid={Boolean(errors.price)} onChange={(e) => set({ price: digits(e.target.value).slice(0, 10) })} />
              </span>
              {errors.price && <small className="mq-error">{errors.price}</small>}
            </label>
            {form.kind === 'rent' && (
              <label className="mq-field">
                Cobro
                <select value={form.rentPeriod} onChange={(e) => set({ rentPeriod: e.target.value })}>
                  {RENT_PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="mq-check">
            <input type="checkbox" checked={form.negotiable} onChange={(e) => set({ negotiable: e.target.checked, price: form.price })} />
            <span>
              <strong>Precio negociable por chat</strong>
              <small>Las personas te escriben por WhatsApp para acordar el precio.</small>
            </span>
          </label>

          <div className="mq-row">
            <label className="mq-field">
              Categoría
              <select value={form.category} aria-invalid={Boolean(errors.category)} onChange={(e) => set({ category: e.target.value })}>
                <option value="">Elige una categoría</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {errors.category && <small className="mq-error">{errors.category}</small>}
            </label>
            <label className="mq-field">
              Cantidad disponible
              <input type="number" min={1} max={999} value={form.quantity} aria-invalid={Boolean(errors.quantity)} onChange={(e) => set({ quantity: e.target.value })} />
              {errors.quantity && <small className="mq-error">{errors.quantity}</small>}
            </label>
          </div>

          <label className="mq-field">
            Descripción
            <textarea rows={4} maxLength={MAX_DESCRIPTION} value={form.description} placeholder="Material, medidas, estado, si incluye transporte…" aria-invalid={Boolean(errors.description)} onChange={(e) => set({ description: e.target.value })} />
            <small className="mq-count">
              {form.description.length}/{MAX_DESCRIPTION}
            </small>
            {errors.description && <small className="mq-error">{errors.description}</small>}
          </label>

          <label className="mq-field">
            WhatsApp para que te escriban
            <input type="tel" inputMode="tel" value={form.whatsapp} placeholder="310 123 4567" aria-invalid={Boolean(errors.whatsapp)} onChange={(e) => set({ whatsapp: e.target.value })} />
            {errors.whatsapp ? <small className="mq-error">{errors.whatsapp}</small> : <small className="mq-help">El botón “Chat con vendedor” abre WhatsApp con este número.</small>}
          </label>

          {errors.server && (
            <p className="mq-error" role="alert">
              {errors.server}
            </p>
          )}
          <div className="mq-dialog-actions">
            <button type="button" className="mq-btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="mq-btn primary" disabled={saving || uploading > 0}>
              {saving && <Loader2 size={17} className="mq-spin" aria-hidden="true" />} {item ? 'Guardar cambios' : 'Guardar publicación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
