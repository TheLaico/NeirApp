import { BadgeCheck, CheckCircle2, ChevronRight, MapPin, MessageCircle, Phone, Sparkles, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import ImagePicker from '../../components/mobile/ImagePicker.jsx';
import { useProfessionalCategories } from '../../features/professionals/categories.js';
import { DESCRIPTION_MAX, MODALITIES, TITLES, displayName, missingItems, validateProfile } from '../../features/professionals/profile.js';

/**
 * "Mi perfil": el profesional llena sus datos (foto, presentación, área, descripción, contacto y horario) y a la derecha
 * ve cómo quedará su tarjeta en el directorio de /profesionales. Los cambios se aplican al tocar "Guardar cambios".
 */
export default function ProfileView({ profile, onSave }) {
  const [categories] = useProfessionalCategories();
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const category = categories.find((c) => c.id === draft.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === draft.subcategoryId);
  const missing = useMemo(() => missingItems(draft), [draft]);

  const update = (patch) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
    // Al corregir un campo se borra su error; el resto se revisa al guardar.
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const field = (key) => ({ id: `pf-${key}`, value: draft[key], onChange: (e) => update({ [key]: e.target.value }), 'aria-invalid': Boolean(errors[key]) });

  const submit = (e) => {
    e.preventDefault();
    const found = validateProfile(draft);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`pf-${first}`)?.focus();
      return;
    }
    onSave({ ...draft, fullName: draft.fullName.trim(), email: draft.email.trim() });
    setSaved(true);
  };

  const goTo = (key) => {
    const el = document.getElementById(`pf-${key}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };

  return (
    <form className="pf" onSubmit={submit} noValidate>
      <div className="pf-head">
        <h1>Mi perfil</h1>
        <p>Esta es la información que verán las personas de Neira cuando busquen un profesional como tú.</p>
      </div>

      <div className="pf-layout">
        <div className="pf-sections">
          <section className="pf-card" aria-labelledby="pf-s1">
            <h2 id="pf-s1">
              <span className="pf-step">1</span> Foto y presentación
            </h2>
            <div className="pf-photo-row">
              <div id="pf-photo" tabIndex={-1} className="pf-photo">
                <ImagePicker label="Tu foto" shape="square" value={draft.photo} hint="Una foto de frente, con buena luz, genera más confianza." onChange={(photo) => update({ photo })} />
              </div>
              <div className="pf-grid">
                <label className="pf-narrow">
                  Título
                  <select {...field('title')}>
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t || 'Sin título'}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Nombre completo" error={errors.fullName}>
                  <input {...field('fullName')} maxLength={80} autoComplete="name" placeholder="Ej: Andrés Patiño" />
                </Field>
                <Field label="Frase de presentación" hint="Lo primero que leen debajo de tu nombre." wide>
                  <input {...field('headline')} maxLength={90} placeholder="Ej: Médico general con enfoque en salud familiar" />
                </Field>
              </div>
            </div>
          </section>

          <section className="pf-card" aria-labelledby="pf-s2">
            <h2 id="pf-s2">
              <span className="pf-step">2</span> Información profesional
            </h2>
            <div className="pf-grid">
              <Field label="Área" error={errors.categoryId}>
                <select {...field('categoryId')} onChange={(e) => update({ categoryId: e.target.value, subcategoryId: '' })}>
                  <option value="">Elige tu área</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Especialidad">
                <select {...field('subcategoryId')} disabled={!category || category.subcategories.length === 0}>
                  <option value="">{category ? 'Elige tu especialidad' : 'Primero elige tu área'}</option>
                  {category?.subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Años de experiencia" error={errors.experienceYears}>
                <input {...field('experienceYears')} type="number" inputMode="numeric" min={0} max={70} placeholder="Ej: 5" />
              </Field>
              <Field label="Descripción" hint="Cuenta qué haces, a quién atiendes y qué te diferencia." wide>
                <textarea {...field('description')} className="cr-textarea" rows={5} maxLength={DESCRIPTION_MAX} placeholder="Ej: Atiendo consulta general para niños y adultos, control de enfermedades crónicas y certificados médicos…" />
                <small className="pf-count">
                  {draft.description.length}/{DESCRIPTION_MAX}
                </small>
              </Field>
              <fieldset className="pf-wide pf-modes" id="pf-modalities" tabIndex={-1} aria-invalid={Boolean(errors.modalities)}>
                <legend>¿Cómo atiendes?</legend>
                <div className="pf-chips">
                  {MODALITIES.map(({ key, label }) => (
                    <label key={key} className={`pf-chip${draft.modalities[key] ? ' on' : ''}`}>
                      <input type="checkbox" checked={draft.modalities[key]} onChange={(e) => update({ modalities: { ...draft.modalities, [key]: e.target.checked } })} />
                      {draft.modalities[key] && <CheckCircle2 size={16} aria-hidden="true" />}
                      {label}
                    </label>
                  ))}
                </div>
                {errors.modalities && <small className="pf-error">{errors.modalities}</small>}
              </fieldset>
            </div>
          </section>

          <section className="pf-card" aria-labelledby="pf-s3">
            <h2 id="pf-s3">
              <span className="pf-step">3</span> Contacto y horario
            </h2>
            <div className="pf-grid">
              <Field label="Celular" error={errors.phone}>
                <input {...field('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="310 123 4567" />
              </Field>
              <Field label="WhatsApp" error={errors.whatsapp} hint={!errors.whatsapp && draft.whatsapp === draft.phone && draft.phone ? 'Igual a tu celular.' : undefined}>
                <input {...field('whatsapp')} type="tel" inputMode="tel" placeholder="310 123 4567" />
              </Field>
              <Field label="Correo de contacto" error={errors.email} wide>
                <input {...field('email')} type="email" inputMode="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" />
              </Field>
              <Field label="Dirección del consultorio u oficina" hint="Déjala vacía si solo atiendes a domicilio o de forma virtual." wide>
                <input {...field('address')} maxLength={120} placeholder="Ej: Calle 10 # 8-25, segundo piso, Neira" />
              </Field>
              <Field label="Horario de atención" wide>
                <input {...field('schedule')} maxLength={120} placeholder="Ej: Lunes a viernes de 8:00 a. m. a 5:00 p. m." />
              </Field>
            </div>
          </section>

          <section className="pf-card pf-available">
            <div className="cr-switch-row">
              <div>
                <strong>Disponible para nuevos clientes</strong>
                <small>Si lo apagas, sigues apareciendo pero con la etiqueta “No disponible”.</small>
              </div>
              <button type="button" role="switch" aria-checked={draft.available} aria-label="Disponible para nuevos clientes" className={`a-switch${draft.available ? ' on' : ''}`} onClick={() => update({ available: !draft.available })}>
                <span />
              </button>
            </div>
          </section>
        </div>

        <aside className="pf-side">
          <section className="pf-card pf-preview" aria-labelledby="pf-prev">
            <h2 id="pf-prev">Así te ven los clientes</h2>
            <article className="pf-pro">
              <div className="pf-avatar">{draft.photo ? <img src={draft.photo} alt="" /> : <User size={34} aria-hidden="true" />}</div>
              <h3>
                {displayName(draft) || 'Tu nombre'}
                <BadgeCheck size={18} aria-hidden="true" className="pf-verified" />
              </h3>
              <span className={`pf-status${draft.available ? ' on' : ''}`}>
                <i aria-hidden="true" />
                {draft.available ? 'Disponible' : 'No disponible'}
              </span>
              <p className="pf-specialty">{subcategory?.label ?? category?.label ?? 'Tu especialidad'}</p>
              {draft.headline && <p className="pf-headline">{draft.headline}</p>}
              <p className="pf-info">
                {draft.experienceYears !== '' && `${draft.experienceYears} ${Number(draft.experienceYears) === 1 ? 'año' : 'años'} de experiencia · `}
                <MapPin size={13} aria-hidden="true" /> Neira, Caldas
              </p>
              <div className="pf-pro-actions" aria-hidden="true">
                <span>
                  <Phone size={14} /> Llamar
                </span>
                <span className="wa">
                  <MessageCircle size={14} /> WhatsApp
                </span>
              </div>
            </article>
          </section>

          <section className="pf-card pf-todo" aria-labelledby="pf-todo">
            <h2 id="pf-todo">
              <Sparkles size={18} aria-hidden="true" /> {missing.length ? 'Para destacar más' : '¡Tu perfil está completo!'}
            </h2>
            {missing.length ? (
              <ul>
                {missing.map((m) => (
                  <li key={m.field}>
                    <button type="button" onClick={() => goTo(m.field)}>
                      <span className="pf-dot" aria-hidden="true" />
                      {m.label}
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cr-muted">Tienes todo lo que los clientes buscan. Mantenlo al día.</p>
            )}
          </section>
        </aside>
      </div>

      <div className={`pf-bar${dirty ? ' dirty' : ''}`}>
        {saved && !dirty ? (
          <p className="pf-saved" role="status">
            <CheckCircle2 size={18} aria-hidden="true" /> Cambios guardados
          </p>
        ) : (
          <p className="pf-hint">{dirty ? 'Tienes cambios sin guardar.' : 'Todo está guardado.'}</p>
        )}
        <div className="pf-bar-actions">
          {dirty && (
            <button
              type="button"
              className="cr-btn ghost"
              onClick={() => {
                setDraft(profile);
                setErrors({});
              }}
            >
              Descartar
            </button>
          )}
          <button type="submit" className="cr-btn primary" disabled={!dirty}>
            Guardar cambios
          </button>
        </div>
      </div>
    </form>
  );
}

/** Campo con su etiqueta, ayuda y error. `wide` lo hace ocupar las dos columnas. */
function Field({ label, hint, error, wide = false, children }) {
  return (
    <label className={wide ? 'pf-wide' : undefined}>
      {label}
      {children}
      {error ? <small className="pf-error">{error}</small> : hint && <small className="pf-help">{hint}</small>}
    </label>
  );
}
