import { CalendarOff, CheckCircle2, Copy, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePolled } from '../../features/courier/api.js';
import { CLOSED_REASON, DAYS, formatDay, nextOpenText, toInputTime, todayInBogota } from '../../features/stores/schedule.js';
import { storesApi } from '../../features/stores/api.js';

const REASONS = ['Vacaciones', 'Feriado', 'Día de descanso'];

/** Horario por defecto al empezar: lunes a sábado de 8:00 a. m. a 8:00 p. m., domingo cerrado. */
const defaults = () => DAYS.map((_, weekday) => ({ weekday, is_open: weekday !== 6, all_day: false, opens: '08:00', closes: '20:00' }));

/** Semana del servidor → filas editables (horas como "HH:MM" para los campos de hora). */
const fromServer = (days) =>
  days.length === 7
    ? days.map((d) => ({ weekday: d.weekday, is_open: d.is_open, all_day: d.all_day, opens: toInputTime(d.opens) || '08:00', closes: toInputTime(d.closes) || '20:00' }))
    : defaults();

/** Filas editables → lo que pide el servidor: los días cerrados y los de 24 horas no mandan horas. */
const toServer = (rows) =>
  rows.map((r) => {
    if (!r.is_open) return { weekday: r.weekday, is_open: false };
    if (r.all_day) return { weekday: r.weekday, is_open: true, all_day: true };
    return { weekday: r.weekday, is_open: true, all_day: false, opens: r.opens, closes: r.closes };
  });

/** ¿Abre todos los días, las 24 horas? */
const is247 = (rows) => rows.every((r) => r.is_open && r.all_day);

function StatusCard({ schedule }) {
  return (
    <section className="cr-card">
      <div className="cr-card-head">
        <strong>Ahora mismo</strong>
        <span className={`cr-chip ${schedule.is_open ? 'ok' : ''}`}>{schedule.is_open ? 'Abierta' : 'Cerrada'}</span>
      </div>
      {schedule.is_open ? (
        <p className="cr-muted">{schedule.is_24_7 ? 'Atiendes las 24 horas, todos los días. ' : ''}Tus clientes pueden hacerte pedidos.</p>
      ) : (
        <>
          <p className="cr-muted">{CLOSED_REASON[schedule.closed_reason]} Los clientes no pueden pedirte por ahora.</p>
          {schedule.next_open_at && schedule.closed_reason !== 'manual' && <p className="cr-ok">Vuelves a abrir {nextOpenText(schedule.next_open_at)}</p>}
        </>
      )}
    </section>
  );
}

