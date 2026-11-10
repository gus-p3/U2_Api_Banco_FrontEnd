# Contrato real del backend (extraído de `demo/src/main/java/...`)

Base URL: web `http://localhost:8080`, emulador Android `http://10.0.2.2:8080`.
Jackson: `fail-on-unknown-properties=true`, `non_null` (campos nulos se omiten → opcionales en TS), `allow-coercion-of-scalars=false` (enviar números como number, no string).

## Autenticación (`/v1/auth`)
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/login` | `{email, password}` | `AuthResponse` |
| POST | `/login-biometrico` | `{email, biometricType: "HUELLA"\|"FACIAL", biometricData: base64, deviceId?}` | `AuthResponse` |
| POST | `/biometria` | `{idClient: number, biometricType, biometricData}` | `AuthResponse` |
| POST | `/refresh` | `{refreshToken}` | `AuthResponse` |
| POST | `/logout?email=` | – | 204 |
| GET | `/session-status` (alias `/estado-servidor`) | – | `ServerSessionStatusResponse` |

- `AuthRequest.password`: 12–100 chars, con mayúscula, minúscula, número y especial `[@$!%*?&.#_-]`.
- `AuthResponse`: `token, refreshToken, tokenType, expiresIn, email, isActive, hasBiometricRegistered, biometricType?, lastLoginAt?` (**`idClient` está con `@JsonIgnore`, no llega al cliente**).
- `ServerSessionStatusResponse`: `isLoggedIn, inactivitySeconds, maxInactivitySeconds, remainingSeconds, userEmail?, clientId?, status, lastActivityAt?, message`.
- JWT: access 300 s. Claims: `sub=email, idClient, idLogin, role, authMethod` (`PASSWORD | BIOMETRIC_HUELLA | BIOMETRIC_FACIAL | REFRESH`).
- Demo: `alejandro.hernandez@banco-demo.com` / `PasswordSegura#2026`; huella `dGhpcy1pcy1hLXZhbGlkLWJpb21ldHJpYy1zaWduYXR1cmUtZGF0YQ==`; saldo 25000; cuenta demo en Swagger `9876543210`.

## Sesión de servidor (`ServerSessionInterceptor`)
- Es un **booleano global en el servidor** (no por usuario) con inactividad de 300 s. Cada petición protegida lo renueva.
- Peticiones protegidas sin sesión → 401 con cuerpo **distinto** a `ErrorResponse`: `{timestamp, status, error, message, path, inactivityLimitSeconds}`.
- Públicas: `/v1/auth/login*`, `refresh`, `session-status`, `GET /v1/catalogos/**`, `POST /v1/clientes` (onboarding) y `/v1/catalogos/sincronizar`.

## Clientes (`/v1/clientes`)
- `GET /v1/clientes/me?includes=accounts,home,contact,employment` (con `Authorization: Bearer`) → `ClientResponse` del titular del JWT.
- `POST /buscar?includes=accounts,home,contact,employment` body opcional `ClientUnifiedQueryRequest {curp?, rfc?, idNationality?, activo?, desde?, hasta?, sortBy?, sortDirection?}` → `ClientResponse[]`.
- `POST /v1/clientes` onboarding (`ClientOnboardingRequest`, ver DTO), `PATCH` actualización parcial, `DELETE` desactivar.
- `ClientResponse` (sin `idClient`): nombres, `birthDate, curp, rfc, idGender, genderName, idNationality, nationalityName, idMaritalStatus, maritalStatusName, isActive, primaryAccount?, accounts?, contactDetail?, home?, employmentInformation?`.
- `AccountResponse`: `idAccount, accountNumber, balance, status, openedAt, updatedAt`.

## Cuentas (`/v1/cuentas`)
- `GET /v1/cuentas/{accountNumber}/movimientos` (con `Authorization: Bearer`, valida que la cuenta pertenezca al cliente del JWT) → `AccountBalanceMovementResponse[]`.

## Pagos (`POST /v1/pagos`) — `Authorization: Bearer` obligatorio
- Body `PagoRequest`: `numCuenta` (10 dígitos), `idServicio`, `idProducto`, `tipoPago: RECARGA|SERVICIO`, `telefono?` (10 díg., recarga), `referencia?` (1–100, servicio), `monto?` (>0, 2 decimales; servicio).
- Teléfono y referencia **no** pueden ir juntos.
- Respuesta `PagoResponse`: `codigo` (1 aplicado, 0 no), `mensaje, estado (PENDIENTE|APLICADO|RECHAZADO|POR_CONFIRMAR), codigoGestoPago?, numAutorizacion?, idTx?, upc?`.
- **Solo funciona con JWT de login biométrico HUELLA** (si no: 403 `STRONG_AUTH_REQUIRED`). Un token refrescado (`REFRESH`) tampoco sirve.

## Productos
`GET /v1/productos`, `GET /v1/productos/redis`, `GET /v1/productos/{id}` → `ProductoResponse`: `id, producto, servicio, idServicio, idProducto, idCatTipoServicio, tipoFront, hasDigitoVerificador, tipoReferencia, precio (string), showAyuda, createdAt`.

## Catálogos (`GET /v1/catalogos/...`)
`generos`, `nacionalidades`, `estados-civiles` (`{id*, name, description, isActive}`), `estados` (`{idState, cveEnt, name, isActive}`), `municipios/{cveEnt}` (`{idMunicipality, idState, cveMun, name, isActive}`).

## Errores
Formato: `{ error: { code, message, target?, details?: [{code,target,message}] } }`.
`ErrorCode`: CLIENT_NOT_FOUND 404, ACCOUNT_NOT_FOUND 404, CATALOG_NOT_FOUND 404, CURP/RFC/EMAIL/PHONE_DUPLICATED 409, CLIENT_INACTIVE 422, INVALID_AGE 422, STATE_MISMATCH 422, BUSINESS_VALIDATION 422, INSUFFICIENT_FUNDS 422, PAYMENT_ACCOUNT_INACTIVE 422, PAYMENT_PRODUCT_MISMATCH 422, INVALID_PAYMENT_REQUEST 400, INVALID_CREDENTIALS 401, BIOMETRIC_AUTH_FAILED 401, TOKEN_EXPIRED_OR_INVALID 401, TOKEN_MISSING 401, SESSION_INACTIVE 401, ACCOUNT_LOCKED 423, ACCESS_DENIED 403, STRONG_AUTH_REQUIRED 403, PAYMENT_FORBIDDEN 403.
Genéricos: BAD_REQUEST, METHOD_NOT_ALLOWED, FORBIDDEN, INTERNAL_ERROR, SERVER_ERROR, INVALID_PARAM.

## ⚠️ Brechas detectadas (requieren decisión)
1. **No existe endpoint de movimientos** (`AccountBalanceMovementResponse` existe pero ningún controlador lo expone).
2. **No hay forma de obtener "mi cliente"**: `idClient` está oculto y `/clientes/buscar` solo filtra por CURP/RFC/nacionalidad/estado/fechas (no por email ni id). Sin filtro devuelve todos los clientes.
3. **No hay CORS** → el navegador bloqueará la web (`localhost:8081` → `:8080`).
4. **Pagar exige huella** y un token con `authMethod=BIOMETRIC_HUELLA`; en web no hay biometría real.
5. La sesión de servidor es global: dos usuarios simultáneos se pisan.
6. `banco_app\` no es repo git; el repo está en `demo\` (rama `dev`).

