import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Navbar } from "../../shared/ui/Navbar";
import { useMyIncidents } from "./api";
import { CATEGORY_LABELS, IncidentStatusBadge } from "./IncidentBadges";

export function MyIncidentsPage() {
  const incidents = useMyIncidents();

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al mapa
        </Link>

        <h1 className="mb-4 text-2xl">Mis reportes</h1>

        {incidents.isPending && <p className="text-muted">Cargando…</p>}
        {incidents.isError && <ErrorAlert message={errorMessage(incidents.error)} />}
        {incidents.data?.length === 0 && (
          <p className="text-muted">No has reportado ningún problema.</p>
        )}

        <ul className="space-y-3">
          {incidents.data?.map((incident) => (
            <li
              key={incident.id}
              className="rounded-card border border-line bg-white p-4 shadow-soft"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">
                  {CATEGORY_LABELS[incident.category]}
                </span>
                <IncidentStatusBadge status={incident.status} />
              </div>
              <p className="text-sm text-muted">{incident.description}</p>
              {incident.resolution_note && (
                <p className="mt-2 text-sm text-ink">
                  <span className="font-medium">Respuesta: </span>
                  {incident.resolution_note}
                </p>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
