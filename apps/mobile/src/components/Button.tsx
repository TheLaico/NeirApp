import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radii } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
}

export function Button({ title, variant = "primary", loading, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.brand} />
      ) : (
        <Text style={[styles.text, textVariantStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radii.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  text: { fontSize: 15, fontWeight: "600" },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.brandSoft },
  ghost: { backgroundColor: "transparent" },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.brandDeep },
  ghost: { color: colors.brand },
});
