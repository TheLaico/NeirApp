import { RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/lib/theme";

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Contenedor estándar de pantalla: fondo de marca, respeta el notch/status bar, scroll opcional. */
export function ScreenContainer({
  scroll = false,
  onRefresh,
  refreshing = false,
  style,
  children,
  ...rest
}: ScreenContainerProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentContainerStyle={[styles.content, style]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
            ) : undefined
          }
          {...rest}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={[styles.content, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
});
