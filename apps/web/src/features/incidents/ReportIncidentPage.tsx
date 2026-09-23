import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { useReportIncident } from "./api";
import type { IncidentCategory } from "./types";

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  wrong_item: "Me llegó algo distinto a lo que pedí",
  missing_item: "Faltó algo del pedido",
  damaged: "Llegó dañado",
  late_delivery: "Se demoró demasiado",
  other: "Otro",
};

export function ReportIncidentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<IncidentCategory>("wrong_item");
  const [description, setDescription] = useState("");
  const report = useReportIncident();

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver
        </button>

        <div className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-8">
          <h1 className="text-2xl">Reportar un problema</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            Cuéntanos qué pasó con este pedido. Un administrador lo revisará.
          </p>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!orderId) return;
              report.mutate(
                { order_id: orderId, category, description },
                { onSuccess: () => void navigate("/mis-reportes") },
              );
            }}
            className="mt-6 space-y-4"
          >
            {report.isError && <ErrorAlert message={errorMessage(report.error)} />}

            <div className="space-y-1.5">
              <label htmlFor="category" className="block text-sm font-medium text-ink">
                ¿Qué pasó?
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                className="h-11 w-full rounded-control border border-line bg-white px-3.5 text-[15px] text-ink focus:border-brand"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="description" className="block text-sm font-medium text-ink">
                Cuéntanos más
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink focus:border-brand"
              />
            </div>

            <Button type="submit" fullWidth disabled={!description.trim()} loading={report.isPending}>
              Enviar reporte
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
