FROM oven/bun:1-alpine
WORKDIR /app

# Copy dependency files first for layer caching; the lockfile pins the versions
COPY package.json bun.lock ./

# Install dependencies using bun (much faster than npm)
RUN bun install --production --frozen-lockfile

# Copy source code (.dockerignore keeps the host's node_modules out)
COPY . .

USER bun

EXPOSE 8080
CMD ["bun", "server.js"]
