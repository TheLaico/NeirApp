import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { ErrorText } from "@/components/ErrorText";
import { useMyDeliveryHistory } from "@/features/dispatch/api";
import { RequireVerifiedCourier } from "@/features/dispatch/RequireVerifiedCourier";
import type { DeliveryDto, DeliveryStatus } from "@/features/dispatch/types";
import { colors, fontSize, radii, spacing } from "@/lib/theme";

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  assigned: "En curso",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  assigned: colors.panela,
  delivered: colors.brand,
  cancelled: colors.terracotta,
};

function HistoryRow({ delivery }: { delivery: DeliveryDto }) {
  return (
    <Card style={styles.row}>
      <View>
        <Text style={styles.rowTitle}>
          {delivery.stops.length} {delivery.stops.length === 1 ? "tienda" : "tiendas"}
        </Text>
        <Text style={styles.rowSubtitle}>
          {new Date(delivery.created_at).toLocaleString("es-CO", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[delivery.status]}22` }]}>
        <Text style={[styles.badgeText, { color: STATUS_COLORS[delivery.status] }]}>
          {STATUS_LABELS[delivery.status]}
        </Text>
      </View>
    </Card>
  );
}

function HistoryList() {
  const history = useMyDeliveryHistory();

  return (
    <FlatList
      data={history.data ?? []}
      keyExtractor={(d) => d.id}
      contentContainerStyle={styles.list}
      refreshing={history.isFetching}
      onRefresh={() => void history.refetch()}
      ListHeaderComponent={
        <>
          {history.isPending && <Text style={styles.empty}>Cargando…</Text>}
          {history.isError && <ErrorText error={history.error} />}
          {history.data?.length === 0 && (
            <Text style={styles.empty}>Todavía no has hecho entregas.</Text>
          )}
        </>
      }
      renderItem={({ item }) => <HistoryRow delivery={item} />}
    />
  );
}

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial de entregas</Text>
      </View>
      <View style={styles.body}>
        <RequireVerifiedCourier>
          <HistoryList />
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
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.ink },
  rowSubtitle: { fontSize: fontSize.sm, color: colors.muted },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill },
  badgeText: { fontSize: fontSize.sm, fontWeight: "600" },
  empty: { fontSize: fontSize.base, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
});
