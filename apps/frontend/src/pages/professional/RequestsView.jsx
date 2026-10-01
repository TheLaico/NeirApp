import { CalendarCheck, CalendarClock, CheckCircle2, Clock, Inbox, Loader2, MapPin, MessageCircle, Phone, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { professionalsApi } from '../../features/professionals/api.js';
import { MODALITIES, REQUEST_STATUS, dateTimeLabel, dayLabel, isoToLocal, localToIso, sinceLabel, slotLabel, todayIso } from '../../features/professionals/appointments.js';
import { telLink, whatsappLink } from '../../features/professionals/directory.js';

const TABS = [
  { key: 'pending', label: 'Nuevas', empty: 'No tienes solicitudes nuevas. Cuando alguien te pida una cita desde tu perfil, aparecerá aquí.' },
  { key: 'scheduled', label: 'Agendadas', empty: 'No tienes citas agendadas. Acepta una solicitud para agendarla.' },
  { key: 'history', label: 'Historial', empty: 'Aquí verás las citas atendidas, rechazadas y canceladas.' },
];

// Agendadas: la más próxima primero. El resto (nuevas e historial) ya viene de la API, la más reciente primero.
const byTab = (list, tab) => {
  if (tab === 'pending') return list.filter((r) => r.status === 'pending');
  if (tab === 'scheduled') return list.filter((r) => r.status === 'scheduled').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  return list.filter((r) => !['pending', 'scheduled'].includes(r.status));
};

/**
 * "Citas y solicitudes": lo que las personas le piden al profesional desde su perfil. Las nuevas se aceptan poniendo
 * fecha y hora, o se rechazan; las agendadas se marcan como atendidas, se reprograman o se cancelan.
 * `requests` lo carga la página (también lo usan el inicio y la campana); `onChanged` lo vuelve a pedir.
 */
export default function RequestsView({ requests, onChange }) {
  const [tab, setTab] = useState('pending');
  const [notice, setNotice] = useState('');
  const { list, loading, error } = requests;
  const shown = byTab(list, tab);

  // Al cambiar de estado la tarjeta se va a otra pestaña: se avisa qué pasó (y al agendar, se muestra la agenda).
  const replace = (updated) => {
    const before = list.find((r) => r.id === updated.id);
    onChange(list.map((r) => (r.id === updated.id ? updated : r)));
    const first = updated.customer_name.split(' ')[0];
    if (updated.status === 'scheduled') {
      const when = dateTimeLabel(updated.scheduled_at);
      setNotice(`${before?.status === 'scheduled' ? 'Cita reprogramada' : 'Cita agendada'} con ${first}: ${when.charAt(0).toLowerCase()}${when.slice(1)}${when.endsWith('.') ? '' : '.'}`);
      setTab('scheduled');
    } else if (updated.status === 'rejected') setNotice(`Rechazaste la solicitud de ${first}.`);
    else if (updated.status === 'completed') setNotice(`Marcaste como atendida la cita con ${first}. Está en el historial.`);
    else if (updated.status === 'cancelled') setNotice(`Cancelaste la cita con ${first}.`);
  };

  return (
    <div className="rq">
      <div className="sv-head">
        <div>
          <h1>Citas y solicitudes</h1>
          <p>Las personas te escriben desde tu perfil en NeirAPP. Responde pronto: quien recibe respuesta el mismo día casi siempre agenda.</p>
        </div>
      </div>

      {notice && (
        <p className="sv-notice" role="status">
          {notice}
        </p>
      )}

      <div className="rq-tabs" role="tablist" aria-label="Solicitudes">
        {TABS.map(({ key, label }) => {
          const count = byTab(list, key).length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'on' : ''}
              onClick={() => {
                setTab(key);
                setNotice('');
              }}
            >
              {label}
              {key !== 'history' && count > 0 && <span className={`rq-tab-count${key === 'pending' ? ' hot' : ''}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {loading && list.length === 0 ? (
        <p className="cr-empty">Cargando…</p>
      ) : error && list.length === 0 ? (
        <p className="cr-error" role="alert">
          {error}
        </p>
      ) : shown.length === 0 ? (
        <section className="rq-empty">
          <Inbox size={34} aria-hidden="true" />
          <p>{TABS.find((t) => t.key === tab).empty}</p>
        </section>
      ) : (
        <ul className="rq-list">
          {shown.map((r) => (
            <RequestCard key={r.id} request={r} onUpdated={replace} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({ request: r, onUpdated }) {
  const [mode, setMode] = useState(null); // null, 'schedule', 'reject' o 'cancel'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = REQUEST_STATUS[r.status];
  const modality = MODALITIES[r.modality];

  const act = async (call) => {
    setBusy(true);
    setError('');
    try {
      onUpdated(await call());
      setMode(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rq-card ${status.tone}`}>
      <div className="rq-top">
        <div className="rq-who">
          <span className="rq-avatar" aria-hidden="true">
            {r.customer_name.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{r.customer_name}</strong>
            <small>Solicitud enviada {sinceLabel(r.created_at).toLowerCase()}</small>
          </div>
        </div>
        <span className={`rq-status ${status.tone}`}>{status.short}</span>
      </div>

      {r.status === 'scheduled' && (
        <p className="rq-when">
          <CalendarCheck size={18} aria-hidden="true" /> {dateTimeLabel(r.scheduled_at)}
        </p>
      )}

      <div className="rq-facts">
        {r.service_name && (
          <span>
            <Tag size={15} aria-hidden="true" /> {r.service_name}
          </span>
        )}
        <span>
          <modality.Icon size={15} aria-hidden="true" /> {modality.label}
        </span>
        {r.status === 'pending' && (
          <span>
            <Clock size={15} aria-hidden="true" /> Prefiere {r.preferred_date ? dayLabel(r.preferred_date) : 'cualquier día'} · {slotLabel(r.preferred_time).toLowerCase()}
          </span>
        )}
        {r.address && (
          <span>
            <MapPin size={15} aria-hidden="true" /> {r.address}
          </span>
        )}
      </div>

      <p className="rq-message">“{r.message}”</p>

      {r.note && (
        <p className="rq-note">
          <b>{r.status === 'cancelled' ? (r.cancelled_by_customer ? 'Motivo del cliente:' : 'Tu motivo:') : r.status === 'rejected' ? 'Tu motivo:' : 'Indicaciones:'}</b> {r.note}
        </p>
      )}
      {r.status === 'cancelled' && !r.note && <p className="rq-note muted">{r.cancelled_by_customer ? 'La persona canceló la solicitud.' : 'Cancelaste esta cita.'}</p>}

      {(r.status === 'pending' || r.status === 'scheduled') && (
        <div className="rq-contact">
          <a href={telLink(r.customer_phone)}>
            <Phone size={15} aria-hidden="true" /> Llamar
          </a>
          <a href={whatsappLink(r.customer_phone, `Hola ${r.customer_name.split(' ')[0]}, te escribo por tu solicitud en NeirAPP.`)} target="_blank" rel="noreferrer">
            <MessageCircle size={15} aria-hidden="true" /> WhatsApp
          </a>
        </div>
      )}

      {mode === 'schedule' && (
        <ScheduleForm initial={r.status === 'scheduled' ? isoToLocal(r.scheduled_at) : { date: r.preferred_date ?? '', time: '' }} initialNote={r.note} busy={busy} onCancel={() => setMode(null)} onSubmit={(iso, note) => act(() => professionalsApi.scheduleRequest(r.id, iso, note))} />
      )}
      {(mode === 'reject' || mode === 'cancel') && (
        <NoteForm
          label={mode === 'reject' ? 'Motivo (lo verá la persona, opcional)' : 'Motivo de la cancelación (opcional)'}
          placeholder={mode === 'reject' ? 'Ej: Esa semana no estoy en Neira' : 'Ej: Tuve una emergencia, escríbeme para reprogramar'}
          submitLabel={mode === 'reject' ? 'Rechazar solicitud' : 'Cancelar cita'}
          busy={busy}
          onCancel={() => setMode(null)}
          onSubmit={(note) => act(() => (mode === 'reject' ? professionalsApi.rejectRequest(r.id, note) : professionalsApi.cancelRequestAsProfessional(r.id, note)))}
        />
      )}

      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}

      {!mode && r.status === 'pending' && (
        <div className="rq-actions">
          <button type="button" className="cr-btn primary" onClick={() => setMode('schedule')}>
            <CalendarCheck size={17} aria-hidden="true" /> Aceptar y agendar
          </button>
          <button type="button" className="cr-btn ghost" onClick={() => setMode('reject')}>
            Rechazar
          </button>
        </div>
      )}
      {!mode && r.status === 'scheduled' && (
        <div className="rq-actions">
          <button type="button" className="cr-btn primary" disabled={busy} onClick={() => act(() => professionalsApi.completeRequest(r.id))}>
            {busy ? <Loader2 size={17} className="cr-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />} Marcar como atendida
          </button>
          <button type="button" className="cr-btn ghost" onClick={() => setMode('schedule')}>
            <CalendarClock size={17} aria-hidden="true" /> Reprogramar
          </button>
          <button type="button" className="cr-btn ghost danger-text" onClick={() => setMode('cancel')}>
            Cancelar cita
          </button>
        </div>
      )}
    </li>
  );
}

/** Fecha, hora e indicaciones para agendar (o reprogramar) la cita. */
function ScheduleForm({ initial, initialNote, busy, onCancel, onSubmit }) {
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [note, setNote] = useState(initialNote ?? '');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!date || !time) return setError('Elige la fecha y la hora de la cita.');
    const iso = localToIso(date, time);
    if (new Date(iso) <= new Date()) return setError('Esa fecha y hora ya pasaron.');
    setError('');
    onSubmit(iso, note);
  };

  return (
    <form className="rq-form" onSubmit={submit}>
      <div className="rq-form-row">
        <label>
          Fecha
          <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Hora
          <input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} required />
        </label>
      </div>
      <label>
        Indicaciones para la persona <span className="sv-optional">(opcional)</span>
        <input value={note} maxLength={300} placeholder="Ej: Llega 10 minutos antes y trae tus exámenes" onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <small className="pf-error">{error}</small>}
      <div className="rq-form-actions">
        <button type="button" className="sv-icon" aria-label="Cancelar" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
        <button type="submit" className="cr-btn primary" disabled={busy}>
          {busy && <Loader2 size={17} className="cr-spin" aria-hidden="true" />} Confirmar cita
        </button>
      </div>
    </form>
  );
}

function NoteForm({ label, placeholder, submitLabel, busy, onCancel, onSubmit }) {
  const [note, setNote] = useState('');
  return (
    <form
      className="rq-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note);
      }}
    >
      <label>
        {label}
        <input value={note} maxLength={300} placeholder={placeholder} onChange={(e) => setNote(e.target.value)} autoFocus />
      </label>
      <div className="rq-form-actions">
        <button type="button" className="sv-icon" aria-label="Volver" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
        <button type="submit" className="cr-btn danger" disabled={busy}>
          {busy && <Loader2 size={17} className="cr-spin" aria-hidden="true" />} {submitLabel}
        </button>
      </div>
    </form>
  );
}
