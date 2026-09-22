import { storeCategoryColors, type StoreCategory as TokenCategory } from "@neirapp/design-tokens";
import { Coffee, Croissant, Pill, ShoppingBasket, Store, Utensils } from "lucide-react";
import type { ComponentType } from "react";
import type { StoreCategory } from "./types";

const ICONS: Record<StoreCategory, ComponentType<{ size?: number; color?: string }>> = {
  general: Store,
  restaurant: Utensils,
  supermarket: ShoppingBasket,
  pharmacy: Pill,
  bakery: Croissant,
  cafe: Coffee,
};

export const CATEGORY_LABELS: Record<StoreCategory, string> = {
  general: "Tienda",
  restaurant: "Restaurante",
  supermarket: "Supermercado",
  pharmacy: "Farmacia",
  bakery: "Panadería",
  cafe: "Café",
};

export function categoryColor(category: StoreCategory): string {
  return storeCategoryColors[category as TokenCategory];
}

export function StoreIcon({ category, size = 18 }: { category: StoreCategory; size?: number }) {
  const Icon = ICONS[category];
  return <Icon size={size} color="#fff" />;
}

export function StoreBadge({ category, size = 36 }: { category: StoreCategory; size?: number }) {
  return (
    <span
      style={{ backgroundColor: categoryColor(category), width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full border-2 border-white shadow-soft"
    >
      <StoreIcon category={category} size={Math.round(size * 0.5)} />
    </span>
  );
}
