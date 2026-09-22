const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** El peso colombiano no usa decimales: `price_cop` siempre es un entero. */
export function formatCop(priceCop: number): string {
  return cop.format(priceCop);
}
