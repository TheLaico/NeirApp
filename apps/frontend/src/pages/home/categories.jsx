import { Bike, Briefcase, CalendarCheck, Car, Home as HomeIcon, Package, Store, X } from 'lucide-react';
import './home-feed.css';

// Categorías de NeirAPP: la pasarela del inicio y la ventana "Categorías" de la página "Más" (celular).
// `to`: la ruta de cada módulo.
export const TOP_CATS = [
  { id: 'domicilios', label: 'Domicilios', color: '#0f5238', Icon: Bike, to: '/mapa' },
  { id: 'profesionales', label: 'Profesionales', color: '#E8A92C', Icon: Briefcase, to: '/profesionales' },
  { id: 'transporte', label: 'Transporte', color: '#1D8A9C', Icon: Car, to: '/transporte' },
  { id: 'hospedaje', label: 'Hospedaje', color: '#B6533C', Icon: HomeIcon, to: '/hospedaje' },
  { id: 'marquetneira', label: 'MarketNeira', color: '#6A4C93', Icon: Store, to: '/marquetneira' },
  { id: 'proveedores', label: 'Proveedores', color: '#3B6E8F', Icon: Package, to: '/proveedores' },
  { id: 'reservas', label: 'Reservas', color: '#C0587A', Icon: CalendarCheck, to: '/reservas' },
];

/** Ruta de una categoría (o `undefined` si todavía no tiene módulo propio). */
export const categoryPath = (id) => TOP_CATS.find((c) => c.id === id)?.to;

/** Todas las categorías, quietas y en cuadrícula, para verlas con calma sin que se deslicen. */
export function CategoriesModal({ cats = TOP_CATS, onSelect, onClose }) {
  return (
    <div className="cats-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cats-modal" role="dialog" aria-modal="true" aria-labelledby="cats-title">
        <button type="button" className="cats-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} aria-hidden="true" />
        </button>
        <h2 id="cats-title">Categorías</h2>
        <div className="cats-grid">
          {cats.map(({ id, label, color, Icon, to }) => (
            <button key={id} type="button" className="cats-grid-item" onClick={() => onSelect(id)}>
              <span className="feed-cat-dot" style={{ background: color }}>
                <Icon size={22} color="#fff" aria-hidden="true" />
              </span>
              <span>{label}</span>
              {!to && <span className="feed-soon">Próximamente</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
