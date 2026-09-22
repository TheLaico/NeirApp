import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { AuthLayout } from "../../shared/ui/AuthLayout";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/TextField";
import { useLogin } from "./hooks";
import { useAuthStore } from "./store";

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = useAuthStore((s) => s.user !== null);
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (isLoggedIn) return <Navigate to={from} replace />;

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Inicia sesión para pedir en las tiendas de Neira."
      footer={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link to="/registro" className="font-semibold text-brand hover:underline">
            Regístrate
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((values) =>
          login.mutate(values, { onSuccess: () => navigate(from, { replace: true }) }),
        )}
      >
        {login.isError && <ErrorAlert message={errorMessage(login.error)} />}
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" fullWidth loading={login.isPending}>
          Iniciar sesión
        </Button>
      </form>
    </AuthLayout>
  );
}
