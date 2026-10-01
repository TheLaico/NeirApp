import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadImage } from '../../features/media/api.js';

/**
 * Selector de foto: muestra la actual, deja elegir una nueva (cámara o galería en el celular) y quitarla.
 * `value` es la URL guardada ('' o null si no hay); `onChange(url)` recibe la URL nueva o '' al quitarla.
 */
export default function ImagePicker({ value, onChange, label = 'Foto', hint, shape = 'wide' }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir de nuevo la misma foto
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cr-image">
      <span className="cr-image-label">{label}</span>
      <div className={`cr-image-box ${shape}`}>
        {value ? <img src={value} alt="" /> : <span className="cr-image-empty">Sin foto</span>}
        {busy && (
          <span className="cr-image-busy" role="status">
            <Loader2 size={28} className="cr-spin" aria-label="Subiendo foto" />
          </span>
        )}
      </div>
      <div className="cr-actions">
        <button type="button" className="cr-btn ghost sm" disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlus size={17} aria-hidden="true" />
          {value ? 'Cambiar foto' : 'Subir foto'}
        </button>
        {value && (
          <button type="button" className="cr-btn danger sm" disabled={busy} onClick={() => onChange('')}>
            <Trash2 size={17} aria-hidden="true" />
            Quitar
          </button>
        )}
      </div>
      {hint && !error && <small className="cr-muted">{hint}</small>}
      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
    </div>
  );
}
