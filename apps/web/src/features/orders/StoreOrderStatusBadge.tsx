import { colors, orderStatusColors } from "@neirapp/design-tokens";
import type { StoreOrderStatus } from "./types";

export const STATUS_LABELS: Record<StoreOrderStatus, string> = {
  pending_payment: "Por pagar",
  paid: "Nuevo",
  accepted: "Aceptado",
  rejected: "Rechazado",
  preparing: "Preparando",
  ready: "Listo",
};

const STATUS_COLORS: Record<StoreOrderStatus, string> = {
  pending_payment: colors.muted,
  paid: orderStatusColors.pending,
  accepted: orderStatusColors.pending,
  rejected: orderStatusColors.issue,
  preparing: orderStatusColors.preparing,
  ready: orderStatusColors.ready,
};

export function StoreOrderStatusBadge({ status }: { status: StoreOrderStatus }) {
  return (
    <span
      style={{ backgroundColor: `${STATUS_COLORS[status]}1a`, color: STATUS_COLORS[status] }}
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
