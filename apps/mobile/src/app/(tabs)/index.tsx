import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorText } from "@/components/ErrorText";
import { useAvailableDeliveries, useClaimDelivery, useMyActiveDelivery } from "@/features/dispatch/api";
import { RequireVerifiedCourier } from "@/features/dispatch/RequireVerifiedCourier";
import type { ClaimableOrderDto } from "@/features/dispatch/types";
import { colors, fontSize, spacing } from "@/lib/theme";

function AvailableOrderCard({ order }: { order: ClaimableOrderDto }) {
  const claim = useClaimDelivery();

  return (
    <Card style={styles.card}>
      {claim.isError && claim.variables === order.order_id && <ErrorText error={claim.error} />}
      <Text style={styles.storeCount}>
        {order.stops.length} {order.stops.length === 1 ? "tienda" : "tiendas"}
      </Text>
      {order.stops.map((stop) => (
        <Text key={stop.store_order_id} style={styles.storeName}>
          {stop.store_name}
        </Text>
      ))}
      {!!order.delivery_notes && (
        <Text style={styles.notes}>Notas de entrega: {order.delivery_notes}</Text>
      )}
      <Button
        title="Tomar este pedido"
        loading={claim.isPending && claim.variables === order.order_id}
        onPress={() =>
          claim.mutate(order.order_id, { onSuccess: () => router.push("/(tabs)/active") })
        }
      />
    </Card>
  );
}

function AvailableDeliveriesList() {
  const active = useMyActiveDelivery();
  const available = useAvailableDeliveries();

  return (
    <FlatList
      data={available.data ?? []}
      keyExtractor={(order) => order.order_id}
      contentContainerStyle={styles.list}
      refreshing={available.isFetching}
      onRefresh={() => void available.refetch()}
      ListHeaderComponent={
        <>
          {active.data && (
            <Card style={styles.banner}>
              <Text style={styles.bannerText}>Ya tienes una entrega en curso.</Text>
            </Card>
          )}
          {available.isPending && <Text style={styles.empty}>Cargando…</Text>}
          {available.isError && <ErrorText error={available.error} />}
          {available.data?.length === 0 && (
            <Text style={styles.empty}>No hay pedidos disponibles por ahora.</Text>
          )}
        </>
      }
      renderItem={({ item }) => <AvailableOrderCard order={item} />}
    />
  );
}

export default function AvailableDeliveriesScreen() {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Pedidos disponibles</Text>
      </View>
      <View style={styles.body}>
        <RequireVerifiedCourier>
          <AvailableDeliveriesList />
        </RequireVerifiedCourier>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { padding: spacing.lg, paddingBottom: 0 },
  body: { flex: 1 },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.ink },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.xs },
  storeCount: { fontSize: fontSize.base, fontWeight: "600", color: colors.ink },
  storeName: { fontSize: fontSize.sm, color: colors.muted },
  notes: { fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.xs },
  banner: { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  bannerText: { color: colors.brandDeep, fontWeight: "600" },
  empty: { fontSize: fontSize.base, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
});
