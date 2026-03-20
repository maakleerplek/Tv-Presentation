FROM oven/bun:1-alpine
WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json ./

# Install dependencies using bun (much faster than npm)
RUN bun install --production

# Copy source code
COPY . .

EXPOSE 8080
CMD ["bun", "server.js"]
