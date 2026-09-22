import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/TextField";
import { NeiraMap } from "../map/NeiraMap";
import { useCreateStore } from "./api";
import { CATEGORY_LABELS } from "./StoreIcon";
import type { StoreCategory } from "./types";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de tu tienda").max(120),
  category: z.enum(Object.keys(CATEGORY_LABELS) as [StoreCategory, ...StoreCategory[]]),
  description: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

export function CreateStoreForm() {
  const createStore = useCreateStore();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { category: "general" } });

  const onSubmit = handleSubmit((values) => {
    if (!location) {
      setLocationError(true);
      return;
    }
    setLocationError(false);
    createStore.mutate({
      name: values.name,
      category: values.category,
      description: values.description ?? "",
      lat: location.lat,
      lng: location.lng,
    });
  });

  return (
    <div className="mx-auto max-w-2xl rounded-card border border-line bg-white p-6 shadow-soft sm:p-8">
      <h1 className="text-2xl">Abre tu tienda en NeirApp</h1>
      <p className="mt-1.5 text-[15px] text-muted">
        Cuéntanos de tu negocio y marca su ubicación en el mapa. Luego podrás cargar tus productos.
      </p>

      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        {createStore.isError && <ErrorAlert message={errorMessage(createStore.error)} />}

        <TextField label="Nombre de la tienda" error={errors.name?.message} {...register("name")} />

        <div className="space-y-1.5">
          <label htmlFor="category" className="block text-sm font-medium text-ink">
            Categoría
          </label>
          <select
            id="category"
            className="h-11 w-full rounded-control border border-line bg-white px-3.5 text-[15px] text-ink focus:border-brand"
            {...register("category")}
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
            Descripción (opcional)
          </label>
          <textarea
            id="description"
            rows={3}
            className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink focus:border-brand"
            {...register("description")}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Ubicación</p>
          <p className="text-sm text-muted">Toca el mapa en el punto donde queda tu tienda.</p>
          <NeiraMap
            stores={[]}
            pickMode
            pickedLocation={location}
            onPick={(lat, lng) => {
              setLocation({ lat, lng });
              setLocationError(false);
            }}
            className="h-64 w-full overflow-hidden rounded-card border border-line"
          />
          {locationError && (
            <p role="alert" className="text-sm text-terracotta">
              Marca la ubicación de tu tienda en el mapa.
            </p>
          )}
        </div>

        <Button type="submit" fullWidth loading={createStore.isPending}>
          Crear tienda
        </Button>
      </form>
    </div>
  );
}
