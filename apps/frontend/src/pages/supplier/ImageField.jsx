import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadImage } from '../../features/media/api.js';

/** Subir, cambiar o quitar una imagen (logo, portada o catálogo). */
export default function ImageField({ label, hint, value, onChange, shape = 'wide' }) {
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
