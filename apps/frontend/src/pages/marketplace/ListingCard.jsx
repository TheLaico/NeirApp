import { Eye, Flag, Heart, Link2, MessageCircle, MoreHorizontal, Package, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { KINDS, priceLabel, sellerChat, unitsLabel } from '../../features/marketplace/model.js';

/**
 * Tarjeta de un mueble: foto con el tipo (venta o alquiler), favorito y menú; nombre, precio, cuántos hay y los
 * botones para verlo o escribirle al vendedor por WhatsApp. NeirAPP solo media: no hay pagos en la plataforma.
 */
export default function ListingCard({ item, own, favorite, onFavorite, onOpen, onReport, onCopied }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !menuRef.current?.contains(e.target)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  const copyLink = async () => {
    setMenu(false);
    const url = `${window.location.origin}/marquetneira/producto?id=${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
      onCopied?.('Copiamos el enlace de la publicación.');
    } catch {
      onCopied?.(url);
    }
  };

  return (
    <article className="mq-card">
      <div className="mq-card-photo">
        <button type="button" className="mq-card-img" onClick={onOpen} aria-label={`Ver ${item.title}`}>
          <img src={item.photos[0]} alt="" loading="lazy" />
        </button>
        <span className={`mq-kind ${item.kind}`}>{KINDS[item.kind]}</span>
        <div className="mq-card-tools" ref={menuRef}>
          <button type="button" className="mq-round" aria-label="Más opciones" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
          <button type="button" className={`mq-round mq-heart${favorite ? ' on' : ''}`} aria-pressed={favorite} aria-label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'} onClick={onFavorite}>
            <Heart size={17} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
          </button>
          {menu && (
            <div className="mq-menu" role="menu">
              <button type="button" role="menuitem" onClick={copyLink}>
                <Link2 size={16} aria-hidden="true" /> Copiar enlace
              </button>
              {!own && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setMenu(false);
                    onReport();
                  }}
                >
                  <Flag size={16} aria-hidden="true" /> Reportar publicación
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mq-card-body">
        <h3>{item.title}</h3>
        <p className="mq-price">
          <strong>{priceLabel(item)}</strong>
          {item.negotiable && item.price_cop != null && <span className="mq-pill">Negociable</span>}
        </p>
        <p className="mq-line">
          <Package size={16} aria-hidden="true" /> {unitsLabel(item.quantity)}
        </p>
        <p className="mq-note">
          {item.kind === 'rent' ? <UserRound size={15} aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
          {item.kind === 'rent' ? 'Acuerda directamente con el vendedor' : 'Sin pagos en la plataforma'}
        </p>
        <div className="mq-card-actions">
          <button type="button" className="mq-btn primary" onClick={onOpen}>
            <Eye size={16} aria-hidden="true" /> Ver producto
          </button>
          {own ? (
            <span className="mq-own">Tu publicación</span>
          ) : (
            <a className="mq-btn outline" href={sellerChat(item)} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> Chat con vendedor
            </a>
          )}
        </div>
        {!own && (
          <button type="button" className="mq-report-link" onClick={onReport}>
            <Flag size={14} aria-hidden="true" /> Reportar publicación
          </button>
        )}
      </div>
    </article>
  );
}
