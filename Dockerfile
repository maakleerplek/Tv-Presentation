# ===== Build Stage =====
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time env var for Java API
ENV API_BASE_URL="http://host.docker.internal:8080"

RUN npm run build

# ===== Production Stage =====
FROM nginx:alpine AS production

# Install openssl for self-signed cert generation
RUN apk add --no-cache openssl

# Copy built static files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config as template (envsubst will process it at startup)
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
