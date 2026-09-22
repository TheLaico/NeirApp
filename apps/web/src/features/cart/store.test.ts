import { beforeEach, describe, expect, it } from "vitest";
import type { ProductDto } from "../stores/types";
import { cartGroups, cartTotalCop, cartTotalItems, useCartStore } from "./store";

function product(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: "p1",
    store_id: "s1",
    name: "Pizza margarita",
    description: "",
    price_cop: 25_000,
    image_url: null,
    is_available: true,
    ...overrides,
  };
}

describe("useCartStore", () => {
  beforeEach(() => useCartStore.getState().clear());

  it("empieza vacío", () => {
    const state = useCartStore.getState();
    expect(cartGroups(state.groups)).toEqual([]);
    expect(cartTotalItems(state.groups)).toBe(0);
    expect(cartTotalCop(state.groups)).toBe(0);
  });

  it("agrega un producto y acumula cantidades del mismo producto", () => {
    const { add } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product());
    add("s1", "Pizzería Napoli", product());

    const groups = cartGroups(useCartStore.getState().groups);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.lines).toEqual([{ product: product(), quantity: 2 }]);
    expect(cartTotalItems(useCartStore.getState().groups)).toBe(2);
    expect(cartTotalCop(useCartStore.getState().groups)).toBe(50_000);
  });

  it("mantiene productos de distintas tiendas por separado (compra multi-tienda)", () => {
    const { add } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product({ id: "p1", price_cop: 25_000 }));
    add("s2", "Panadería Central", product({ id: "p2", name: "Pan de queso", price_cop: 3_000 }));

    const groups = cartGroups(useCartStore.getState().groups);
    expect(groups.map((g) => g.storeId).sort()).toEqual(["s1", "s2"]);
    expect(cartTotalItems(useCartStore.getState().groups)).toBe(2);
    expect(cartTotalCop(useCartStore.getState().groups)).toBe(28_000);
  });

  it("respeta el tope máximo de cantidad por línea", () => {
    const { add } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product(), 15);
    add("s1", "Pizzería Napoli", product(), 15);

    const groups = cartGroups(useCartStore.getState().groups);
    expect(groups[0]!.lines[0]!.quantity).toBe(20);
  });

  it("setQuantity actualiza la cantidad de una línea existente", () => {
    const { add, setQuantity } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product());
    setQuantity("s1", "p1", 5);

    expect(cartGroups(useCartStore.getState().groups)[0]!.lines[0]!.quantity).toBe(5);
  });

  it("setQuantity a 0 elimina la línea, y elimina la tienda si queda vacía", () => {
    const { add, setQuantity } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product());
    setQuantity("s1", "p1", 0);

    expect(cartGroups(useCartStore.getState().groups)).toEqual([]);
  });

  it("setQuantity a 0 no borra otras líneas de la misma tienda", () => {
    const { add, setQuantity } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product({ id: "p1" }));
    add("s1", "Pizzería Napoli", product({ id: "p2", name: "Pizza hawaiana" }));
    setQuantity("s1", "p1", 0);

    const groups = cartGroups(useCartStore.getState().groups);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.lines.map((l) => l.product.id)).toEqual(["p2"]);
  });

  it("removeLine quita un producto puntual", () => {
    const { add, removeLine } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product());
    removeLine("s1", "p1");

    expect(cartGroups(useCartStore.getState().groups)).toEqual([]);
  });

  it("clearStore vacía solo una tienda", () => {
    const { add, clearStore } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product({ id: "p1" }));
    add("s2", "Panadería Central", product({ id: "p2" }));
    clearStore("s1");

    expect(cartGroups(useCartStore.getState().groups).map((g) => g.storeId)).toEqual(["s2"]);
  });

  it("clear vacía todo el carrito", () => {
    const { add, clear } = useCartStore.getState();
    add("s1", "Pizzería Napoli", product());
    clear();

    expect(cartGroups(useCartStore.getState().groups)).toEqual([]);
  });
});
