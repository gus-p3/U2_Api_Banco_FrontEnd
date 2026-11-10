/** Lectura (sin verificar firma) de los claims del JWT emitido por el backend. */
export interface JwtClaims {
  sub?: string;
  idClient?: number;
  idLogin?: number;
  role?: string;
  authMethod?: 'PASSWORD' | 'BIOMETRIC_HUELLA' | 'BIOMETRIC_FACIAL' | 'REFRESH';
  exp?: number;
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  // Decodifica UTF-8
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Devuelve los claims o `null` si el token no tiene formato JWT válido. */
export function decodeJwt(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtClaims;
  } catch {
    return null;
  }
}
