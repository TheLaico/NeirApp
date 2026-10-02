import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Maximize2, Star, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Lightbox from '../../components/common/Lightbox.jsx';
import { uploadImage } from '../../features/media/api.js';
import { professionalsApi } from '../../features/professionals/api.js';

const MAX_CAPTION = 140;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * "Galería de imágenes": fotos del trabajo del profesional (su consultorio, obras, antes y después…). Se suben a la API
 * de imágenes y luego se agregan a su galería; la primera es la portada. Los clientes las ven en "Ver perfil".
 * `max` es el máximo de fotos de su plan (Básico 3, Profesional 20, Premium sin límite práctico).
 */
export default function GalleryView({ max = 3, planName = '', onCountChange, onPlans }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [uploading, setUploading] = useState(0); // fotos que se están subiendo ahora
  const [notice, setNotice] = useState({ text: '', bad: false });
  const [dragOver, setDragOver] = useState(false);
  const [viewer, setViewer] = useState(null);
  const input = useRef(null);
  const { list } = state;

  const setList = useCallback((updater) => setState((s) => ({ ...s, list: typeof updater === 'function' ? updater(s.list) : updater })), []);

  const load = useCallback(async () => {
    try {
      setState({ list: await professionalsApi.myGallery(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!state.loading) onCountChange?.(list.length);
  }, [list.length, state.loading, onCountChange]);

  // Sube una por una (así no se pasa del máximo y cada error se informa por separado).
  const addFiles = async (fileList) => {
    const room = max - list.length;
    const files = [...fileList].filter((f) => TYPES.includes(f.type));
    const skipped = fileList.length - files.length;
    const batch = files.slice(0, Math.max(room, 0));
    if (!batch.length) {
      setNotice({ text: room <= 0 ? `Ya tienes ${max} fotos, el máximo de tu plan. Borra alguna o mejora tu plan.` : 'Elige fotos JPG, PNG o WebP.', bad: true });
      return;
    }
    setNotice({ text: '', bad: false });
    let added = 0;
    let failed = '';
    setUploading(batch.length);
    for (const file of batch) {
      try {
        const url = await uploadImage(file);
        const image = await professionalsApi.addGalleryImage({ url, caption: '' });
        setList((l) => [...l, image]);
        added += 1;
      } catch (err) {
        failed = err.message;
      }
      setUploading((n) => n - 1);
    }
    const extra = files.length - batch.length;
    const parts = [];
    if (added) parts.push(added === 1 ? 'Se agregó 1 foto.' : `Se agregaron ${added} fotos.`);
    if (failed) parts.push(`No se pudo subir alguna: ${failed}`);
    if (extra > 0) parts.push(`${extra} no cupieron (tu plan permite ${max}).`);
    if (skipped > 0) parts.push(`${skipped} no eran fotos JPG, PNG o WebP.`);
    setNotice({ text: parts.join(' '), bad: Boolean(failed || extra || skipped) });
  };

  // Aplica un orden nuevo al instante y lo guarda; si falla, vuelve como estaba.
  const reorder = async (next) => {
    const previous = list;
    setList(next);
    try {
      setList(await professionalsApi.reorderGallery(next.map((i) => i.id)));
    } catch (err) {
      setList(previous);
      setNotice({ text: err.message, bad: true });
    }
  };

  const move = (index, step) => {
    const target = index + step;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next);
  };

  // La pasa al principio sin desordenar las demás.
  const makeCover = (index) => reorder([list[index], ...list.filter((_, n) => n !== index)]);

  const remove = async (image) => {
    if (!window.confirm('¿Eliminar esta foto de tu galería?')) return;
    try {
      await professionalsApi.deleteGalleryImage(image.id);
      setList((l) => l.filter((i) => i.id !== image.id));
    } catch (err) {
      setNotice({ text: err.message, bad: true });
    }
  };

  const full = list.length >= max;
  const unlimited = max >= 100;

  return (
    <div className="gl">
      <div className="sv-head">
        <div>
          <h1>Galería de imágenes</h1>
          <p>Muestra tu trabajo: tu consultorio, proyectos terminados, el antes y el después. Las personas confían más cuando pueden ver lo que haces.</p>
        </div>
        {!state.loading && !state.error && (
          <span className={`gl-count${full ? ' full' : ''}`}>{unlimited ? `${list.length} ${list.length === 1 ? 'foto' : 'fotos'}` : `${list.length} de ${max}`}</span>
        )}
      </div>

      {notice.text && (
        <p className={`sv-notice${notice.bad ? ' bad' : ''}`} role="status">
          {notice.text}
        </p>
      )}

      {state.loading ? (
        <p className="cr-empty">Cargando…</p>
      ) : state.error ? (
        <div className="cr-state">
          <p className="cr-error" role="alert">
            {state.error}
          </p>
          <button type="button" className="cr-btn ghost" onClick={load}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={`gl-drop${dragOver ? ' over' : ''}${list.length ? ' compact' : ''}`}
            disabled={full || uploading > 0}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!full && !uploading) addFiles(e.dataTransfer.files);
            }}
          >
            <span className="gl-drop-ico">{uploading ? <Loader2 size={30} className="cr-spin" aria-hidden="true" /> : <ImagePlus size={30} aria-hidden="true" />}</span>
            <span className="gl-drop-text">
              <strong>{uploading ? `Subiendo ${uploading} ${uploading === 1 ? 'foto' : 'fotos'}…` : full ? `Llegaste al máximo de ${max} fotos de tu plan${planName ? ` ${planName}` : ''}` : 'Subir fotos'}</strong>
              {!uploading && !full && <small>Toca para elegir o arrástralas aquí · JPG, PNG o WebP, hasta 10 MB cada una</small>}
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) addFiles(files);
              e.target.value = '';
            }}
          />

          {full && onPlans && (
            <button type="button" className="gl-upgrade" onClick={onPlans}>
              ¿Necesitas más fotos? El plan Profesional permite 20 y el Premium no tiene límite. Ver planes
            </button>
          )}
          {list.length === 0 && !uploading ? (
            <p className="gl-empty">Todavía no tienes fotos. La primera que subas será la portada de tu galería.</p>
          ) : (
            <ul className="gl-grid">
              {list.map((image, index) => (
                <li key={image.id} className="gl-tile">
                  <div className="gl-photo">
                    <img src={image.url} alt={image.caption || `Foto ${index + 1}`} loading="lazy" />
                    {index === 0 && (
                      <span className="gl-cover">
                        <Star size={12} fill="currentColor" aria-hidden="true" /> Portada
                      </span>
                    )}
                    <button type="button" className="gl-zoom" aria-label={`Ver foto ${index + 1} en grande`} onClick={() => setViewer(index)}>
                      <Maximize2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <CaptionField image={image} onSaved={(saved) => setList((l) => l.map((i) => (i.id === saved.id ? saved : i)))} />
                  <div className="gl-actions">
                    <button type="button" className="sv-icon" aria-label="Mover a la izquierda" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowLeft size={17} aria-hidden="true" />
                    </button>
                    <button type="button" className="sv-icon" aria-label="Mover a la derecha" disabled={index === list.length - 1} onClick={() => move(index, 1)}>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                    {index > 0 && (
                      <button type="button" className="gl-make-cover" onClick={() => makeCover(index)}>
                        Usar de portada
                      </button>
                    )}
                    <button type="button" className="sv-icon danger" aria-label={`Eliminar foto ${index + 1}`} onClick={() => remove(image)}>
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
              {Array.from({ length: uploading }, (_, n) => (
                <li key={`up-${n}`} className="gl-tile gl-uploading" aria-hidden="true">
                  <div className="gl-photo">
                    <Loader2 size={28} className="cr-spin" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {viewer !== null && <Lightbox images={list} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

/** Pie de foto: se guarda al salir del campo o con Enter. */
function CaptionField({ image, onSaved }) {
  const [value, setValue] = useState(image.caption);
  const [status, setStatus] = useState(''); // '', 'saving', 'saved' o un mensaje de error

  const save = async () => {
    if (value.trim() === image.caption) return;
    setStatus('saving');
    try {
      const saved = await professionalsApi.setGalleryCaption(image.id, value);
      onSaved(saved);
      setValue(saved.caption);
      setStatus('saved');
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <label className="gl-caption">
      <input
        aria-label="Pie de foto"
        value={value}
        maxLength={MAX_CAPTION}
        placeholder="Agrega una descripción…"
        onChange={(e) => {
          setValue(e.target.value);
          setStatus('');
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      {status === 'saving' && <Loader2 size={15} className="cr-spin gl-caption-state" aria-label="Guardando" />}
      {status === 'saved' && <Check size={15} className="gl-caption-state ok" aria-label="Guardado" />}
      {status && status !== 'saving' && status !== 'saved' && <small className="pf-error">{status}</small>}
    </label>
  );
}
