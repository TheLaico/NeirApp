import { useState } from "react";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Logo } from "../../shared/ui/Logo";
import { useAcceptTerms, useLogout, useTermsPolicy } from "./hooks";

/** Pantalla bloqueante cuando cambian los términos o la política de privacidad. */
export function TermsGate() {
  const policy = useTermsPolicy(true);
  const accept = useAcceptTerms();
  const logout = useLogout();
  const [checked, setChecked] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <div className="space-y-5 rounded-card border border-line bg-white p-6 shadow-soft sm:p-8">
        <div>
          <h1 className="text-2xl">Actualizamos nuestros términos</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            Para seguir usando NeirApp necesitamos que aceptes la versión vigente de los términos y
            condiciones y la política de privacidad.
          </p>
        </div>
        {accept.isError && <ErrorAlert message={errorMessage(accept.error)} />}
        {policy.isError && <ErrorAlert message={errorMessage(policy.error)} />}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-brand"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>Acepto los términos y condiciones y la política de privacidad.</span>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            fullWidth
            disabled={!checked || !policy.data}
            loading={accept.isPending}
            onClick={() => policy.data && accept.mutate(policy.data.documents)}
          >
            Aceptar y continuar
          </Button>
          <Button variant="ghost" fullWidth onClick={() => logout.mutate()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </main>
  );
}
