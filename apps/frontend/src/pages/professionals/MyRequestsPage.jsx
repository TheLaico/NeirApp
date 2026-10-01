import { ArrowLeft, CalendarCheck, CalendarX, Clock, Inbox, Loader2, MapPin, Tag } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { professionalsApi } from '../../features/professionals/api.js';
import { MODALITIES, REQUEST_STATUS, dateTimeLabel, dayLabel, sinceLabel, slotLabel } from '../../features/professionals/appointments.js';
import { useNavigate } from '../../lib/router.jsx';
import './subcategory-page.css';
import './my-requests.css';

/** "Mis solicitudes": las citas que la persona les pidió a profesionales, con su estado; las abiertas se pueden cancelar. */
export default function MyRequestsPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setState({ list: await professionalsApi.sentRequests(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (r) => {
    if (!window.confirm(`¿Cancelar tu solicitud con ${r.professional_name}?`)) return;
    setBusyId(r.id);
    try {
      const updated = await professionalsApi.cancelRequest(r.id);
      setState((s) => ({ ...s, list: s.list.map((x) => (x.id === r.id ? { ...x, ...updated } : x)) }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setBusyId(null);
    }
  };

  const open = state.list.filter((r) => ['pending', 'scheduled'].includes(r.status));
  const past = state.list.filter((r) => !['pending', 'scheduled'].includes(r.status));

  return (
    <PageShell user={user} onLogout={onLogout} hideCart>
      <div className="subcat-page mr">
        <button type="button" className="subcat-back" onClick={() => navigate('/profesionales')}>
          <ArrowLeft size={18} aria-hidden="true" />
          Volver a Profesionales
        </button>
        <h1>Mis solicitudes de cita</h1>
        <p className="mr-sub">Aquí ves si el profesional ya respondió y para cuándo quedó tu cita.</p>

        {state.error && (
          <p className="a-empty" role="alert">
            {state.error}
          </p>
        )}
        {state.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : state.list.length === 0 ? (
          <section className="mr-empty">
            <Inbox size={34} aria-hidden="true" />
            <p>Todavía no le has pedido una cita a ningún profesional.</p>
            <button type="button" className="subcat-btn" onClick={() => navigate('/profesionales')}>
              Buscar un profesional
            </button>
          </section>
        ) : (
          <>
            {open.length > 0 && <h2 className="mr-title">En curso</h2>}
            <ul className="mr-list">
              {open.map((r) => (
                <RequestRow key={r.id} r={r} busy={busyId === r.id} onCancel={() => cancel(r)} onOpen={() => navigate(`/profesionales/perfil?id=${r.professional_id}`)} />
              ))}
            </ul>
            {past.length > 0 && <h2 className="mr-title">Anteriores</h2>}
            <ul className="mr-list">
              {past.map((r) => (
                <RequestRow key={r.id} r={r} onOpen={() => navigate(`/profesionales/perfil?id=${r.professional_id}`)} />
              ))}
            </ul>
          </>
        )}
      </div>
    </PageShell>
  );
}

function RequestRow({ r, busy, onCancel, onOpen }) {
  const status = REQUEST_STATUS[r.status];
  const modality = MODALITIES[r.modality];
  return (
    <li className={`mr-card ${status.tone}`}>
      <div className="mr-top">
        <button type="button" className="mr-name" onClick={onOpen}>
          {r.professional_name}
        </button>
        <span className={`rq-status ${status.tone}`}>{status.label}</span>
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
            <Clock size={15} aria-hidden="true" /> Pediste {r.preferred_date ? dayLabel(r.preferred_date) : 'cualquier día'} · {slotLabel(r.preferred_time).toLowerCase()}
          </span>
        )}
        {r.address && (
          <span>
            <MapPin size={15} aria-hidden="true" /> {r.address}
          </span>
        )}
      </div>
      {r.note && (
        <p className="rq-note">
          <b>{r.status === 'scheduled' ? 'Indicaciones:' : r.cancelled_by_customer ? 'Tu motivo:' : 'Respuesta:'}</b> {r.note}
        </p>
      )}
      <div className="mr-bottom">
        <small>Enviada {sinceLabel(r.created_at).toLowerCase()}</small>
        {onCancel && (
          <button type="button" className="mr-cancel" disabled={busy} onClick={onCancel}>
            {busy ? <Loader2 size={15} className="cr-spin" aria-hidden="true" /> : <CalendarX size={15} aria-hidden="true" />} Cancelar
          </button>
        )}
      </div>
    </li>
  );
}
