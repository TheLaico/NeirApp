import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { uploadImage } from '../../features/media/api.js';
import { suppliersApi } from '../../features/suppliers/api.js';
import { CATEGORIES, phoneLabel } from '../../features/suppliers/model.js';
import { useNavigate } from '../../lib/router.jsx';
import './suppliers.css';

const DESCRIPTION_MAX = 400;

const empty = (user) => ({
  company_name: '',
  tagline: '',
  category: '',
  description: '',
  phone: '',
  whatsapp: '',
  email: user.email ?? '',
  address: '',
  website: '',
  facebook: '',
  instagram: '',
  logo_url: '',
  cover_url: '',
  catalog_url: '',
  is_listed: true,
});

const fromApi = (s) => ({ ...s, phone: phoneLabel(s.phone), whatsapp: phoneLabel(s.whatsapp) });

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
 * "Mi empresa": el proveedor (autorizado por el administrador) arma su perfil: nombre, categoría, qué vende,
 * contacto, redes, logo, portada y su catálogo en una imagen tipo brochure. Se publica en /proveedores.
 */
export default function MySupplierPage({ user, onLogout }) {
  const navigate = useNavigate();
  const allowed = user.roles?.includes('supplier') || user.roles?.includes('admin');
  const [form, setForm] = useState(() => empty(user));
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!allowed) return;
    suppliersApi
      .mine()
      .then((s) => {
        setForm(fromApi(s));
        setExists(true);
      })
      .catch((err) => err.status !== 404 && setErrors({ server: err.message }))
      .finally(() => setLoading(false));
  }, [allowed]);

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
      const saved = await suppliersApi.saveMine(form);
      setForm(fromApi(saved));
      setExists(true);
      setStatus('saved');
    } catch (err) {
      const name = FIELD_OF[err.code];
      setErrors(name ? { [name]: err.message } : { server: err.message });
      setStatus('');
    }
  };

  return (
    <PageShell user={user} onLogout={onLogout} flush className="sp-view">
      <div className="sp-page">
        <button type="button" className="sp-back" onClick={() => navigate('/proveedores')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a Proveedores
        </button>
        <header className="sp-mine-head">
          <h1>Mi empresa</h1>
          <p>Así te verán los negocios y las personas de Neira en Proveedores. No hay carrito: te contactan directamente para cuadrar sus pedidos al por mayor.</p>
        </header>

        {!allowed ? (
          <p className="sp-empty">Esta sección es para empresas autorizadas como proveedor. Pídele a un administrador que autorice tu correo.</p>
        ) : loading ? (
          <p className="sp-empty">Cargando…</p>
        ) : (
          <form className="sp-form" onSubmit={submit} noValidate>
            <section className="sp-form-card">
              <h2>Imágenes</h2>
              <div className="sp-images">
                <ImageField label="Logo" hint="Cuadrado, con fondo claro." shape="square" value={form.logo_url} onChange={(url) => set({ logo_url: url })} />
                <ImageField label="Portada" hint="Una foto de tus productos (horizontal)." value={form.cover_url} onChange={(url) => set({ cover_url: url })} />
                <ImageField label="Catálogo" hint="Una imagen tipo brochure con tus productos y precios." shape="tall" value={form.catalog_url} onChange={(url) => set({ catalog_url: url })} />
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
                <small>Desmárcalo si quieres ocultarla por un tiempo sin borrar nada.</small>
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
                  <CheckCircle2 size={18} aria-hidden="true" /> {exists ? 'Guardamos los cambios.' : 'Tu empresa quedó publicada.'}
                </span>
              )}
              <button type="submit" className="sp-btn primary" disabled={status === 'saving'}>
                {status === 'saving' && <Loader2 size={17} className="sp-spin" aria-hidden="true" />} {exists ? 'Guardar cambios' : 'Publicar mi empresa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}

/** Subir, cambiar o quitar una imagen (logo, portada o catálogo). */
function ImageField({ label, hint, value, onChange, shape = 'wide' }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-image">
      <span className="sp-image-label">{label}</span>
      <button type="button" className={`sp-image-box ${shape}`} onClick={() => input.current?.click()} disabled={busy}>
        {value ? <img src={value} alt="" /> : <ImagePlus size={28} aria-hidden="true" />}
        {busy && (
          <span className="sp-image-busy">
            <Loader2 size={26} className="sp-spin" aria-label="Subiendo" />
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {value && (
        <button type="button" className="sp-image-remove" onClick={() => onChange('')}>
          <Trash2 size={14} aria-hidden="true" /> Quitar
        </button>
      )}
      {error ? <small className="sp-error">{error}</small> : <small className="sp-muted">{hint}</small>}
    </div>
  );
}
