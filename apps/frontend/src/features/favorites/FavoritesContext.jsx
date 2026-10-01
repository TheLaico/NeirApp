import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Productos favoritos, guardados en el navegador: { [productId]: { product, storeId, storeName } }
const STORAGE_KEY = 'neirapp.frontend.favorites';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
};

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      /* sin almacenamiento disponible: los favoritos viven solo en memoria */
    }
  }, [favorites]);

  const value = useMemo(
    () => ({
      list: Object.values(favorites),
      count: Object.keys(favorites).length,
      isFavorite: (productId) => productId in favorites,
      clear: () => setFavorites({}),
      toggle: (store, product) =>
        setFavorites((current) => {
          if (product.id in current) {
            const { [product.id]: _removed, ...rest } = current;
            return rest;
          }
          return { ...current, [product.id]: { product, storeId: store.id, storeName: store.name } };
        }),
    }),
    [favorites],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites debe usarse dentro de <FavoritesProvider>');
  return ctx;
}
