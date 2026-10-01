import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_ICONS, DEFAULT_SUBCATEGORY_COLOR, ICON_NAMES, slugify, useProfessionalCategories } from '../../features/professionals/categories.js';
import { professionalsApi } from '../../features/professionals/api.js';
import { useProfessionalDirectory } from '../../features/professionals/directory.js';
import { useRoleGrants } from '../../features/roles/api.js';
import AdminLayout from './AdminLayout.jsx';

// Evita ids repetidos si dos categorías/subcategorías terminan con el mismo nombre (o el mismo slug).
function uniqueId(base, taken) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// "Medicina · Pediatría" con los nombres de las categorías (en el perfil solo se guardan sus ids).
function categoryLabel(categories, pro) {
  const cat = categories.find((c) => c.id === pro.categoryId);
  const sub = cat?.subcategories.find((s) => s.id === pro.subcategoryId);
  return [cat?.label ?? pro.categoryId, sub?.label].filter(Boolean).join(' · ');
}

// El rol se autoriza por correo (igual que repartidor/comerciante en "Roles"), pero se gestiona acá
// porque es específico de profesionales. La persona arma su propio perfil al entrar a /profesional.
const PROFESSIONAL_ROLE = 'professional';

/**
 * Panel de administrador: acceso de profesionales (por correo) y categorías/subcategorías que se
 * muestran en /profesionales. El acceso pasa por la API real (como en "Roles"); las categorías todavía
 * no tienen backend, así que se guardan en localStorage (ver features/professionals/categories.js).
 */
