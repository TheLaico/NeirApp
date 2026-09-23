import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { usePendingCouriers, useVerifyCourier } from "./api";
import type { CourierProfileDto, VehicleType } from "./types";

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bike: "Bicicleta",
  motorcycle: "Moto",
  car: "Carro",
};

function PendingCourierCard({ profile }: { profile: CourierProfileDto }) {
  const verify = useVerifyCourier();

  return (
    <li className="flex items-center justify-between gap-4 rounded-card border border-line bg-white p-4 shadow-soft">
      <div>
        <p className="text-[15px] font-medium text-ink">{VEHICLE_LABELS[profile.vehicle_type]}</p>
        {profile.plate && <p className="text-sm text-muted">Placa {profile.plate}</p>}
        <p className="text-sm text-muted">Documento {profile.id_document_number}</p>
      </div>
      <Button
        className="h-9 shrink-0 px-3"
        loading={verify.isPending}
        onClick={() => verify.mutate({ profileId: profile.id, isVerified: true })}
      >
        <Check size={16} aria-hidden="true" />
        Aprobar
      </Button>
    </li>
  );
}

export function AdminCouriersPage() {
  const pending = usePendingCouriers();

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al mapa
        </Link>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl">Repartidores por aprobar</h1>
          <div className="flex gap-4">
            <Link to="/admin/tiendas" className="text-sm font-medium text-brand hover:underline">
              Ver tiendas por aprobar
            </Link>
            <Link
              to="/admin/incidencias"
              className="text-sm font-medium text-brand hover:underline"
            >
              Ver reportes de problemas
            </Link>
          </div>
        </div>

        {pending.isPending && <p className="text-muted">Cargando…</p>}
        {pending.isError && <ErrorAlert message={errorMessage(pending.error)} />}
        {pending.data?.length === 0 && (
          <p className="text-muted">No hay repartidores pendientes de revisión.</p>
        )}

        <ul className="space-y-3">
          {pending.data?.map((profile) => (
            <PendingCourierCard key={profile.id} profile={profile} />
          ))}
        </ul>
      </main>
    </div>
  );
}
