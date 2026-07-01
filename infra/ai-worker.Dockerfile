# @stack/ai-worker — background queue consumer (no HTTP port). Build from the REPO ROOT:
#   docker build -f infra/ai-worker.Dockerfile -t stack-ai-worker .
FROM oven/bun:1.1.34-slim AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
COPY apps ./apps
COPY services ./services
COPY libs ./libs
RUN bun install --frozen-lockfile

FROM oven/bun:1.1.34-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app /app
# No EXPOSE — this worker pulls from the Redis queue, it doesn't serve.
CMD ["bun", "--filter", "@stack/ai-worker", "start"]
