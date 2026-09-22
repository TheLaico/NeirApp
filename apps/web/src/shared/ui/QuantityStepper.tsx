import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  quantity,
  onChange,
  max = 20,
}: {
  quantity: number;
  onChange: (next: number) => void;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-control border border-line bg-white px-1 py-1">
      <button
        type="button"
        aria-label="Quitar uno"
        onClick={() => onChange(quantity - 1)}
        className="grid size-7 place-items-center rounded-full text-brand-deep hover:bg-brand-soft"
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="w-4 text-center text-sm font-medium tabular-nums">{quantity}</span>
      <button
        type="button"
        aria-label="Agregar uno"
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
        className="grid size-7 place-items-center rounded-full text-brand-deep hover:bg-brand-soft disabled:opacity-40"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
