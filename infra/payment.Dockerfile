# @stack/payment — Creem adapter + webhooks. Build from the REPO ROOT:
#   docker build -f infra/payment.Dockerfile -t stack-payment .
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
EXPOSE 3002
CMD ["bun", "--filter", "@stack/payment", "start"]
