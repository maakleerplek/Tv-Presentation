# ===== Build Stage =====
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time env vars (the fetch to Java API happens at build time in SSG mode)
ENV API_BASE_URL="http://host.docker.internal:8080"

RUN npm run build

# ===== Production Stage =====
FROM nginx:alpine AS production

# Copy built static files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
