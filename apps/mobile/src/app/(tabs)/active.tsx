import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorText } from "@/components/ErrorText";
import { ScreenContainer } from "@/components/ScreenContainer";
import {
  useCancelDelivery,
  useConfirmDelivery,
  useMyActiveDelivery,
} from "@/features/dispatch/api";
import { RequireVerifiedCourier } from "@/features/dispatch/RequireVerifiedCourier";
import type { DeliveryDto, DeliveryStopDto } from "@/features/dispatch/types";
import { colors, fontSize, spacing } from "@/lib/theme";
import { TextField } from "@/components/TextField";

function orderedStops(delivery: DeliveryDto): DeliveryStopDto[] {
  const byId = new Map(delivery.stops.map((s) => [s.store_order_id, s]));
  const ordered = delivery.suggested_stop_order
    .map((id) => byId.get(id))
    .filter((s): s is DeliveryStopDto => !!s);
  const pickedUp = delivery.stops.filter((s) => s.is_picked_up);
  return [...ordered, ...pickedUp];
}

function StopRow({ stop, index }: { stop: DeliveryStopDto; index: number }) {
  return (
    <View style={styles.stopRow}>
      <Ionicons
        name={stop.is_picked_up ? "checkmark-circle" : "ellipse-outline"}
        size={22}
        color={stop.is_picked_up ? colors.brand : colors.muted}
      />
      <View style={styles.stopInfo}>
        <Text style={styles.stopTitle}>
          {index + 1}. {stop.store_name}
        </Text>
        {stop.is_picked_up ? (
          <Text style={styles.stopSubtitle}>Recogido</Text>
        ) : (
          <Text style={styles.stopSubtitle}>
            Código para la tienda: <Text style={styles.code}>{stop.pickup_code}</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

function ConfirmDeliveryForm({ delivery }: { delivery: DeliveryDto }) {
  const [code, setCode] = useState("");
  const confirmDelivery = useConfirmDelivery();

  return (
    <Card style={styles.formCard}>
      <Text style={styles.formTitle}>Confirmar entrega al cliente</Text>
      <Text style={styles.stopSubtitle}>Pídele al cliente el código de entrega.</Text>
      {confirmDelivery.isError && <ErrorText error={confirmDelivery.error} />}
      <TextField label="Código de entrega" value={code} onChangeText={setCode} maxLength={16} />
      <Button
        title="Confirmar entrega"
        loading={confirmDelivery.isPending}
        onPress={() => confirmDelivery.mutate({ deliveryId: delivery.id, code })}
      />
    </Card>
  );
}

function ActiveDeliveryContent() {
  const active = useMyActiveDelivery();
  const cancel = useCancelDelivery();

  if (active.isPending) return <Text style={styles.empty}>Cargando…</Text>;
  if (active.isError) return <ErrorText error={active.error} />;

  if (!active.data) {
    return <Text style={styles.empty}>No tienes ninguna entrega en curso.</Text>;
  }

  const delivery = active.data;

  return (
    <View style={{ gap: spacing.md }}>
      {orderedStops(delivery).map((stop, i) => (
        <Card key={stop.store_order_id}>
          <StopRow stop={stop} index={i} />
        </Card>
      ))}

      {delivery.all_stops_picked_up ? (
        <ConfirmDeliveryForm delivery={delivery} />
      ) : (
        <Text style={styles.stopSubtitle}>
          Recoge todos los pedidos para poder confirmar la entrega final.
        </Text>
      )}

      <View style={styles.footerRow}>
        <Button
          title="Cancelar entrega"
          variant="ghost"
          loading={cancel.isPending}
          onPress={() => cancel.mutate(delivery.id)}
        />
        <Link href={{ pathname: "/report-incident", params: { orderId: delivery.order_id } }} asChild>
          <Button title="Reportar un problema" variant="secondary" />
        </Link>
      </View>
    </View>
  );
}

export default function ActiveDeliveryScreen() {
  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Mi entrega actual</Text>
      <RequireVerifiedCourier>
        <ActiveDeliveryContent />
      </RequireVerifiedCourier>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.ink },
  empty: { fontSize: fontSize.base, color: colors.muted, marginTop: spacing.lg },
  stopRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  stopInfo: { flex: 1, gap: 2 },
  stopTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.ink },
  stopSubtitle: { fontSize: fontSize.sm, color: colors.muted },
  code: { fontWeight: "700", color: colors.ink },
  formCard: { gap: spacing.sm },
  formTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.ink },
  footerRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
});
