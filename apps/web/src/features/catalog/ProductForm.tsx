import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/TextField";
import { useCreateProduct, useUpdateProduct } from "./api";
import type { ProductDto } from "../stores/types";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del producto").max(120),
  description: z.string().max(500).optional(),
  price_cop: z.coerce.number().int().gt(0, "El precio debe ser mayor que cero"),
  image_url: z.string().trim().max(2048).optional(),
});
// `price_cop` se coacciona desde el <input type="number">: el tipo de entrada del formulario
// (antes de validar) es distinto al de salida (ya convertido a number).
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function ProductForm({
  storeId,
  product,
  onDone,
  onCancel,
}: {
  storeId: string;
  product?: ProductDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const createProduct = useCreateProduct(storeId);
  const updateProduct = useUpdateProduct(storeId);
  const mutation = product ? updateProduct : createProduct;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      price_cop: product?.price_cop,
      image_url: product?.image_url ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    const body = {
      name: values.name,
      description: values.description ?? "",
      price_cop: values.price_cop,
      image_url: values.image_url || null,
    };
    const action = product
      ? updateProduct.mutateAsync({ productId: product.id, body })
      : createProduct.mutateAsync(body);
    action.then(onDone).catch(() => undefined);
  });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="space-y-4 rounded-card border border-line bg-brand-soft/40 p-4"
    >
      {mutation.isError && <ErrorAlert message={errorMessage(mutation.error)} />}
      <TextField label="Nombre" error={errors.name?.message} {...register("name")} />
      <div className="space-y-1.5">
        <label htmlFor="product-description" className="block text-sm font-medium text-ink">
          Descripción
        </label>
        <textarea
          id="product-description"
          rows={2}
          className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink focus:border-brand"
          {...register("description")}
        />
      </div>
      <TextField
        label="Precio (COP)"
        type="number"
        inputMode="numeric"
        min={1}
        error={errors.price_cop?.message}
        {...register("price_cop")}
      />
      <TextField
        label="URL de la imagen (opcional)"
        error={errors.image_url?.message}
        {...register("image_url")}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending}>
          {product ? "Guardar cambios" : "Agregar producto"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
