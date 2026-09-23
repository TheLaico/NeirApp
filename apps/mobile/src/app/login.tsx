import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/Button";
import { ErrorText } from "@/components/ErrorText";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { useLogin } from "@/features/auth/hooks";
import { colors, fontSize, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.logo}
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.title}>NeirApp Repartidor</Text>
        <Text style={styles.subtitle}>Inicia sesión para ver los pedidos disponibles.</Text>
      </View>

      {login.isError && <ErrorText error={login.error} />}

      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      <Button
        title="Iniciar sesión"
        loading={login.isPending}
        onPress={() => login.mutate({ email: email.trim(), password })}
      />

      <Link href="/register" style={styles.link}>
        <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
      </Link>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  logo: { width: 64, height: 64, borderRadius: 16 },
  title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: fontSize.base, color: colors.muted, textAlign: "center" },
  link: { alignSelf: "center", marginTop: spacing.sm },
  linkText: { color: colors.brand, fontWeight: "600" },
});
