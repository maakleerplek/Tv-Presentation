# ===== Build Stage =====
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files
COPY . .

# Build the Astro project
RUN npm run build

# ===== Production Stage =====
FROM nginx:alpine AS production

# Set timezone
ENV TZ=Europe/Brussels
RUN apk add --no-cache tzdata

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
