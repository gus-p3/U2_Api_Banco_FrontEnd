# ---- Etapa 1: compilar la versión web de Expo (exporta a /app/dist) ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# La URL del backend se incrusta en el bundle al compilar.
# En Railway: define la variable EXPO_PUBLIC_API_URL (si no, usa la de src/core/config/env.ts).
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

RUN npx expo export --platform web

# ---- Etapa 2: servir los archivos estáticos ----
FROM node:22-alpine
WORKDIR /app

RUN npm install -g serve@14
COPY --from=build /app/dist ./dist

# Railway inyecta PORT; -s redirige cualquier ruta a index.html (SPA con expo-router)
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
