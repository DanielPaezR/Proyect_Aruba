/**
 * Guarda el access token en memoria (no en localStorage) y expone un hook
 * para que el cliente HTTP notifique cuando una sesión deja de ser válida,
 * sin acoplar api/client.ts al AuthContext de React.
 */
let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
