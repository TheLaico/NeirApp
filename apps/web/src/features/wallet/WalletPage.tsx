import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "../../lib/errors";
import { formatCop } from "../../lib/money";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { TextField } from "../../shared/ui/TextField";
import { useRequestWithdrawal, useWalletBalance, useWalletLedger } from "./api";

const REASON_LABELS: Record<string, string> = {
  delivery_completed: "Entrega completada",
  withdrawal: "Retiro",
};

function WithdrawalForm() {
  const [amount, setAmount] = useState("");
  const withdraw = useRequestWithdrawal();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const amountCop = Number(amount);
        if (amountCop > 0) withdraw.mutate(amountCop, { onSuccess: () => setAmount("") });
      }}
      className="space-y-3 rounded-card border border-line bg-white p-4 shadow-soft"
    >
      <p className="text-sm font-medium text-ink">Retirar saldo</p>
      {withdraw.isError && <ErrorAlert message={errorMessage(withdraw.error)} />}
      <TextField
        label="Monto a retirar (COP)"
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Button type="submit" fullWidth loading={withdraw.isPending}>
        Retirar
      </Button>
    </form>
  );
}

export function WalletPage() {
  const balance = useWalletBalance();
  const ledger = useWalletLedger();

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

        <h1 className="mb-4 text-2xl">Mi billetera</h1>

        <div className="mb-4 rounded-card border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-muted">Saldo disponible</p>
          <p className="font-display text-3xl font-semibold text-ink">
            {balance.isPending ? "…" : formatCop(balance.data?.balance_cop ?? 0)}
          </p>
        </div>

        <div className="mb-4">
          <WithdrawalForm />
        </div>

        <h2 className="mb-3 text-lg font-semibold text-ink">Movimientos</h2>
        {ledger.isPending && <p className="text-muted">Cargando…</p>}
        {ledger.data?.length === 0 && <p className="text-muted">Todavía no tienes movimientos.</p>}
        <ul className="space-y-2">
          {ledger.data?.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded-card border border-line bg-white p-3.5 shadow-soft"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {REASON_LABELS[entry.reason] ?? entry.reason}
                </p>
                <p className="text-sm text-muted">
                  {new Date(entry.created_at).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <span
                className={`tabular-nums font-medium ${entry.type === "credit" ? "text-brand" : "text-terracotta"}`}
              >
                {entry.type === "credit" ? "+" : "-"}
                {formatCop(entry.amount_cop)}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
