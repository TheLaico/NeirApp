import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/Button";
import { ErrorText } from "@/components/ErrorText";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { useRegister } from "@/features/auth/hooks";
import { colors, fontSize, spacing } from "@/lib/theme";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const register = useRegister();

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Crea tu cuenta</Text>
      <Text style={styles.subtitle}>Regístrate y luego solicita ser repartidor verificado.</Text>

      {register.isError && <ErrorText error={register.error} />}

      <TextField label="Nombre completo" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Celular"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Contraseña (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password-new"
      />

      <Pressable style={styles.termsRow} onPress={() => setAcceptedTerms((v) => !v)}>
        <Switch value={acceptedTerms} onValueChange={setAcceptedTerms} />
        <Text style={styles.termsText}>Acepto los términos y condiciones de NeirApp.</Text>
      </Pressable>

      <Button
        title="Crear cuenta"
        loading={register.isPending}
        disabled={!acceptedTerms}
        onPress={() =>
          register.mutate({
            email: email.trim(),
            password,
            full_name: fullName.trim(),
            phone: phone.trim(),
            accepted_terms: acceptedTerms,
          })
        }
      />

      <Link href="/login" style={styles.link}>
        <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
      </Link>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: fontSize.base, color: colors.muted, marginBottom: spacing.sm },
  termsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  termsText: { flex: 1, fontSize: fontSize.sm, color: colors.ink },
  link: { alignSelf: "center", marginTop: spacing.sm },
  linkText: { color: colors.brand, fontWeight: "600" },
});
