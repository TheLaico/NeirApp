import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorText } from "@/components/ErrorText";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { useRequestWithdrawal, useWalletBalance, useWalletLedger } from "@/features/wallet/api";
import { colors, fontSize, spacing } from "@/lib/theme";

const REASON_LABELS: Record<string, string> = {
  delivery_completed: "Entrega completada",
  withdrawal: "Retiro",
};

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function WithdrawalForm() {
  const [amount, setAmount] = useState("");
  const withdraw = useRequestWithdrawal();

  return (
    <Card style={styles.formCard}>
      <Text style={styles.formTitle}>Retirar saldo</Text>
      {withdraw.isError && <ErrorText error={withdraw.error} />}
      <TextField
        label="Monto a retirar (COP)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <Button
        title="Retirar"
        loading={withdraw.isPending}
        onPress={() => {
          const amountCop = Number(amount);
          if (amountCop > 0) withdraw.mutate(amountCop, { onSuccess: () => setAmount("") });
        }}
      />
    </Card>
  );
}

export default function WalletScreen() {
  const balance = useWalletBalance();
  const ledger = useWalletLedger();

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Mi billetera</Text>

      <Card>
        <Text style={styles.balanceLabel}>Saldo disponible</Text>
        <Text style={styles.balanceValue}>
          {balance.isPending ? "…" : cop.format(balance.data?.balance_cop ?? 0)}
        </Text>
      </Card>

      <WithdrawalForm />

      <Text style={styles.sectionTitle}>Movimientos</Text>
      {ledger.isPending && <Text style={styles.empty}>Cargando…</Text>}
      {ledger.data?.length === 0 && <Text style={styles.empty}>Todavía no tienes movimientos.</Text>}
      <View style={{ gap: spacing.sm }}>
        {ledger.data?.map((entry) => (
          <Card key={entry.id} style={styles.ledgerRow}>
            <View>
              <Text style={styles.ledgerReason}>{REASON_LABELS[entry.reason] ?? entry.reason}</Text>
              <Text style={styles.ledgerDate}>
                {new Date(entry.created_at).toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Text>
            </View>
            <Text
              style={[
                styles.ledgerAmount,
                { color: entry.type === "credit" ? colors.brand : colors.terracotta },
              ]}
            >
              {entry.type === "credit" ? "+" : "-"}
              {cop.format(entry.amount_cop)}
            </Text>
          </Card>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.ink },
  balanceLabel: { fontSize: fontSize.sm, color: colors.muted },
  balanceValue: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.ink },
  formCard: { gap: spacing.sm },
  formTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.ink },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.ink },
  empty: { fontSize: fontSize.base, color: colors.muted },
  ledgerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ledgerReason: { fontSize: fontSize.base, fontWeight: "500", color: colors.ink },
  ledgerDate: { fontSize: fontSize.sm, color: colors.muted },
  ledgerAmount: { fontSize: fontSize.base, fontWeight: "600" },
});
