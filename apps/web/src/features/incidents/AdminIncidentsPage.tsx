import { ArrowLeft, Check, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { useIncidents, useResolveIncident } from "./api";
import { CATEGORY_LABELS, IncidentStatusBadge } from "./IncidentBadges";
import type { IncidentDto, IncidentStatus } from "./types";

const TABS: { value: IncidentStatus | undefined; label: string }[] = [
  { value: "open", label: "Abiertos" },
  { value: "resolved", label: "Resueltos" },
  { value: "dismissed", label: "Descartados" },
  { value: undefined, label: "Todos" },
];

function ResolveForm({ incident }: { incident: IncidentDto }) {
  const [note, setNote] = useState("");
  const resolve = useResolveIncident();

  return (
    <div className="mt-3 space-y-2">
      {resolve.isError && <ErrorAlert message={errorMessage(resolve.error)} />}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota de resolución (opcional)"
        rows={2}
        maxLength={1000}
        className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand"
      />
      <div className="flex gap-2">
        <Button
          className="h-9 px-3"
          loading={resolve.isPending}
          onClick={() =>
            resolve.mutate({
              incidentId: incident.id,
              status: "resolved",
              resolutionNote: note.trim() || null,
            })
          }
        >
          <Check size={16} aria-hidden="true" />
          Resolver
        </Button>
        <Button
          variant="ghost"
          className="h-9 px-3"
          loading={resolve.isPending}
          onClick={() =>
            resolve.mutate({
              incidentId: incident.id,
              status: "dismissed",
              resolutionNote: note.trim() || null,
            })
          }
        >
          <X size={16} aria-hidden="true" />
          Descartar
        </Button>
      </div>
    </div>
  );
}

export function AdminIncidentsPage() {
  const [tab, setTab] = useState<IncidentStatus | undefined>("open");
  const incidents = useIncidents(tab);

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          to="/admin/tiendas"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Admin
        </Link>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl">Reportes de problemas</h1>
          <div className="flex gap-4">
            <Link to="/admin/tiendas" className="text-sm font-medium text-brand hover:underline">
              Ver tiendas por aprobar
            </Link>
            <Link
              to="/admin/repartidores"
              className="text-sm font-medium text-brand hover:underline"
            >
              Ver repartidores por aprobar
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === t.value ? "bg-brand text-white" : "bg-brand-soft text-brand-deep"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {incidents.isPending && <p className="text-muted">Cargando…</p>}
        {incidents.data?.length === 0 && <p className="text-muted">No hay reportes aquí.</p>}

        <ul className="space-y-3">
          {incidents.data?.map((incident) => (
            <li
              key={incident.id}
              className="rounded-card border border-line bg-white p-4 shadow-soft"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">
                  {CATEGORY_LABELS[incident.category]} ·{" "}
                  {incident.reporter_role === "customer" ? "Cliente" : "Repartidor"}
                </span>
                <IncidentStatusBadge status={incident.status} />
              </div>
              <p className="text-sm text-muted">{incident.description}</p>
              {incident.resolution_note && (
                <p className="mt-2 text-sm text-ink">
                  <span className="font-medium">Nota: </span>
                  {incident.resolution_note}
                </p>
              )}
              {incident.status === "open" && <ResolveForm incident={incident} />}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
