FROM oven/bun:1.3.12-slim
WORKDIR /app
ENV NODE_ENV=production
COPY server.js ./server.js
ARG STACK_IMAGE_COMMIT=unknown
ENV STACK_IMAGE_COMMIT=$STACK_IMAGE_COMMIT
USER bun
CMD ["bun", "run", "server.js"]
