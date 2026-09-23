import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorText } from "@/components/ErrorText";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { useLogout } from "@/features/auth/hooks";
import { useAuthStore } from "@/features/auth/store";
import { useCreateCourierProfile, useMyCourierProfile } from "@/features/dispatch/api";
import type { VehicleType } from "@/features/dispatch/types";
import { colors, fontSize, radii, spacing } from "@/lib/theme";

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bike: "Bicicleta",
  motorcycle: "Moto",
  car: "Carro",
};

function CreateProfileForm() {
  const [vehicleType, setVehicleType] = useState<VehicleType>("motorcycle");
  const [plate, setPlate] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const createProfile = useCreateCourierProfile();

  return (
    <Card style={styles.formCard}>
      <Text style={styles.cardTitle}>Sé repartidor en NeirApp</Text>
      <Text style={styles.cardSubtitle}>
        Cuéntanos qué vehículo usas. Un administrador revisa tu solicitud antes de que puedas
        empezar a repartir.
      </Text>
      {createProfile.isError && <ErrorText error={createProfile.error} />}

      <Text style={styles.label}>Vehículo</Text>
      <View style={styles.optionRow}>
        {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setVehicleType(value as VehicleType)}
            style={[styles.option, vehicleType === value && styles.optionActive]}
          >
            <Text style={[styles.optionText, vehicleType === value && styles.optionTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {vehicleType !== "bike" && (
        <TextField
          label="Placa"
          value={plate}
          onChangeText={setPlate}
          autoCapitalize="characters"
          placeholder="ABC123"
        />
      )}

      <TextField label="Número de documento" value={idDocument} onChangeText={setIdDocument} />

      <Button
        title="Enviar solicitud"
        loading={createProfile.isPending}
        onPress={() =>
          createProfile.mutate({
            vehicle_type: vehicleType,
            plate: plate.trim() || null,
            id_document_number: idDocument.trim(),
          })
        }
      />
    </Card>
  );
}

function CourierStatusCard() {
  const profile = useMyCourierProfile();

  if (profile.isPending || profile.data === undefined) return null;
  const courierProfile = profile.data;
  if (courierProfile === null) return <CreateProfileForm />;

  if (!courierProfile.is_verified) {
    return (
      <Card style={styles.statusCard}>
        <Ionicons name="time" size={22} color={colors.panela} />
        <View style={styles.statusText}>
          <Text style={styles.cardTitle}>Solicitud en revisión</Text>
          <Text style={styles.cardSubtitle}>
            Ya recibimos tu solicitud como repartidor en {VEHICLE_LABELS[courierProfile.vehicle_type]}.
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.statusCard}>
      <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
      <View style={styles.statusText}>
        <Text style={styles.cardTitle}>Repartidor verificado</Text>
        <Text style={styles.cardSubtitle}>Ya puedes ver y tomar pedidos disponibles.</Text>
      </View>
    </Card>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Perfil</Text>
      <Card>
        <Text style={styles.cardTitle}>{user?.full_name}</Text>
        <Text style={styles.cardSubtitle}>{user?.email}</Text>
      </Card>

      <CourierStatusCard />

      <Button
        title="Cerrar sesión"
        variant="ghost"
        loading={logout.isPending}
        onPress={() => logout.mutate()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.ink },
  cardTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.ink },
  cardSubtitle: { fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  formCard: { gap: spacing.sm },
  label: { fontSize: 14, fontWeight: "500", color: colors.ink },
  optionRow: { flexDirection: "row", gap: spacing.xs },
  option: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  optionActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  optionText: { color: colors.ink },
  optionTextActive: { color: colors.brandDeep, fontWeight: "600" },
  statusCard: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  statusText: { flex: 1 },
});
