# Build the static client bundle.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts
# The catalog is a committed build artifact (src/data/catalog.json); no backend.
RUN npm run build

# Serve the static dist with an unprivileged nginx (no backend, Rev01 is 100% client).
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
# nginx-unprivileged listens on 8080 by default and runs as a non-root user.
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
