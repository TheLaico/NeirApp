import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";

// Se llama en el scope del módulo (no dentro de un componente): si se llama tarde, la splash
// screen nativa puede ocultarse sola antes de que sepamos si hay sesión guardada.
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function SplashScreenController() {
  const { isHydrated } = useAuth();
  useEffect(() => {
    if (isHydrated) SplashScreen.hide();
  }, [isHydrated]);
  return null;
}

function RootNavigator() {
  const { isAuthenticated } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report-incident" options={{ headerShown: true, title: "Reportar problema" }} />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SplashScreenController />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