/** Editor del horario semanal: cada día abre o no, y a qué horas. */
function WeekEditor({ store, schedule, onChanged }) {
  const [rows, setRows] = useState(() => fromServer(schedule.days));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Si el horario cambia desde el servidor (guardar, quitar), se vuelve a leer.
  useEffect(() => setRows(fromServer(schedule.days)), [schedule.days]);

  const set = (weekday, patch) => {
    setSaved(false);
    setRows((list) => list.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  };
  const dirty = JSON.stringify(toServer(rows)) !== JSON.stringify(toServer(fromServer(schedule.days))) || !schedule.has_hours;
  const invalid = rows.find((r) => r.is_open && !r.all_day && (!r.opens || !r.closes || r.opens >= r.closes));
  const always = is247(rows);
  // Al encender 24/7 se recuerda el horario que había, para devolverlo si el comerciante se arrepiente.
  const before = useRef(null);

  const toggle247 = () => {
    setSaved(false);
    if (always) {
      setRows(before.current ?? defaults());
    } else {
      before.current = rows;
      setRows((list) => list.map((r) => ({ ...r, is_open: true, all_day: true })));
    }
  };

  const copyMonday = () => {
    const monday = rows[0];
    setSaved(false);
    setRows((list) => list.map((r) => ({ ...r, is_open: monday.is_open, all_day: monday.all_day, opens: monday.opens, closes: monday.closes })));
  };

  const save = async () => {
    if (invalid) return setError(`${DAYS[invalid.weekday]}: la hora de apertura debe ser anterior a la de cierre.`);
    setError('');
    setSaving(true);
    try {
      await storesApi.setSchedule(store.id, toServer(rows));
      await onChanged();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('¿Quitar tu horario? Tu tienda volverá a estar abierta todo el día mientras el interruptor esté encendido.')) return;
    setError('');
    setSaving(true);
    try {
      await storesApi.clearSchedule(store.id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cr-card">
      <h2>Horario de atención</h2>
      <p className="cr-muted">
        {schedule.is_24_7
          ? 'Tu tienda atiende todo el día, todos los días. Solo se cierra con el interruptor o en los días que marques.'
          : schedule.has_hours
            ? 'Fuera de estas horas tu tienda aparece cerrada y no recibe pedidos.'
            : 'Todavía no tienes horario: tu tienda está abierta todo el día. Define uno para que tus clientes sepan cuándo atiendes.'}
      </p>

      <div className="cr-247">
        <div className="cr-switch-row">
          <div>
            <strong>Abierto 24/7</strong>
            <small>Todos los días, las 24 horas</small>
          </div>
          <button type="button" role="switch" aria-checked={always} aria-label="Abierto las 24 horas, todos los días" className={`a-switch${always ? ' on' : ''}`} onClick={toggle247}>
            <span />
          </button>
        </div>
      </div>

      <ul className="cr-list">
        {rows.map((r) => (
          <li key={r.weekday} className="cr-day">
            <div className="cr-switch-row">
              <strong>{DAYS[r.weekday]}</strong>
              <div className="cr-row">
                <small>{r.is_open ? 'Abierto' : 'Cerrado'}</small>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.is_open}
                  aria-label={`${DAYS[r.weekday]}: ${r.is_open ? 'abierto' : 'cerrado'}`}
                  className={`a-switch${r.is_open ? ' on' : ''}`}
                  onClick={() => set(r.weekday, { is_open: !r.is_open })}
                >
                  <span />
                </button>
              </div>
            </div>
            {r.is_open && (
              <label className="cr-check">
                <input type="checkbox" checked={r.all_day} onChange={(e) => set(r.weekday, { all_day: e.target.checked })} />
                Las 24 horas
              </label>
            )}
            {r.is_open && !r.all_day && (
              <div className="cr-times">
                <label>
                  Abre
                  <input type="time" value={r.opens} aria-label={`${DAYS[r.weekday]}: hora de apertura`} onChange={(e) => set(r.weekday, { opens: e.target.value })} />
                </label>
                <label>
                  Cierra
                  <input type="time" value={r.closes} aria-label={`${DAYS[r.weekday]}: hora de cierre`} onChange={(e) => set(r.weekday, { closes: e.target.value })} />
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>

      <button type="button" className="cr-link-btn" onClick={copyMonday}>
        <Copy size={16} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
        Copiar el horario del lunes a todos los días
      </button>

      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      {saved && !dirty && (
        <p className="cr-ok" role="status">
          <CheckCircle2 size={16} aria-hidden="true" /> Horario guardado
        </p>
      )}
      <div className="cr-actions">
        {schedule.has_hours && (
          <button type="button" className="cr-btn ghost sm" disabled={saving} onClick={clear}>
            Quitar horario
          </button>
        )}
        <button type="button" className="cr-btn primary sm" disabled={saving || !dirty} onClick={save}>
          {saving && <Loader2 size={16} className="cr-spin" aria-hidden="true" />}
          Guardar horario
        </button>
      </div>
    </section>
  );
}

/** Días puntuales en que la tienda no abre (vacaciones, feriados, descanso…). */
function ClosedDates({ store, schedule, onChanged }) {
  const [day, setDay] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    if (!day) return setError('Elige la fecha en que no vas a abrir.');
    setError('');
    setBusy(true);
    try {
      await storesApi.addClosedDate(store.id, day, reason.trim());
      await onChanged();
      setDay('');
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (isoDay) => {
    setError('');
    try {
      await storesApi.removeClosedDate(store.id, isoDay);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="cr-card">
      <h2>Días que no vas a abrir</h2>
      <p className="cr-muted">Avísale a tus clientes con tiempo: ese día tu tienda aparece cerrada aunque tu horario diga que abres.</p>

      <form className="cr-form" onSubmit={add} noValidate>
        <label>
          Fecha
          <input type="date" value={day} min={todayInBogota()} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label>
          Motivo (opcional)
          <input value={reason} maxLength={120} placeholder="Ej: Vacaciones" onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="cr-chips">
          {REASONS.map((r) => (
            <button key={r} type="button" className={reason === r ? 'on' : ''} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        {error && (
          <p className="cr-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="cr-btn primary" disabled={busy}>
          {busy ? <Loader2 size={18} className="cr-spin" aria-hidden="true" /> : <CalendarOff size={18} aria-hidden="true" />}
          Marcar día sin atención
        </button>
      </form>

      {schedule.closed_dates.length === 0 ? (
        <p className="cr-muted">No tienes días marcados.</p>
      ) : (
        <ul className="cr-lines cr-closed">
          {schedule.closed_dates.map((c) => (
            <li key={c.day}>
              <span>
                <strong>{formatDay(c.day)}</strong>
                {c.reason && <small> · {c.reason}</small>}
              </span>
              <button type="button" className="a-icon-btn danger" aria-label={`Quitar el cierre del ${formatDay(c.day)}`} onClick={() => remove(c.day)}>
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Horarios: cuándo abre la tienda y los días en que no va a abrir. */
export default function ScheduleView({ store, onStoreChanged }) {
  const { data: schedule, error, loading, refresh } = usePolled(() => storesApi.schedule(store.id), { every: 60000 });

  // Al cambiar el horario también cambia el estado de la tienda (abierta/cerrada) que muestra el resto del panel.
  const changed = async () => {
    await refresh();
    await onStoreChanged?.();
  };

  if (loading) return <p className="cr-empty">Cargando horario…</p>;
  if (error && !schedule) {
    return (
      <p className="cr-error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <>
      <StatusCard schedule={schedule} />
      <WeekEditor store={store} schedule={schedule} onChanged={changed} />
      <ClosedDates store={store} schedule={schedule} onChanged={changed} />
    </>
  );
}
