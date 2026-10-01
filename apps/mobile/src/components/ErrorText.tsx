import { StyleSheet, Text } from "react-native";
import { colors } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";

export function ErrorText({ error }: { error: unknown }) {
  return (
    <Text accessibilityRole="alert" style={styles.text}>
      {errorMessage(error)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14, color: colors.terracotta },
});
