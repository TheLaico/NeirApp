/**
 * En un dispositivo físico o el emulador, `localhost` apunta al propio teléfono, no a la
 * computadora que corre la API — hay que reemplazarlo por la IP de la LAN (`EXPO_PUBLIC_API_BASE_URL`
 * en un `.env`). El valor por defecto solo sirve para `expo start --web` en la misma máquina.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
