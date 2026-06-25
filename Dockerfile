# syntax=docker/dockerfile:1

# Build stage: compiles the Soroban contract and the Next.js frontend.
FROM node:22-bookworm-slim AS builder

# Install Rust toolchain for contract compilation.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32v1-none

WORKDIR /app

# Install pnpm and frontend dependencies.
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy contract source and build WASM.
COPY contract/ ./contract/
RUN cd contract && cargo build --target wasm32v1-none --release

# Copy frontend source and build.
COPY . .
RUN pnpm build

# Production stage: runs the standalone Next.js server.
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
