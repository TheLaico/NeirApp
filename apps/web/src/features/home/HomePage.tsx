import { storeCategoryColors } from "@neirapp/design-tokens";
import { Bike, Coffee, Croissant, Pill, ShoppingBasket, Store, Utensils } from "lucide-react";
import type { ComponentType } from "react";
import { Navbar } from "../../shared/ui/Navbar";

// Marcadores de muestra: solo ilustran el lenguaje visual del mapa (Fase 1 traerá el mapa real).
const SAMPLE_MARKERS: {
  label: string;
  color: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  style: { left: string; top: string };
}[] = [
  { label: "Tienda", color: storeCategoryColors.general, Icon: Store, style: { left: "24%", top: "38%" } },
  { label: "Restaurante", color: storeCategoryColors.restaurant, Icon: Utensils, style: { left: "58%", top: "28%" } },
  { label: "Supermercado", color: storeCategoryColors.supermarket, Icon: ShoppingBasket, style: { left: "44%", top: "58%" } },
  { label: "Farmacia", color: storeCategoryColors.pharmacy, Icon: Pill, style: { left: "72%", top: "56%" } },
  { label: "Panadería", color: storeCategoryColors.bakery, Icon: Croissant, style: { left: "34%", top: "72%" } },
  { label: "Café", color: storeCategoryColors.cafe, Icon: Coffee, style: { left: "80%", top: "34%" } },
];

export function HomePage() {
  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <section
          aria-label="Mapa de Neira"
          className="relative h-[60dvh] min-h-[360px] overflow-hidden rounded-card border border-line bg-map-bg shadow-soft"
        >
          {/* Relieve ilustrado: verde de montaña y un río, sin gradientes agresivos. */}
          <svg className="absolute inset-0 size-full" viewBox="0 0 800 500" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 340 C140 250 250 300 380 230 S640 150 800 200 V500 H0Z" fill="#D7E4D4" />
            <path d="M0 420 C160 360 300 410 450 350 S700 320 800 350 V500 H0Z" fill="#C9DCC6" />
            <path d="M120 0 C160 120 90 200 180 300 S260 420 230 500" stroke="#B9D8D5" strokeWidth="14" fill="none" strokeLinecap="round" />
            <path d="M0 200 H800 M400 0 V500" stroke="#FFFFFF" strokeWidth="6" />
            <path d="M0 120 L800 300 M560 0 L620 500" stroke="#E3E5DF" strokeWidth="4" />
            <path d="M0 260 C200 250 500 320 800 270" stroke="#D8CBB8" strokeWidth="7" fill="none" />
          </svg>

          {SAMPLE_MARKERS.map(({ label, color, Icon, style }) => (
            <span
              key={label}
              title={label}
              style={{ ...style, backgroundColor: color }}
              className="absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-soft"
            >
              <Icon size={18} color="#fff" />
            </span>
          ))}

          <div className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-card bg-white/95 p-4 shadow-raised sm:inset-x-auto sm:right-4 sm:max-w-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep">
              <Bike size={18} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-base">El mapa de Neira llega pronto</h1>
              <p className="mt-0.5 text-sm text-muted">
                Aquí verás las tiendas del municipio y podrás pedir de varias a la vez.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
