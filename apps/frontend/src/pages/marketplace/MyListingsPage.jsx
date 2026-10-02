import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Eye, Hourglass, Loader2, Pencil, Plus, Receipt, Sofa, Trash2, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { marketplaceApi } from '../../features/marketplace/api.js';
import { KINDS, LISTING_DAYS, LISTING_FEE, priceLabel, unitsLabel } from '../../features/marketplace/model.js';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { PAYMENT } from '../professional/plans.js';
import ListingForm from './ListingForm.jsx';
import './marketplace.css';

const day = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

/** En qué está cada publicación, para la etiqueta y el aviso de su tarjeta. */
function statusOf(item) {
  const paid = item.paid_until && new Date(item.paid_until) > new Date();
  if (item.removed) return { tone: 'bad', Icon: XCircle, label: 'Retirada por NeirAPP', text: item.removed_note ? `Motivo: ${item.removed_note.replace(/\.$/, '')}.` : '' };
  if (item.pending_payment) return { tone: 'wait', Icon: Hourglass, label: 'Pago en revisión', text: 'Estamos confirmando tu pago; te avisaremos cuando quede publicada.' };
  if (paid && item.is_active) return { tone: 'ok', Icon: CheckCircle2, label: 'Publicada', text: `Se ve en MarquetNeira hasta el ${day(item.paid_until)}.` };
  if (paid) return { tone: 'paused', Icon: Clock, label: 'Pausada', text: `Nadie la ve. Tienes pagado hasta el ${day(item.paid_until)}.` };
  if (item.rejected_payment) return { tone: 'bad', Icon: AlertTriangle, label: 'Pago no confirmado', text: `${item.rejected_payment.note.replace(/\.$/, '')}. Revisa el pago y vuelve a enviarlo.` };
  if (item.paid_until) return { tone: 'warn', Icon: AlertTriangle, label: 'Vencida', text: `Dejó de verse el ${day(item.paid_until)}. Paga otro mes para volver a publicarla.` };
  return { tone: 'warn', Icon: AlertTriangle, label: 'Sin publicar', text: `Paga el primer mes (${formatCop(LISTING_FEE)}) para que la gente la vea.` };
}

/**
 * "Mis publicaciones" de MarquetNeira: cualquiera publica sus inmuebles, los edita, los pausa (vendido, sin unidades)
 * o los elimina, y paga $ 10.000 al mes por cada uno para que se vean. NeirAPP no maneja inventario.
 */
