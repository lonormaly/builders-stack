# @stack/api — Hono API. Build from the REPO ROOT (bun workspaces need the whole tree):
#   docker build -f infra/api.Dockerfile -t stack-api .
FROM oven/bun:1.1.34-slim AS deps
WORKDIR /app
# Copy manifests first so `bun install` is cached across source changes.
COPY package.json bun.lockb* ./
COPY apps ./apps
COPY services ./services
COPY libs ./libs
RUN bun install --frozen-lockfile

FROM oven/bun:1.1.34-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app /app
EXPOSE 3001
# API_PORT defaults to 3001; override via env at deploy time.
CMD ["bun", "--filter", "@stack/api", "start"]
