import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router";
import { z } from "zod";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { AuthLayout } from "../../shared/ui/AuthLayout";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/TextField";
import { useRegister } from "./hooks";
import { useAuthStore } from "./store";

// Celular colombiano: 10 dígitos que empiezan por 3, con +57 opcional. El servidor valida de nuevo.
const PHONE_RE = /^(\+?57)?3\d{9}$/;

const schema = z.object({
  full_name: z.string().trim().min(2, "Escribe tu nombre completo").max(120),
  phone: z
    .string()
    .refine(
      (v) => PHONE_RE.test(v.replace(/[\s\-().]/g, "")),
      "Ingresa un celular colombiano válido",
    ),
  email: z.string().trim().min(1, "Ingresa tu correo").pipe(z.email("Ingresa un correo válido")),
  password: z.string().min(8, "Usa al menos 8 caracteres").max(128),
  accepted_terms: z.boolean().refine((v) => v, "Debes aceptar los términos para continuar"),
});
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((s) => s.user !== null);
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { accepted_terms: false },
  });

  if (isLoggedIn) return <Navigate to="/" replace />;

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Compra en las tiendas de Neira y recibe en tu puerta."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/ingresar" className="font-semibold text-brand hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((values) =>
          registerUser.mutate(values, { onSuccess: () => navigate("/", { replace: true }) }),
        )}
      >
        {registerUser.isError && <ErrorAlert message={errorMessage(registerUser.error)} />}
        <TextField
          label="Nombre completo"
          autoComplete="name"
          error={errors.full_name?.message}
          {...register("full_name")}
        />
        <TextField
          label="Celular"
          type="tel"
          autoComplete="tel"
          placeholder="300 123 4567"
          hint="Lo usaremos para coordinar tu entrega."
          error={errors.phone?.message}
          {...register("phone")}
        />
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="space-y-1.5">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-brand"
              aria-invalid={errors.accepted_terms ? true : undefined}
              {...register("accepted_terms")}
            />
            <span>
              Acepto los <strong className="font-semibold">términos y condiciones</strong> y la{" "}
              <strong className="font-semibold">política de privacidad</strong> de NeirApp.
            </span>
          </label>
          {errors.accepted_terms && (
            <p role="alert" className="text-sm text-terracotta">
              {errors.accepted_terms.message}
            </p>
          )}
        </div>

        <Button type="submit" fullWidth loading={registerUser.isPending}>
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
