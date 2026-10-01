import { Clock, EyeOff, Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import SolidIcon from '../../components/icons/Solid.jsx';
import { professionalsApi } from '../../features/professionals/api.js';
import {
  DURATIONS,
  MAX_SERVICES,
  PRICE_KINDS,
  SERVICE_DESCRIPTION_MAX,
  SERVICE_IDEAS,
  durationLabel,
  emptyService,
  fromApi,
  groupThousands,
  onlyDigits,
  priceLabel,
  toApi,
  validateService,
} from '../../features/professionals/services.js';

// Errores de la API → campo del formulario.
const ERROR_FIELDS = { invalid_service_name: 'name', invalid_service_price: 'price', invalid_service_duration: 'duration' };

/**
 * "Mis servicios": lo que ofrece el profesional (consultas, visitas, asesorías…) con su precio de referencia. Los
 * visibles salen en su página "Ver perfil"; los ocultos quedan guardados para usarlos después.
 */
export default function ServicesView({ onGoProfile }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [editing, setEditing] = useState(null); // null, 'new' o el id del servicio que se edita
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await professionalsApi.myServices();
      setState({ list: data.map(fromApi), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (service) => setState((s) => ({ ...s, list: s.list.map((x) => (x.id === service.id ? service : x)) }));

  const onSaved = (service, isNew) => {
    setState((s) => ({ ...s, list: isNew ? [...s.list, service] : s.list.map((x) => (x.id === service.id ? service : x)) }));
    setEditing(null);
    setNotice(isNew ? `“${service.name}” quedó agregado.` : 'Cambios guardados.');
  };

  const toggleActive = async (service) => {
    setNotice('');
    const next = { ...service, active: !service.active };
    replace(next); // se ve al instante; si falla, se revierte
    try {
      replace(fromApi(await professionalsApi.updateService(service.id, toApi(next))));
    } catch (err) {
      replace(service);
      setNotice(err.message);
    }
  };

  const remove = async (service) => {
    if (!window.confirm(`¿Eliminar el servicio “${service.name}”?`)) return;
    setNotice('');
    try {
      await professionalsApi.deleteService(service.id);
      setState((s) => ({ ...s, list: s.list.filter((x) => x.id !== service.id) }));
      if (editing === service.id) setEditing(null);
    } catch (err) {
      setNotice(err.message);
    }
  };

  const { list } = state;
  const visible = list.filter((s) => s.active).length;
  const full = list.length >= MAX_SERVICES;

  return (
    <div className="sv">
      <div className="sv-head">
        <div>
          <h1>Mis servicios</h1>
          <p>Cuéntales a las personas de Neira qué ofreces y cuánto cuesta. Los servicios visibles aparecen en tu perfil.</p>
        </div>
        {editing !== 'new' && list.length > 0 && (
          <button type="button" className="cr-btn primary sv-add" disabled={full} onClick={() => setEditing('new')}>
            <Plus size={18} aria-hidden="true" /> Agregar servicio
          </button>
        )}
      </div>

      {notice && (
        <p className="sv-notice" role="status">
          {notice}
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
          {editing === 'new' && <ServiceForm key="new" onCancel={() => setEditing(null)} onSaved={(s) => onSaved(s, true)} />}

          {list.length === 0 && editing !== 'new' ? (
            <section className="sv-empty">
              <span className="sv-empty-ico">
                <SolidIcon name="briefcase" size={34} />
              </span>
              <h2>Todavía no has agregado servicios</h2>
              <p>Agrega lo que ofreces —una consulta, una visita a domicilio, una asesoría— con su precio. Así la gente sabe qué esperar antes de escribirte.</p>
              <button type="button" className="cr-btn primary" onClick={() => setEditing('new')}>
                <Plus size={18} aria-hidden="true" /> Agregar mi primer servicio
              </button>
            </section>
          ) : (
            list.length > 0 && (
              <>
                <p className="sv-count">
                  {list.length} {list.length === 1 ? 'servicio' : 'servicios'} · {visible} {visible === 1 ? 'visible' : 'visibles'} en tu perfil
                  {full && ' · llegaste al máximo de 30'}
                </p>
                <ul className="sv-list">
                  {list.map((s) =>
                    editing === s.id ? (
                      <li key={s.id}>
                        <ServiceForm initial={s} onCancel={() => setEditing(null)} onSaved={(saved) => onSaved(saved, false)} />
                      </li>
                    ) : (
                      <li key={s.id} className={`sv-item${s.active ? '' : ' hidden'}`}>
                        <div className="sv-item-main">
                          <div className="sv-item-top">
                            <strong>{s.name}</strong>
                            <span className={`sv-price${s.priceKind === 'quote' ? ' quote' : ''}`}>{priceLabel(s)}</span>
                          </div>
                          {s.description && <p>{s.description}</p>}
                          <div className="sv-meta">
                            {s.duration && (
                              <span>
                                <Clock size={14} aria-hidden="true" /> {durationLabel(s.duration)}
                              </span>
                            )}
                            {!s.active && (
                              <span className="sv-hidden-tag">
                                <EyeOff size={14} aria-hidden="true" /> Oculto
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="sv-item-actions">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={s.active}
                            aria-label={`${s.name}: ${s.active ? 'visible en tu perfil' : 'oculto'}`}
                            title={s.active ? 'Visible en tu perfil' : 'Oculto'}
                            className={`a-switch${s.active ? ' on' : ''}`}
                            onClick={() => toggleActive(s)}
                          >
                            <span />
                          </button>
                          <button type="button" className="sv-icon" aria-label={`Editar ${s.name}`} onClick={() => setEditing(s.id)}>
                            <Pencil size={17} aria-hidden="true" />
                          </button>
                          <button type="button" className="sv-icon danger" aria-label={`Eliminar ${s.name}`} onClick={() => remove(s)}>
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </>
            )
          )}

          <aside className="sv-tip">
            <Sparkles size={20} aria-hidden="true" />
            <p>
              Un precio de referencia genera confianza. Si depende del caso, usa <b>“Desde”</b> o <b>“A convenir”</b>. Revisa también que tu{' '}
              <button type="button" onClick={onGoProfile}>
                perfil
              </button>{' '}
              esté completo.
            </p>
          </aside>
        </>
      )}
    </div>
  );
}

/** Formulario para agregar o editar un servicio. Guarda contra la API y devuelve el servicio guardado. */
function ServiceForm({ initial, onCancel, onSaved }) {
  const [draft, setDraft] = useState(initial ?? emptyService());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const isNew = !initial;
  const prefix = initial?.id ?? 'new';

  const update = (patch) => {
    setServerError('');
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      if ('priceKind' in patch) delete next.price;
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateService(draft);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(`sv-${prefix}-${first}`)?.focus();
    setSaving(true);
    try {
      const body = toApi(draft);
      const saved = isNew ? await professionalsApi.addService(body) : await professionalsApi.updateService(initial.id, body);
      onSaved(fromApi(saved));
    } catch (err) {
      const key = ERROR_FIELDS[err.code];
      if (key) setErrors({ [key]: err.message });
      else setServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sv-form" onSubmit={submit} noValidate>
      <div className="sv-form-head">
        <h2>{isNew ? 'Nuevo servicio' : 'Editar servicio'}</h2>
        <button type="button" className="sv-icon" aria-label="Cancelar" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <label>
        Nombre del servicio
        <input id={`sv-${prefix}-name`} value={draft.name} maxLength={80} placeholder="Ej: Consulta de medicina general" aria-invalid={Boolean(errors.name)} onChange={(e) => update({ name: e.target.value })} autoFocus />
        {errors.name && <small className="pf-error">{errors.name}</small>}
      </label>
      {isNew && !draft.name && (
        <div className="sv-ideas" aria-label="Ideas">
          {SERVICE_IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => update({ name: idea })}>
              {idea}
            </button>
          ))}
        </div>
      )}

      <label>
        <span>
          Descripción <span className="sv-optional">(opcional)</span>
        </span>
        <textarea className="cr-textarea" rows={3} maxLength={SERVICE_DESCRIPTION_MAX} value={draft.description} placeholder="Qué incluye, para quién es, qué debe llevar la persona…" onChange={(e) => update({ description: e.target.value })} />
        <small className="pf-count">
          {draft.description.length}/{SERVICE_DESCRIPTION_MAX}
        </small>
      </label>

      <fieldset className="sv-price-field">
        <legend>Precio</legend>
        <div className="sv-segment" role="radiogroup" aria-label="Tipo de precio">
          {PRICE_KINDS.map(({ key, label }) => (
            <button key={key} type="button" role="radio" aria-checked={draft.priceKind === key} className={draft.priceKind === key ? 'on' : ''} onClick={() => update({ priceKind: key })}>
              {label}
            </button>
          ))}
        </div>
        {draft.priceKind !== 'quote' && (
          <div className="sv-money">
            <span aria-hidden="true">$</span>
            <input
              id={`sv-${prefix}-price`}
              inputMode="numeric"
              aria-label="Precio en pesos"
              placeholder="80.000"
              value={groupThousands(draft.price)}
              aria-invalid={Boolean(errors.price)}
              onChange={(e) => update({ price: onlyDigits(e.target.value) })}
            />
            <span className="sv-money-unit">COP</span>
          </div>
        )}
        {errors.price && <small className="pf-error">{errors.price}</small>}
      </fieldset>

      <div className="sv-form-row">
        <label>
          <span>
            Duración <span className="sv-optional">(opcional)</span>
          </span>
          <select id={`sv-${prefix}-duration`} value={draft.duration} onChange={(e) => update({ duration: e.target.value })}>
            <option value="">Sin indicar</option>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {durationLabel(m)}
              </option>
            ))}
          </select>
          {errors.duration && <small className="pf-error">{errors.duration}</small>}
        </label>
        <div className="sv-visible">
          <span>
            <strong>Visible en mi perfil</strong>
            <small>Ocúltalo si por ahora no lo ofreces.</small>
          </span>
          <button type="button" role="switch" aria-checked={draft.active} aria-label="Visible en mi perfil" className={`a-switch${draft.active ? ' on' : ''}`} onClick={() => update({ active: !draft.active })}>
            <span />
          </button>
        </div>
      </div>

      {serverError && (
        <p className="pf-error" role="alert">
          {serverError}
        </p>
      )}
      <div className="sv-form-actions">
        <button type="button" className="cr-btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="cr-btn primary" disabled={saving}>
          {saving && <Loader2 size={18} className="cr-spin" aria-hidden="true" />}
          {isNew ? 'Agregar servicio' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
