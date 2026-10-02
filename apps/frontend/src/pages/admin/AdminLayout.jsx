import { ArrowLeft, BedDouble, Bike, Briefcase, CalendarCheck, LayoutDashboard, LogOut, MapPinned, MessageSquarePlus, ShieldCheck, Sofa, Store, Truck, UserCog, Warehouse } from 'lucide-react';
import { useEffect, useState } from 'react';
import { canAccessAdmin, ROLES } from '../../config/roles.js';
import { lodgingApi } from '../../features/lodging/api.js';
import { marketplaceApi } from '../../features/marketplace/api.js';
import { professionalsApi } from '../../features/professionals/api.js';
import { suppliersApi } from '../../features/suppliers/api.js';
import { useNavigate, usePath } from '../../lib/router.jsx';
import './admin.css';

const ITEMS = [
  { to: '/admin', label: 'Resumen', Icon: LayoutDashboard },
  { to: '/admin/tiendas', label: 'Tiendas', Icon: Store },
  { to: '/admin/roles', label: 'Roles', Icon: UserCog },
  { to: '/admin/repartidores', label: 'Repartidores', Icon: Bike },
  { to: '/admin/profesionales', label: 'Gestión de profesionales', Icon: Briefcase },
  { to: '/admin/marquetneira', label: 'MarquetNeira', Icon: Sofa },
  { to: '/admin/proveedores', label: 'Proveedores', Icon: Warehouse },
  { to: '/admin/hospedaje', label: 'Hospedaje', Icon: BedDouble },
  { to: '/admin/reservas', label: 'Reservas', Icon: CalendarCheck },
  { to: '/admin/mapa', label: 'Mapa en vivo', Icon: MapPinned },
  { to: '/admin/envios', label: 'Envíos', Icon: Truck },
  { to: '/admin/solicitudes', label: 'Solicitudes', Icon: MessageSquarePlus },
];

/**
 * Marco del panel de administrador: sidebar propio (Resumen, Tiendas, Roles, Repartidores, Envíos), título de la sección y contenido.
 * Solo se muestra a usuarios con rol de desarrollador o administrador.
 */
export default function AdminLayout({ user, onLogout, title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const path = usePath();

  // Ocupa toda la pantalla, sin el marco de tarjeta de las pantallas de acceso.
  useEffect(() => {
    document.body.classList.add('is-home');
    return () => document.body.classList.remove('is-home');
  }, []);

  // Pagos de planes por confirmar: se marcan en "Gestión de profesionales" para que no se pasen por alto.
  const [pendingPlans, setPendingPlans] = useState(0);
  // Y en MarquetNeira: pagos de publicación por confirmar más publicaciones reportadas.
  const [marketTodo, setMarketTodo] = useState(0);
  // Y en Proveedores: pagos de suscripción por confirmar.
  const [supplierTodo, setSupplierTodo] = useState(0);
  // Y en Hospedaje: pagos de planes de hoteles por confirmar.
  const [lodgingTodo, setLodgingTodo] = useState(0);
  const allowed = canAccessAdmin(user);
  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    const check = () =>
      professionalsApi
        .adminPlans()
        .then((rows) => alive && setPendingPlans(rows.filter((r) => r.status.pending).length))
        .catch(() => {});
    const checkMarket = () =>
      Promise.all([marketplaceApi.pendingPayments(), marketplaceApi.reports()])
        .then(([payments, reports]) => alive && setMarketTodo(payments.length + reports.length))
        .catch(() => {});
    const checkSuppliers = () =>
      suppliersApi
        .adminSubscriptions()
        .then((rows) => alive && setSupplierTodo(rows.filter((r) => r.subscription.pending).length))
        .catch(() => {});
    const checkLodging = () =>
      lodgingApi
        .adminHotels()
        .then((rows) => alive && setLodgingTodo(rows.reduce((n, r) => n + (r.billing.listing.pending ? 1 : 0) + (r.billing.featured.pending ? 1 : 0), 0)))
        .catch(() => {});
    check();
    checkMarket();
    checkSuppliers();
    checkLodging();
    const timer = setInterval(() => {
      check();
      checkMarket();
      checkSuppliers();
      checkLodging();
    }, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [allowed]);

  if (!canAccessAdmin(user)) {
    return (
      <div className="admin admin-denied">
        <ShieldCheck size={48} aria-hidden="true" />
        <h1>No tienes permiso para ver esta página</h1>
        <p>El panel de administrador es solo para el equipo de NeirAPP.</p>
        <button type="button" className="a-btn primary" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="admin-brand-mark">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <div>
            <strong>NeirAPP</strong>
            <small>Panel de administrador</small>
          </div>
        </div>

        <nav aria-label="Administración">
          {ITEMS.map(({ to, label, Icon }) => (
            <button
              key={to}
              type="button"
              className={`admin-nav${path === to ? ' active' : ''}`}
              aria-current={path === to ? 'page' : undefined}
              onClick={() => navigate(to)}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
              {to === '/admin/hospedaje' && lodgingTodo > 0 && (
                <span className="a-count" aria-label={`${lodgingTodo} pagos de hoteles por confirmar`}>
                  {lodgingTodo}
                </span>
              )}
              {to === '/admin/proveedores' && supplierTodo > 0 && (
                <span className="a-count" aria-label={`${supplierTodo} pagos de proveedores por confirmar`}>
                  {supplierTodo}
                </span>
              )}
              {to === '/admin/marquetneira' && marketTodo > 0 && (
                <span className="a-count" aria-label={`${marketTodo} pendientes en MarquetNeira`}>
                  {marketTodo}
                </span>
              )}
              {to === '/admin/profesionales' && pendingPlans > 0 && (
                <span className="a-count" aria-label={`${pendingPlans} pagos de planes por confirmar`}>
                  {pendingPlans}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-side-foot">
          <div className="admin-user">
            <span className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{ROLES[user.role] ?? user.role}</small>
            </div>
          </div>
          <button type="button" className="admin-nav" onClick={() => navigate('/')}>
            <ArrowLeft size={19} aria-hidden="true" />
            Volver a la app
          </button>
          <button type="button" className="admin-nav" onClick={onLogout}>
            <LogOut size={19} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="admin-actions">{actions}</div>}
        </header>
        {children}
      </main>
    </div>
  );
}
