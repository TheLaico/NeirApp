import { colors, radii } from "@neirapp/design-tokens";

/**
 * `@neirapp/design-tokens` ya trae `colors`/`radii` listos para usarse tal cual en React Native
 * (son solo strings/números). `fonts` y `shadows` del paquete son valores CSS (font-family con
 * fallbacks, box-shadow) que no aplican directo a StyleSheet de RN — se reemplazan aquí por sus
 * equivalentes nativos en vez de forzarlos en el paquete compartido, que sigue siendo agnóstico
 * de plataforma.
 */
export { colors, radii };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const shadow = {
  shadowColor: "#202724",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
} as const;

export const fontSize = { sm: 13, base: 15, lg: 18, xl: 22, xxl: 28 } as const;
