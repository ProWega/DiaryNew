# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app

# More aggressive network resilience — npm registry from some networks
# (RU/corporate) needs longer timeouts and more retries.
# NPM_REGISTRY (build-arg) — позволяет переопределить registry на зеркало:
#   docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com ...
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
    NPM_CONFIG_FETCH_TIMEOUT=600000 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

COPY package*.json ./
# --ignore-scripts: skip husky `prepare` (no .git in build context) and any other
# postinstall hooks. They're dev-time conveniences, not needed for the build.
RUN npm ci --legacy-peer-deps --ignore-scripts

FROM deps AS build
WORKDIR /app

COPY index.html vite.config.mjs ./
COPY src ./src
COPY public ./public
# RussiaMap imports a JSON registry from server/seed/data — frontend reaches
# across the layout boundary. Copy just the data subtree so vite can resolve
# the import without dragging the whole server tree into the build stage.
COPY server/seed/data ./server/seed/data
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
    NODE_ENV=production \
    APP_MODE=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "npm run prod:init && node server/index.cjs"]
