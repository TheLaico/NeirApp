import { CheckCircle2, ImagePlus, Loader2, Maximize2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import Lightbox from '../../components/common/Lightbox.jsx';
import { uploadImage } from '../../features/media/api.js';
import { isPaid } from '../../features/suppliers/model.js';
import { toDraft } from './CompanyView.jsx';

/**
 * "Catálogo": una sola imagen tipo brochure con los productos de la empresa (y si quiere, precios al por mayor).
 * Los clientes la abren con "Ver catálogo". Se guarda en cuanto se sube.
 */
export default function CatalogView({ user, supplier, paidUntil, onSave, onGo }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: '', bad: false });
  const [viewer, setViewer] = useState(false);
  const url = supplier?.catalog_url ?? '';

  if (!supplier) {
    return (
      <div className="spp-view">
        <div className="spp-head">
          <h1>Catálogo</h1>
          <p>Primero crea el perfil de tu empresa; después podrás subir tu catálogo.</p>
        </div>
        <button type="button" className="sp-btn primary spp-self" onClick={() => onGo('company')}>
          Crear mi empresa
        </button>
      </div>
    );
  }

  const save = async (catalogUrl, done) => {
    setBusy(true);
    setNotice({ text: '', bad: false });
    try {
      await onSave({ ...toDraft(supplier, user), catalog_url: catalogUrl });
      setNotice({ text: done, bad: false });
    } catch (err) {
      setNotice({ text: err.message, bad: true });
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadImage(file);
      await save(uploaded, 'Tu catálogo quedó actualizado.');
    } catch (err) {
      setNotice({ text: err.message, bad: true });
      setBusy(false);
    }
  };

  return (
    <div className="spp-view">
      <div className="spp-head">
        <h1>Catálogo</h1>
        <p>Sube una imagen tipo brochure con tus productos (y, si quieres, tus precios al por mayor). Los clientes la ven al tocar “Ver catálogo”.</p>
      </div>

      {!isPaid(paidUntil) && (
        <button type="button" className="spp-banner warn" onClick={() => onGo('subscription')}>
          Tu catálogo se publica mientras tu suscripción esté activa. Actívala en Suscripción.
        </button>
      )}
      {notice.text && (
        <p className={`spp-banner ${notice.bad ? 'bad' : 'ok'}`} role="status">
          {notice.bad ? null : <CheckCircle2 size={17} aria-hidden="true" />} {notice.text}
        </p>
      )}

      <div className="spp-catalog">
        <div className="spp-catalog-preview">
          {url ? (
            <button type="button" className="spp-catalog-img" onClick={() => setViewer(true)} aria-label="Ver catálogo en grande">
              <img src={url} alt="Tu catálogo" />
              <span className="spp-zoom" aria-hidden="true">
                <Maximize2 size={16} />
              </span>
            </button>
          ) : (
            <button type="button" className="spp-catalog-empty" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <Loader2 size={34} className="sp-spin" aria-hidden="true" /> : <ImagePlus size={34} aria-hidden="true" />}
              <strong>Subir mi catálogo</strong>
              <small>JPG, PNG o WebP, hasta 10 MB. Mejor vertical (tipo hoja o brochure).</small>
            </button>
          )}
        </div>
        <aside className="spp-catalog-tips">
          <h2>Consejos para un buen catálogo</h2>
          <ul>
            <li>Pon tu logo, teléfono y WhatsApp en la imagen.</li>
            <li>Agrupa los productos por tipo y muestra fotos claras.</li>
            <li>Si manejas precios al por mayor, indica la cantidad mínima.</li>
            <li>Usa letra grande: muchos lo verán desde el celular.</li>
          </ul>
          {url && (
            <div className="spp-catalog-actions">
              <button type="button" className="sp-btn primary" disabled={busy} onClick={() => input.current?.click()}>
                {busy ? <Loader2 size={16} className="sp-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />} Cambiar imagen
              </button>
              <button
                type="button"
                className="sp-btn outline danger"
                disabled={busy}
                onClick={() => window.confirm('¿Quitar tu catálogo? Los clientes ya no podrán verlo.') && save('', 'Quitamos tu catálogo.')}
              >
                <Trash2 size={16} aria-hidden="true" /> Quitar
              </button>
            </div>
          )}
        </aside>
      </div>
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
      {viewer && url && <Lightbox images={[{ id: 0, url, caption: 'Tu catálogo' }]} index={0} onIndex={() => {}} onClose={() => setViewer(false)} />}
    </div>
  );
}
