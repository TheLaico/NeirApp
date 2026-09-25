import { useMemo, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import ProductScreen from '../../components/products/ProductScreen.jsx';
import { useFavorites } from '../../features/favorites/FavoritesContext.jsx';
import { useStores } from '../../features/stores/api.js';
import FavoritesPanel from './FavoritesPanel.jsx';
import './favorites-page.css';

const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Página "Mis favoritos": sin mapa, con el mismo encabezado y barra lateral que el resto de la app. */
export default function FavoritesPage({ user, onLogout }) {
  const { stores, status } = useStores();
  const { list } = useFavorites();
  const [group, setGroup] = useState(null);
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState(null);

  // Cada favorito se muestra con los datos actuales de su tienda; si la tienda ya no está, se omite.
  const items = useMemo(() => {
    const q = normalize(query.trim());
    return list
      .map((fav) => ({ product: fav.product, store: stores.find((s) => s.id === fav.storeId) }))
      .filter(
        ({ product: p, store }) =>
          store &&
          (!group || store.group === group) &&
          (!q || normalize(`${p.name} ${p.description ?? ''} ${store.name}`).includes(q)),
      );
  }, [list, stores, group, query]);

  const productStore = product ? stores.find((s) => s.id === product.store_id) ?? null : null;
  const filtering = Boolean(group || query.trim());

  return (
    <PageShell
      flush
      user={user}
      onLogout={onLogout}
      group={group}
      onGroup={setGroup}
      query={query}
      onQuery={setQuery}
    >
      <FavoritesPanel
        items={items}
        totalSaved={list.length}
        loading={status === 'loading'}
        filtering={filtering}
        selectedProductId={product?.id}
        onOpenProduct={setProduct}
      />
      {productStore && (
        <ProductScreen
          key={product.id}
          product={product}
          store={productStore}
          onClose={() => setProduct(null)}
        />
      )}
    </PageShell>
  );
}
