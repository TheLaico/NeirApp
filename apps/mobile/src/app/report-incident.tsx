import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/Button";
import { ErrorText } from "@/components/ErrorText";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { useReportIncident } from "@/features/incidents/api";
import type { IncidentCategory } from "@/features/incidents/types";
import { colors, fontSize, radii, spacing } from "@/lib/theme";

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  wrong_item: "Me equivoqué de tienda/pedido",
  missing_item: "Faltó algo del pedido",
  damaged: "Llegó dañado",
  late_delivery: "Se demoró demasiado",
  other: "Otro",
};

export default function ReportIncidentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [category, setCategory] = useState<IncidentCategory>("late_delivery");
  const [description, setDescription] = useState("");
  const report = useReportIncident();

  return (
    <ScreenContainer scroll>
      <Text style={styles.subtitle}>Cuéntanos qué pasó con este pedido.</Text>

      {report.isError && <ErrorText error={report.error} />}

      <View style={styles.categoryList}>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setCategory(value as IncidentCategory)}
            style={[styles.categoryOption, category === value && styles.categoryOptionActive]}
          >
            <Text style={[styles.categoryText, category === value && styles.categoryTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        label="Descríbelo con tus palabras"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={styles.textarea}
        maxLength={1000}
      />

      <Button
        title="Enviar reporte"
        disabled={!description.trim() || !orderId}
        loading={report.isPending}
        onPress={() => {
          if (!orderId) return;
          report.mutate(
            { order_id: orderId, category, description },
            { onSuccess: () => router.back() },
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: fontSize.base, color: colors.muted },
  categoryList: { gap: spacing.xs },
  categoryOption: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  categoryOptionActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  categoryText: { fontSize: fontSize.base, color: colors.ink },
  categoryTextActive: { color: colors.brandDeep, fontWeight: "600" },
  textarea: { height: 100, textAlignVertical: "top", paddingTop: spacing.sm },
});
