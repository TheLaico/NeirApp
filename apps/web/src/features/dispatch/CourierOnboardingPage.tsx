import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, BadgeCheck, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { TextField } from "../../shared/ui/TextField";
import { useCreateCourierProfile, useMyCourierProfile } from "./api";
import type { VehicleType } from "./types";

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bike: "Bicicleta",
  motorcycle: "Moto",
  car: "Carro",
};

const schema = z.object({
  vehicle_type: z.enum(["bike", "motorcycle", "car"]),
  plate: z.string().trim().max(16).optional(),
  id_document_number: z.string().trim().min(4, "Ingresa tu número de documento").max(32),
});
type FormValues = z.infer<typeof schema>;

function CreateProfileForm() {
  const createProfile = useCreateCourierProfile();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { vehicle_type: "motorcycle" } });
  const vehicleType = useWatch({ control, name: "vehicle_type" });

  const onSubmit = handleSubmit((values) => {
    createProfile.mutate({
      vehicle_type: values.vehicle_type,
      plate: values.plate?.length ? values.plate : null,
      id_document_number: values.id_document_number,
    });
  });

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
      {createProfile.isError && <ErrorAlert message={errorMessage(createProfile.error)} />}

      <div className="space-y-1.5">
        <label htmlFor="vehicle_type" className="block text-sm font-medium text-ink">
          Vehículo
        </label>
        <select
          id="vehicle_type"
          className="h-11 w-full rounded-control border border-line bg-white px-3.5 text-[15px] text-ink focus:border-brand"
          {...register("vehicle_type")}
        >
          {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {vehicleType !== "bike" && (
        <TextField
          label="Placa"
          placeholder="ABC123"
          error={errors.plate?.message}
          {...register("plate")}
        />
      )}

      <TextField
        label="Número de documento"
        error={errors.id_document_number?.message}
        {...register("id_document_number")}
      />

      <Button type="submit" fullWidth loading={createProfile.isPending}>
        Enviar solicitud
      </Button>
    </form>
  );
}

export function CourierOnboardingPage() {
  const profile = useMyCourierProfile();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al mapa
        </Link>

        <div className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-8">
          {profile.isPending && <p className="text-muted">Cargando…</p>}

          {profile.data === null && (
            <>
              <h1 className="text-2xl">Sé repartidor en NeirApp</h1>
              <p className="mt-1.5 text-[15px] text-muted">
                Cuéntanos qué vehículo usas. Un administrador revisa tu solicitud antes de que
                puedas empezar a repartir.
              </p>
              <CreateProfileForm />
            </>
          )}

          {profile.data && !profile.data.is_verified && (
            <div className="flex items-start gap-3">
              <Clock size={22} className="mt-0.5 shrink-0 text-panela" aria-hidden="true" />
              <div>
                <h1 className="text-xl font-semibold text-ink">Solicitud en revisión</h1>
                <p className="mt-1 text-[15px] text-muted">
                  Ya recibimos tu solicitud como repartidor en {VEHICLE_LABELS[profile.data.vehicle_type]}.
                  Te avisaremos cuando un administrador la apruebe.
                </p>
              </div>
            </div>
          )}

          {profile.data?.is_verified && (
            <div className="flex items-start gap-3">
              <BadgeCheck size={22} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <div className="w-full">
                <h1 className="text-xl font-semibold text-ink">Ya eres repartidor verificado</h1>
                <p className="mt-1 text-[15px] text-muted">
                  Puedes ver los pedidos disponibles para repartir cuando quieras.
                </p>
                <Button className="mt-4" onClick={() => void navigate("/repartidor/disponibles")}>
                  Ver pedidos disponibles
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
