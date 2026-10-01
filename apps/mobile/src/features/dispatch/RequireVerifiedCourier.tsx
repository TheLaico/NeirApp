import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { Link } from "expo-router";
import { colors, fontSize, spacing } from "@/lib/theme";
import { useMyCourierProfile } from "./api";

/**
 * Pantallas que necesitan un repartidor verificado (disponibles, entrega activa, historial)
 * comparten esta verificación en vez de repetir el manejo de "sin perfil"/"pendiente" en cada una
 * — mismo error que devuelve el backend (`courier_profile_not_found`/`courier_not_verified`), acá
 * solo se traduce a una pantalla amigable en vez de dejar que la petición de datos falle.
 */
export function RequireVerifiedCourier({ children }: { children: ReactNode }) {
  const profile = useMyCourierProfile();

  if (profile.isPending) {
    return <ActivityIndicator style={styles.center} color={colors.brand} />;
  }

  if (!profile.data) {
    return (
      <Text style={styles.message}>
        Todavía no tienes un perfil de repartidor.{" "}
        <Link href="/(tabs)/profile" style={styles.link}>
          Créalo en Perfil
        </Link>
        .
      </Text>
    );
  }

  if (!profile.data.is_verified) {
    return (
      <Text style={styles.message}>
        Tu perfil de repartidor todavía está en revisión. Te avisaremos cuando un administrador lo
        apruebe.
      </Text>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: { marginTop: spacing.xl },
  message: { fontSize: fontSize.base, color: colors.muted, padding: spacing.lg },
  link: { color: colors.brand, fontWeight: "600" },
});
