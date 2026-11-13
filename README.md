# Banco Digital — Frontend (React Native + Expo)

Aplicación bancaria multiplataforma (**Web** y **Android**) construida con **Expo SDK 58**, **React Native**, **Expo Router**, **TypeScript estricto**, **Zustand**, **TanStack Query**, **React Hook Form + Zod** y **Axios**.

## 1. Requisitos previos
- **Node.js** 20+ y `npm`
- **Java 21**, **PostgreSQL** y **Redis** corriendo para el backend (`../demo`)

## 2. Cómo ejecutar el backend (`demo`)
El backend se encuentra en `../demo` (rama `feature/frontend-support`, que habilita CORS, `GET /v1/clientes/me` y `GET /v1/cuentas/{accountNumber}/movimientos`):

```powershell
cd ..\demo
.\gradlew bootRun
```
- API disponible en: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Usuario demo precargado:
  - **Correo:** `alejandro.hernandez@banco-demo.com`
  - **Contraseña:** `PasswordSegura#2026`
  - **Cuenta:** `9876543210` (saldo inicial `$25,000.00 MXN`)

## 3. Cómo ejecutar el frontend (`frontend`)

```powershell
cd frontend
npm install

# Iniciar en Web (http://localhost:8081)
npm run web

# Iniciar en emulador Android
npm run android
```

### Variables de entorno
Por defecto (`.env` y `src/core/config/env.ts`), la app se conecta al **backend en la nube (Railway)**:
- **Cloud (Railway):** `https://bancodev-production.up.railway.app`

Si deseas apuntar al backend local, edita `.env` (ver `.env.example`):
```ini
# Web o dispositivo físico con `adb reverse tcp:8080 tcp:8080`:
EXPO_PUBLIC_API_URL=http://localhost:8080
# Emulador Android:
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080
```

## 4. Scripts de verificación y calidad
```powershell
npm run typecheck   # TypeScript estricto (tsc --noEmit)
npm run lint        # Verificación de estilo con Prettier
npm test            # Pruebas unitarias con Jest y React Native Testing Library
```

## 5. Arquitectura por features (Clean Architecture)
```text
frontend/
├── app/                        # Rutas Expo Router: (auth), (tabs), account/[accountNumber], payment/receipt
├── docs/
│   └── API_CONTRACT.md         # Contratos reales extraídos del backend
└── src/
    ├── app/                    # Providers (QueryClient, SafeArea) y bootstrap del AuthBridge
    ├── core/                   # env, cliente Axios con interceptor 401/refresh, mapeo de ErrorCode, SecureStore, JWT
    ├── shared/                 # Theme bancario (azul marino #0B1F4B + dorado #C9A227) y componentes UI reutilizables
    └── features/
        ├── auth/               # Login contraseña/biometría, enrolamiento de huella, guardia de expiración del JWT (aviso y renovación con refresh token)
        ├── accounts/           # Resumen de cliente (/v1/clientes/me), cuentas y movimientos (/v1/cuentas/{n}/movimientos)
        ├── payments/           # Catálogo GestoPago (/v1/productos/redis), pagos (/v1/pagos) con re-autenticación de huella y comprobante
        ├── catalogs/           # Catálogos INEGI/bancarios para onboarding
        └── profile/            # Datos del titular, activación/desactivación de huella y cierre de sesión
```

