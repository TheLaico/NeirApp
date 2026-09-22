import { AlertCircle } from "lucide-react";

/** Los errores llevan icono además de color: el color solo no basta (accesibilidad). */
export function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-control border border-terracotta/30 bg-terracotta/10 px-3.5 py-3 text-sm text-terracotta"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