export default function AdminProfessionalsPage({ user, onLogout }) {
  const { grants, status: grantsStatus, error: grantsError, grant, revoke } = useRoleGrants();
  const professionalGrants = grants.filter((g) => g.role === PROFESSIONAL_ROLE);
  const [proEmail, setProEmail] = useState('');
  const [proSaving, setProSaving] = useState(false);
  const [proError, setProError] = useState('');
  const [proNotice, setProNotice] = useState('');

  const onGrantAccess = async (e) => {
    e.preventDefault();
    setProError('');
    setProNotice('');
    if (!proEmail.trim()) {
      setProError('Escribe el correo de la persona.');
      return;
    }
    setProSaving(true);
    try {
      await grant(proEmail.trim(), PROFESSIONAL_ROLE);
      setProNotice(`✓ ${proEmail.trim().toLowerCase()} ya puede entrar como profesional y armar su perfil.`);
      setProEmail('');
    } catch (err) {
      setProError(err.message);
    } finally {
      setProSaving(false);
    }
  };

  const onRevokeAccess = async (g) => {
    if (!window.confirm(`¿Quitar el acceso de profesional a ${g.email}?`)) return;
    setProError('');
    setProNotice('');
    try {
      await revoke(g.email, PROFESSIONAL_ROLE);
    } catch (err) {
      setProError(err.message);
    }
  };

  const directory = useProfessionalDirectory();
  const [featuredError, setFeaturedError] = useState('');

  const toggleFeatured = async (pro) => {
    setFeaturedError('');
    try {
      await professionalsApi.setFeatured(pro.id, !pro.featured);
      await directory.reload(); // el orden del directorio cambia
    } catch (err) {
      setFeaturedError(err.message);
    }
  };

  const [categories, setCategories] = useProfessionalCategories();
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState(ICON_NAMES[0]);
  const [color, setColor] = useState('#0f5238');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [subLabel, setSubLabel] = useState('');
  const [subColor, setSubColor] = useState(DEFAULT_SUBCATEGORY_COLOR);

  const onAddCategory = (e) => {
    e.preventDefault();
    setError('');
    const clean = label.trim();
    if (!clean) {
      setError('Escribe el nombre de la categoría.');
      return;
    }
    const id = uniqueId(slugify(clean) || 'categoria', new Set(categories.map((c) => c.id)));
    setCategories([...categories, { id, label: clean, icon, color, subcategories: [] }]);
    setLabel('');
  };

  const onDeleteCategory = (cat) => {
    if (!window.confirm(`¿Eliminar la categoría "${cat.label}" y sus subcategorías?`)) return;
    setCategories(categories.filter((c) => c.id !== cat.id));
    if (expandedId === cat.id) setExpandedId(null);
  };

  const toggleExpand = (id) => {
    setExpandedId((current) => (current === id ? null : id));
    setSubLabel('');
    // Arranca sugiriendo el color de la categoría; el admin puede cambiarlo antes de agregar.
    setSubColor(categories.find((c) => c.id === id)?.color ?? DEFAULT_SUBCATEGORY_COLOR);
  };

  const onAddSub = (e, catId) => {
    e.preventDefault();
    const clean = subLabel.trim();
    if (!clean) return;
    setCategories(
      categories.map((c) => {
        if (c.id !== catId) return c;
        const id = uniqueId(slugify(clean) || 'subcategoria', new Set(c.subcategories.map((s) => s.id)));
        return { ...c, subcategories: [...c.subcategories, { id, label: clean, color: subColor }] };
      }),
    );
    setSubLabel('');
  };

  const onDeleteSub = (catId, sub) => {
    setCategories(
      categories.map((c) => (c.id === catId ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== sub.id) } : c)),
    );
  };

  const onChangeSubColor = (catId, subId, nextColor) => {
    setCategories(
      categories.map((c) =>
        c.id === catId
          ? { ...c, subcategories: c.subcategories.map((s) => (s.id === subId ? { ...s, color: nextColor } : s)) }
          : c,
      ),
    );
  };

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Gestión de profesionales"
      subtitle="Da acceso a profesionales por correo y organiza las categorías que ven al explorar /profesionales."
    >
      <form className="a-card a-form" onSubmit={onGrantAccess} noValidate>
        <h2>Dar acceso a un profesional</h2>
        <div className="a-field">
          <label htmlFor="pro-email">Correo electrónico</label>
          <input
            id="pro-email"
            type="email"
            autoComplete="off"
            placeholder="persona@correo.com"
            value={proEmail}
            onChange={(e) => setProEmail(e.target.value)}
          />
          <small>La persona entra con este correo, elige su contraseña al registrarse y arma su propio perfil de profesional.</small>
        </div>
        {proError && (
          <p className="a-err" role="alert">
            {proError}
          </p>
        )}
        <div className="a-form-actions">
          <button type="submit" className="a-btn primary" disabled={proSaving}>
            {proSaving ? <Loader2 size={18} className="a-spin" aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
            Dar acceso
          </button>
        </div>
      </form>

      {proNotice && (
        <p className="a-success" role="status">
          {proNotice}
        </p>
      )}

      <section className="a-card">
        <h2>Profesionales autorizados</h2>
        {grantsStatus === 'loading' && <p className="a-empty">Cargando…</p>}
        {grantsStatus === 'error' && (
          <p className="a-err" role="alert">
            {grantsError}
          </p>
        )}
        {grantsStatus === 'ok' && professionalGrants.length === 0 && (
          <p className="a-empty">Todavía no autorizaste a ningún profesional.</p>
        )}
        {professionalGrants.length > 0 && (
          <ul className="a-store-list">
            {professionalGrants.map((g) => (
              <li key={g.email} className="a-store-row a-grant">
                <div className="a-store-info">
                  <strong>{g.email}</strong>
                  <span>{g.has_account ? g.full_name : 'Aún no se ha registrado'}</span>
                </div>
                <span className={`a-badge ${g.has_account ? 'server' : 'local'}`}>{g.has_account ? 'Activo' : 'Pendiente'}</span>
                <button
                  type="button"
                  className="a-icon-btn danger"
                  aria-label={`Quitar acceso a ${g.email}`}
                  onClick={() => onRevokeAccess(g)}
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="a-card">
        <h2>Destacados</h2>
        <p className="a-card-hint">
          El profesional destacado aparece primero en su especialidad en /profesionales. Aquí salen quienes ya publicaron su perfil.
        </p>
        {featuredError && (
          <p className="a-err" role="alert">
            {featuredError}
          </p>
        )}
        {directory.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : directory.error ? (
          <p className="a-err" role="alert">
            {directory.error}
          </p>
        ) : directory.list.length === 0 ? (
          <p className="a-empty">Todavía ningún profesional ha publicado su perfil.</p>
        ) : (
        <ul className="a-store-list">
          {directory.list.map((pro) => (
            <li key={pro.id} className="a-store-row">
              <div className="a-store-info">
                <strong>{pro.name}</strong>
                <span>{categoryLabel(categories, pro)}</span>
              </div>
              <span className={`a-badge ${pro.featured ? 'server' : 'local'}`}>{pro.featured ? 'Destacado' : 'Normal'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={pro.featured}
                aria-label={`${pro.name}: ${pro.featured ? 'destacado' : 'no destacado'}`}
                className={`a-switch${pro.featured ? ' on' : ''}`}
                onClick={() => toggleFeatured(pro)}
              >
                <span />
              </button>
            </li>
          ))}
        </ul>
        )}
      </section>

      <form className="a-card a-form" onSubmit={onAddCategory} noValidate>
        <h2>Agregar categoría</h2>
        <div className="a-grid">
          <div className="a-field">
            <label htmlFor="cat-label">Nombre</label>
            <input
              id="cat-label"
              placeholder="Ej: Ingenierías"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="a-field">
            <label htmlFor="cat-icon">Ícono</label>
            <select id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)}>
              {ICON_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="a-field" style={{ maxWidth: 140 }}>
          <label htmlFor="cat-color">Color</label>
          <input id="cat-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        {error && (
          <p className="a-err" role="alert">
            {error}
          </p>
        )}
        <div className="a-form-actions">
          <button type="submit" className="a-btn primary">
            <Plus size={18} aria-hidden="true" />
            Agregar categoría
          </button>
        </div>
      </form>

      <section className="a-card">
        <h2>Categorías ({categories.length})</h2>
        {categories.length === 0 && <p className="a-empty">Todavía no hay categorías.</p>}
        {categories.length > 0 && (
          <ul className="a-store-list">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.icon] ?? CATEGORY_ICONS.Ellipsis;
              const isOpen = expandedId === cat.id;
              return (
                <li key={cat.id} className="a-store">
                  <div className="a-store-row">
                    <span className="a-store-icon" style={{ background: cat.color }}>
                      <Icon size={20} color="#fff" aria-hidden="true" />
                    </span>
                    <div className="a-store-info">
                      <strong>{cat.label}</strong>
                      <span>
                        {cat.subcategories.length} subcategoría{cat.subcategories.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <button type="button" className="a-btn ghost" onClick={() => toggleExpand(cat.id)}>
                      {isOpen ? 'Ocultar' : 'Gestionar subcategorías'}
                    </button>
                    <button
                      type="button"
                      className="a-icon-btn danger"
                      aria-label={`Eliminar categoría ${cat.label}`}
                      onClick={() => onDeleteCategory(cat)}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="a-products">
                      <h3>Subcategorías de {cat.label}</h3>
                      <form className="a-product-form" onSubmit={(e) => onAddSub(e, cat.id)}>
                        <div className="a-field">
                          <label htmlFor={`sub-label-${cat.id}`}>Nombre</label>
                          <input
                            id={`sub-label-${cat.id}`}
                            placeholder="Ej: Ingeniería Civil"
                            value={subLabel}
                            onChange={(e) => setSubLabel(e.target.value)}
                          />
                        </div>
                        <div className="a-field a-field-color">
                          <label htmlFor={`sub-color-${cat.id}`}>Color</label>
                          <input
                            id={`sub-color-${cat.id}`}
                            type="color"
                            value={subColor}
                            onChange={(e) => setSubColor(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="a-btn primary">
                          <Plus size={16} aria-hidden="true" />
                          Agregar
                        </button>
                      </form>
                      {cat.subcategories.length === 0 ? (
                        <p className="a-empty">Sin subcategorías todavía.</p>
                      ) : (
                        <ul className="a-product-list">
                          {cat.subcategories.map((sub) => (
                            <li key={sub.id}>
                              <input
                                type="color"
                                className="a-sub-color"
                                aria-label={`Color de ${sub.label}`}
                                value={sub.color ?? DEFAULT_SUBCATEGORY_COLOR}
                                onChange={(e) => onChangeSubColor(cat.id, sub.id, e.target.value)}
                              />
                              <div>
                                <strong>{sub.label}</strong>
                              </div>
                              <button
                                type="button"
                                className="a-icon-btn danger"
                                aria-label={`Eliminar ${sub.label}`}
                                onClick={() => onDeleteSub(cat.id, sub)}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}
