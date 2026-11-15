# Contrato real del backend (extraído de `demo/src/main/java/...`)

Base URL: web `http://localhost:8080`, emulador Android `http://10.0.2.2:8080`.
Jackson: `fail-on-unknown-properties=true`, `non_null` (campos nulos se omiten → opcionales en TS), `allow-coercion-of-scalars=false` (enviar números como number, no string).

## Autenticación (`/v1/auth`)
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/login` | `{email, password}` | `AuthResponse` |
| POST | `/login-biometrico` | `{email, biometricType: "HUELLA"\|"FACIAL", biometricData: base64, deviceId?}` | `AuthResponse` |
| POST | `/biometria` (requiere Bearer; un CLIENT solo su propio `idClient`) | `{idClient: number, biometricType, biometricData}` | `AuthResponse` |
| POST | `/refresh` | `{refreshToken}` | `AuthResponse` |
| POST | `/logout` (requiere Bearer; revoca el refresh token del dueño del JWT) | – | 204 |
| POST | `/confirmar-operacion` (requiere Bearer) | `{password?, biometricType?: "HUELLA", biometricData?: base64}` | `OperationConfirmResponse {confirmationToken, expiresIn}` |

- `AuthRequest.password`: 12–100 chars, con mayúscula, minúscula, número y especial `[@$!%*?&.#_-]`.
- `AuthResponse`: `token, refreshToken, tokenType, expiresIn, email, role, isActive, hasBiometricRegistered, biometricType?, lastLoginAt?` (**`idClient` está con `@JsonIgnore`, no llega al cliente**).
- `OperationConfirmResponse`: `confirmationToken` (token efímero de 120 s, de **un solo uso** y ligado al `idClient` del JWT).
- JWT stateless: access 300 s, el front calcula el tiempo restante con el claim `exp` y renueva con `/refresh`. Claims: `sub=email, idClient, idLogin, role (CLIENT|ADMIN), authMethod` (`PASSWORD | BIOMETRIC_HUELLA | BIOMETRIC_FACIAL | REFRESH`).
- Demo: `alejandro.hernandez@banco-demo.com` / `PasswordSegura#2026`; huella `dGhpcy1pcy1hLXZhbGlkLWJpb21ldHJpYy1zaWduYXR1cmUtZGF0YQ==`; saldo 25000; cuenta demo en Swagger `9876543210`.

## Seguridad (Spring Security + JWT, sin sesión de servidor)
- Ya **no existe** el booleano global de sesión ni `/v1/auth/session-status`.
- Errores 401/403 usan el formato `ErrorResponse`: `TOKEN_MISSING`, `TOKEN_EXPIRED_OR_INVALID` (el cliente HTTP renueva con refresh y reintenta) y `ACCESS_DENIED` (403, rol insuficiente).
- Públicas: `/v1/auth/login*`, `refresh`, `GET /v1/catalogos/**` y `POST /v1/clientes` (onboarding). Todo lo demás requiere Bearer.
- Solo `ADMIN`: `POST /v1/clientes/buscar`, `PATCH`/`DELETE /v1/clientes`, escritura de productos, `/personas*` y `POST /v1/catalogos/sincronizar`.

## Clientes (`/v1/clientes`)
- `GET /v1/clientes/me?includes=accounts,home,contact,employment` (con `Authorization: Bearer`) → `ClientResponse` del titular del JWT.
- `POST /buscar?includes=accounts,home,contact,employment` body opcional `ClientUnifiedQueryRequest {curp?, rfc?, idNationality?, activo?, desde?, hasta?, sortBy?, sortDirection?}` → `ClientResponse[]`. **Solo rol ADMIN** (un CLIENT recibe 403); la app móvil usa únicamente `/me`.
- `POST /v1/clientes` onboarding (`ClientOnboardingRequest`, ver DTO), `PATCH` actualización parcial, `DELETE` desactivar.
- `ClientResponse` (sin `idClient`): nombres, `birthDate, curp, rfc, idGender, genderName, idNationality, nationalityName, idMaritalStatus, maritalStatusName, isActive, primaryAccount?, accounts?, contactDetail?, home?, employmentInformation?`.
- `AccountResponse`: `idAccount, accountNumber, balance, status, openedAt, updatedAt`.

## Cuentas (`/v1/cuentas`)
- `GET /v1/cuentas/{accountNumber}/movimientos` (con `Authorization: Bearer`, valida que la cuenta pertenezca al cliente del JWT) → `AccountBalanceMovementResponse[]`.

## Validación de referencias (`POST /v1/referencias/validar`) — `Authorization: Bearer` obligatorio
- Body `ValidarReferenciaRequest`: `{idServicio, idProducto, referencia, monto?}`.
- Valida existencia del producto en el catálogo real de GestoPago, formato según `tipoReferencia` y `hasDigitoVerificador`, y guarda la validación temporal en Redis ligada al cliente, servicio, producto y referencia.
- Respuesta `ValidarReferenciaResponse`: `{valida, estadoValidacion ("VALIDA"|"INVALIDA"), validationId?, idServicio, idProducto, referencia, nombreServicio, nombreProducto, categoria, descripcion, titular?, adeudo?, montoValidado?, mensaje}`.

## Pagos (`/v1/pagos`) — `Authorization: Bearer` obligatorio
- **`POST /v1/pagos`**:
  - Header adicional obligatorio: `X-Confirmation-Token: <token>` obtenido de `POST /v1/auth/confirmar-operacion` (funciona en **Web y Android** con cualquier JWT válido; si falta, expiró, fue reutilizado o pertenece a otro cliente devuelve `403 STRONG_AUTH_REQUIRED`).
  - Body `PagoRequest`: `numCuenta` (10 dígitos), `idServicio`, `idProducto`, `tipoPago: RECARGA|SERVICIO`, `telefono?` (10 díg., recarga), `referencia?` (1–100, servicio), `monto?` (>0, 2 decimales; servicio).
  - En pagos de tipo `SERVICIO`, la referencia debe haber sido validada previamente en `POST /v1/referencias/validar` (de lo contrario devuelve `422 REFERENCE_NOT_VALIDATED`).
  - Respuesta `PagoResponse`: `codigo` (1 aplicado, 0 no), `mensaje, estado (PENDIENTE|APLICADO|RECHAZADO|POR_CONFIRMAR), codigoGestoPago?, numAutorizacion?, idTx?, upc?`.
- **`GET /v1/pagos`**:
  - Historial paginado de pagos del cliente autenticado (`?estado=APLICADO|POR_CONFIRMAR|RECHAZADO&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&page=0&size=10`).
  - Respuesta `PagoHistorialPageResponse`: `{content: PagoDetalleResponse[], page, size, totalElements, totalPages, last}` con `referencia` / `telefono` parcialmente enmascarados (`********1234`).
- **`GET /v1/pagos/{idOrUpc}`**:
  - Consulta de detalle o actualización de estado de un pago del propio cliente por ID numérico o por folio `upc` (`403 PAYMENT_FORBIDDEN` si pertenece a otro cliente, `404 PAYMENT_NOT_FOUND` si no existe).

## Productos
`GET /v1/productos`, `GET /v1/productos/redis`, `GET /v1/productos/{id}` → `ProductoResponse`: `id, producto, servicio, idServicio, idProducto, idCatTipoServicio, tipoFront, hasDigitoVerificador, tipoReferencia, precio (string), showAyuda, legend, categoria, createdAt`.

## Catálogos (`GET /v1/catalogos/...`)
`generos`, `nacionalidades`, `estados-civiles` (`{id*, name, description, isActive}`), `estados` (`{idState, cveEnt, name, isActive}`), `municipios/{cveEnt}` (`{idMunicipality, idState, cveMun, name, isActive}`).

## Errores
Formato: `{ error: { code, message, target?, details?: [{code,target,message}] } }`.
`ErrorCode`: CLIENT_NOT_FOUND 404, ACCOUNT_NOT_FOUND 404, CATALOG_NOT_FOUND 404, PAYMENT_NOT_FOUND 404, CURP/RFC/EMAIL/PHONE_DUPLICATED 409, CLIENT_INACTIVE 422, INVALID_AGE 422, STATE_MISMATCH 422, BUSINESS_VALIDATION 422, INSUFFICIENT_FUNDS 422, PAYMENT_ACCOUNT_INACTIVE 422, PAYMENT_PRODUCT_MISMATCH 422, REFERENCE_NOT_VALIDATED 422, INVALID_SERVICE_REFERENCE 422, GESTOPAGO_PROVIDER_ERROR 502, INVALID_PAYMENT_REQUEST 400, INVALID_CREDENTIALS 401, BIOMETRIC_AUTH_FAILED 401, TOKEN_EXPIRED_OR_INVALID 401, TOKEN_MISSING 401, SESSION_INACTIVE 401, ACCOUNT_LOCKED 423, ACCESS_DENIED 403, STRONG_AUTH_REQUIRED 403, PAYMENT_FORBIDDEN 403.
Genéricos: BAD_REQUEST, METHOD_NOT_ALLOWED, FORBIDDEN, INTERNAL_ERROR, SERVER_ERROR, INVALID_PARAM.

