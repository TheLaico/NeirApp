import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, phoneLabel } from '../../features/suppliers/model.js';
import ImageField from './ImageField.jsx';

const DESCRIPTION_MAX = 400;

/** Del perfil de la API (o vacío) al borrador del formulario. */
export const toDraft = (s, user) => ({
  company_name: s?.company_name ?? '',
  tagline: s?.tagline ?? '',
  category: s?.category ?? '',
  description: s?.description ?? '',
  phone: phoneLabel(s?.phone ?? ''),
  whatsapp: phoneLabel(s?.whatsapp ?? ''),
  email: s?.email ?? user?.email ?? '',
  address: s?.address ?? '',
  website: s?.website ?? '',
  facebook: s?.facebook ?? '',
  instagram: s?.instagram ?? '',
  logo_url: s?.logo_url ?? '',
  cover_url: s?.cover_url ?? '',
  catalog_url: s?.catalog_url ?? '',
  is_listed: s?.is_listed ?? true,
});

// Errores de la API → campo donde se muestran.
const FIELD_OF = {
  invalid_company_name: 'company_name',
  invalid_supplier_description: 'description',
  invalid_supplier_phone: 'phone',
  invalid_supplier_whatsapp: 'whatsapp',
  invalid_supplier_email: 'email',
  invalid_supplier_link: 'links',
  invalid_supplier_image: 'images',
};

/**
 * "Mi empresa": nombre, categoría, qué vende, contacto, redes, logo y portada. Así la ven los negocios y las personas
 * en Proveedores. El catálogo (brochure) se sube en su propia sección.
 */
export default function CompanyView({ user, supplier, onSave }) {
  const [form, setForm] = useState(() => toDraft(supplier, user));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');
  const exists = Boolean(supplier);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
    setStatus('');
  };
  const field = (name) => ({ value: form[name], onChange: (e) => set({ [name]: e.target.value }), 'aria-invalid': Boolean(errors[name]) });

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (form.company_name.trim().length < 2) found.company_name = 'Escribe el nombre de la empresa.';
    if (!form.category) found.category = 'Elige la categoría de tus productos.';
    if (form.description.trim().length < 20) found.description = 'Cuenta qué productos ofreces (al menos 20 letras).';
    if (form.phone.replace(/\D/g, '').length < 7) found.phone = 'Escribe un teléfono de contacto.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setStatus('saving');
    try {
      const saved = await onSave(form);
      setForm(toDraft(saved, user));
      setStatus('saved');
    } catch (err) {
      const name = FIELD_OF[err.code];
      setErrors(name ? { [name]: err.message } : { server: err.message });
      setStatus('');
    }
  };

  return (
    <div className="spp-view">
      <div className="spp-head">
        <h1>Mi empresa</h1>
        <p>Así te verán los negocios y las personas de Neira en Proveedores. No hay carrito: te contactan directamente para cuadrar sus pedidos al por mayor.</p>
      </div>
      <form className="sp-form" onSubmit={submit} noValidate>
        <section className="sp-form-card">
          <h2>Logo y portada</h2>
          <div className="spp-images">
            <ImageField label="Logo" hint="Cuadrado, con fondo claro." shape="square" value={form.logo_url} onChange={(url) => set({ logo_url: url })} />
            <ImageField label="Portada" hint="Una foto de tus productos, horizontal. Sale arriba de tu tarjeta." value={form.cover_url} onChange={(url) => set({ cover_url: url })} />
          </div>
          {errors.images && <small className="sp-error">{errors.images}</small>}
        </section>

        <section className="sp-form-card">
          <h2>Tu empresa</h2>
          <div className="sp-grid2">
            <label className="sp-field">
              Nombre de la empresa
              <input {...field('company_name')} maxLength={80} placeholder="Ej: Productos del Campo" />
              {errors.company_name && <small className="sp-error">{errors.company_name}</small>}
            </label>
            <label className="sp-field">
              Categoría
              <select {...field('category')}>
                <option value="">Elige una categoría</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {errors.category && <small className="sp-error">{errors.category}</small>}
            </label>
            <label className="sp-field wide">
              <span>
                Frase corta <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('tagline')} maxLength={80} placeholder="Ej: Alimentos al por mayor" />
            </label>
            <label className="sp-field wide">
              Descripción de tus productos
              <textarea {...field('description')} rows={4} maxLength={DESCRIPTION_MAX} placeholder="Qué vendes, a quién, pedido mínimo, si haces entregas…" />
              <small className="sp-count">
                {form.description.length}/{DESCRIPTION_MAX}
              </small>
              {errors.description && <small className="sp-error">{errors.description}</small>}
            </label>
          </div>
        </section>

        <section className="sp-form-card">
          <h2>Contacto y redes</h2>
          <div className="sp-grid2">
            <label className="sp-field">
              Teléfono
              <input {...field('phone')} type="tel" inputMode="tel" placeholder="606 851 2345 o 310 123 4567" />
              {errors.phone && <small className="sp-error">{errors.phone}</small>}
            </label>
            <label className="sp-field">
              <span>
                WhatsApp <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('whatsapp')} type="tel" inputMode="tel" placeholder="310 123 4567" />
              {errors.whatsapp && <small className="sp-error">{errors.whatsapp}</small>}
            </label>
            <label className="sp-field">
              <span>
                Correo <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('email')} type="email" placeholder="ventas@empresa.co" />
              {errors.email && <small className="sp-error">{errors.email}</small>}
            </label>
            <label className="sp-field">
              <span>
                Dirección <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('address')} maxLength={120} placeholder="Ej: Calle 10 # 8-20, Neira" />
            </label>
            <label className="sp-field">
              <span>
                Facebook <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('facebook')} placeholder="facebook.com/tuempresa o @tuempresa" />
            </label>
            <label className="sp-field">
              <span>
                Instagram <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('instagram')} placeholder="@tuempresa" />
            </label>
            <label className="sp-field wide">
              <span>
                Página web <span className="sp-optional">(opcional)</span>
              </span>
              <input {...field('website')} placeholder="www.tuempresa.co" />
            </label>
          </div>
          {errors.links && <small className="sp-error">{errors.links}</small>}
        </section>

        <label className="sp-check">
          <input type="checkbox" checked={form.is_listed} onChange={(e) => set({ is_listed: e.target.checked })} />
          <span>
            <strong>Mostrar mi empresa en Proveedores</strong>
            <small>Desmárcalo si quieres ocultarla por un tiempo sin borrar nada (tu suscripción sigue corriendo).</small>
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
          <button type="submit" className="sp-btn primary" disabled={status === 'saving'}>
            {status === 'saving' && <Loader2 size={17} className="sp-spin" aria-hidden="true" />} {exists ? 'Guardar cambios' : 'Crear mi empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}