export default function MyListingsPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [editing, setEditing] = useState(() => (new URLSearchParams(window.location.search).get('nueva') ? 'new' : null));
  const [paying, setPaying] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState({ text: '', bad: false });

  const load = useCallback(async () => {
    try {
      setState({ list: await marketplaceApi.mine(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (updated) => setState((s) => ({ ...s, list: s.list.map((i) => (i.id === updated.id ? updated : i)) }));

  const save = async (body) => {
    if (editing === 'new') {
      const created = await marketplaceApi.create(body);
      setState((s) => ({ ...s, list: [created, ...s.list] }));
      setEditing(null);
      setPaying(created); // lo siguiente es pagar el primer mes
    } else {
      replace(await marketplaceApi.update(editing.id, body));
      setEditing(null);
      setNotice({ text: 'Guardamos los cambios.', bad: false });
    }
  };

  const run = async (key, action, done) => {
    setBusy(key);
    setNotice({ text: '', bad: false });
    try {
      await action();
      if (done) setNotice({ text: done, bad: false });
    } catch (err) {
      setNotice({ text: err.message, bad: true });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (item) =>
    run(item.id, async () => replace(await marketplaceApi.setActive(item.id, !item.is_active)), item.is_active ? `Pausaste “${item.title}”: nadie más la ve.` : `“${item.title}” vuelve a estar visible.`);

  const remove = (item) => {
    if (!window.confirm(`¿Eliminar “${item.title}”? Esta acción no se puede deshacer.`)) return;
    run(
      item.id,
      async () => {
        await marketplaceApi.remove(item.id);
        setState((s) => ({ ...s, list: s.list.filter((i) => i.id !== item.id) }));
      },
      'Eliminamos la publicación.',
    );
  };

  const cancelPayment = (item) =>
    run(item.id, async () => replace(await marketplaceApi.cancelPayment(item.pending_payment.id)), 'Cancelaste el pago en revisión.');

  return (
    <PageShell user={user} onLogout={onLogout} flush className="mq-view">
      <div className="mq-page">
        <button type="button" className="mq-back" onClick={() => navigate('/marquetneira')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a MarquetNeira
        </button>
        <header className="mq-mine-head">
          <div>
            <h1>Mis publicaciones</h1>
            <p>
              Publicar cuesta <b>{formatCop(LISTING_FEE)} al mes</b> por cada inmueble. NeirAPP solo te conecta con los compradores: el trato y el pago los haces tú por WhatsApp.
            </p>
          </div>
          <button type="button" className="mq-btn primary" onClick={() => setEditing('new')}>
            <Plus size={17} aria-hidden="true" /> Publicar un inmueble
          </button>
        </header>

        {notice.text && (
          <p className={`mq-banner${notice.bad ? ' bad' : ' ok'}`} role="status">
            {notice.text}
          </p>
        )}

        {state.loading ? (
          <p className="mq-empty">Cargando…</p>
        ) : state.error ? (
          <div className="mq-empty">
            <p role="alert">{state.error}</p>
            <button type="button" className="mq-btn outline" onClick={load}>
              Reintentar
            </button>
          </div>
        ) : state.list.length === 0 ? (
          <div className="mq-empty">
            <Sofa size={40} aria-hidden="true" />
            <p>Todavía no has publicado inmuebles. ¿Tienes alguno para vender o alquilar?</p>
            <button type="button" className="mq-btn primary" onClick={() => setEditing('new')}>
              <Plus size={17} aria-hidden="true" /> Publicar un inmueble
            </button>
          </div>
        ) : (
          <ul className="mq-mine">
            {state.list.map((item) => {
              const st = statusOf(item);
              const paid = item.paid_until && new Date(item.paid_until) > new Date();
              const isBusy = busy === item.id;
              return (
                <li key={item.id} className="mq-mine-item">
                  <img src={item.photos[0]} alt="" className="mq-mine-photo" />
                  <div className="mq-mine-info">
                    <div className="mq-mine-top">
                      <span className={`mq-status ${st.tone}`}>
                        <st.Icon size={14} aria-hidden="true" /> {st.label}
                      </span>
                      <span className={`mq-kind static ${item.kind}`}>{KINDS[item.kind]}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p className="mq-mine-meta">
                      <strong>{priceLabel(item)}</strong>
                      {item.negotiable && <span className="mq-pill">Negociable</span>}
                      <span>{unitsLabel(item.quantity)}</span>
                    </p>
                    {st.text && <p className="mq-mine-text">{st.text}</p>}
                    <div className="mq-mine-actions">
                      {!item.removed && !item.pending_payment && (
                        <button type="button" className="mq-btn primary small" onClick={() => setPaying(item)}>
                          <Receipt size={15} aria-hidden="true" /> {paid ? 'Renovar un mes' : `Pagar ${formatCop(LISTING_FEE)}`}
                        </button>
                      )}
                      {item.pending_payment && (
                        <button type="button" className="mq-btn outline small" disabled={isBusy} onClick={() => cancelPayment(item)}>
                          Cancelar pago
                        </button>
                      )}
                      <button type="button" className="mq-btn outline small" onClick={() => setEditing(item)}>
                        <Pencil size={15} aria-hidden="true" /> Editar
                      </button>
                      <button type="button" className="mq-btn outline small" onClick={() => navigate(`/marquetneira/producto?id=${item.id}`)}>
                        <Eye size={15} aria-hidden="true" /> Ver
                      </button>
                      {!item.removed && (
                        <label className="mq-switch-row">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.is_active}
                            aria-label={item.is_active ? 'Activa: tocar para pausar' : 'Pausada: tocar para activar'}
                            className={`mq-switch${item.is_active ? ' on' : ''}`}
                            disabled={isBusy}
                            onClick={() => toggle(item)}
                          >
                            <span />
                          </button>
                          {item.is_active ? 'Activa' : 'Pausada'}
                        </label>
                      )}
                      <button type="button" className="mq-icon-btn danger" aria-label={`Eliminar ${item.title}`} disabled={isBusy} onClick={() => remove(item)}>
                        {isBusy ? <Loader2 size={17} className="mq-spin" aria-hidden="true" /> : <Trash2 size={17} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && <ListingForm user={user} item={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />}
      {paying && (
        <PayDialog
          item={paying}
          onSend={async (reference) => replace(await marketplaceApi.pay(paying.id, reference))}
          onClose={() => setPaying(null)}
        />
      )}
    </PageShell>
  );
}

/** Pagar un mes de publicación: cómo pagar y el comprobante para que el administrador lo confirme. */
function PayDialog({ item, onSend, onClose }) {
  const [reference, setReference] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const box = useRef(null);
  const renewing = item.paid_until && new Date(item.paid_until) > new Date();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await onSend(reference.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mq-scrim" onClick={onClose}>
      <div ref={box} className="mq-dialog" role="dialog" aria-modal="true" aria-labelledby="mq-pay-title" onClick={(e) => e.stopPropagation()}>
        <div className="mq-dialog-head">
          <h2 id="mq-pay-title">{sent ? '¡Recibimos tu pago!' : renewing ? 'Renovar publicación' : 'Publicar tu inmueble'}</h2>
          <button type="button" className="mq-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {sent ? (
          <div className="mq-done">
            <CheckCircle2 size={52} aria-hidden="true" />
            <p>Estamos confirmando el pago de “{item.title}”. Cuando quede listo te avisamos en Notificaciones y tu inmueble se verá en MarquetNeira por {LISTING_DAYS} días.</p>
            <button type="button" className="mq-btn primary" onClick={onClose}>
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="mq-total">
              <span>Total a pagar</span>
              <strong>{formatCop(LISTING_FEE)}</strong>
              <small>
                “{item.title}” por {LISTING_DAYS} días
              </small>
            </p>
            {renewing && <p className="mq-muted">El mes nuevo empieza cuando termine el que ya tienes pagado: no pierdes días.</p>}
            <h3 className="mq-step">1. Paga</h3>
            {PAYMENT.methods.length > 0 ? (
              <ul className="mq-methods">
                {PAYMENT.methods.map((m) => (
                  <li key={m.label}>
                    <span>{m.label}</span>
                    <strong>{m.value}</strong>
                  </li>
                ))}
                <li className="mq-holder">A nombre de {PAYMENT.holder}</li>
              </ul>
            ) : (
              <p className="mq-muted">Envía la solicitud y el equipo de NeirAPP te escribirá por WhatsApp con los datos para pagar.</p>
            )}
            <h3 className="mq-step">2. Cuéntanos cómo pagaste</h3>
            <label className="mq-field">
              <span>
                Número de comprobante <span className="mq-optional">(opcional)</span>
              </span>
              <input value={reference} maxLength={120} placeholder="Ej: Nequi M1234567" onChange={(e) => setReference(e.target.value)} autoFocus />
            </label>
            {error && (
              <p className="mq-error" role="alert">
                {error}
              </p>
            )}
            <div className="mq-dialog-actions">
              <button type="button" className="mq-btn ghost" onClick={onClose}>
                Después
              </button>
              <button type="submit" className="mq-btn primary" disabled={sending}>
                {sending && <Loader2 size={17} className="mq-spin" aria-hidden="true" />} Enviar pago
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
