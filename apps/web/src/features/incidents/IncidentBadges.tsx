import type { IncidentCategory, IncidentStatus } from "./types";

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  wrong_item: "Item incorrecto",
  missing_item: "Faltó un item",
  damaged: "Llegó dañado",
  late_delivery: "Se demoró",
  other: "Otro",
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Abierto",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  open: "bg-panela/20 text-[#8a6416]",
  resolved: "bg-brand-soft text-brand-deep",
  dismissed: "bg-line text-muted",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
