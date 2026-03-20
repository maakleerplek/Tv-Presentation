FROM oven/bun:1-alpine
WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json bun.lock* ./

# Install dependencies using bun (much faster than npm)
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

EXPOSE 8080
CMD ["bun", "server.js"]
