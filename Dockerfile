# Project Hub — container image.
#
# Unlike mission-control, this app never touches the host (no systemctl, no
# /proc, no nvidia-smi), so the runtime stage is a plain Node slim image
# instead of Ubuntu — there's nothing here that needs to match the host's
# systemd/D-Bus version.

FROM node:24.19.0-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24.19.0-slim
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/package.json ./
COPY --from=build --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=build --chown=1000:1000 /app/.next ./.next
COPY --from=build --chown=1000:1000 /app/public ./public

# /app/data holds db.json; compose mounts a volume there so project/task data
# survives image rebuilds and container recreation.
RUN mkdir -p /app/data && chown 1000:1000 /app/data

ENV NODE_ENV=production HOME=/tmp PH_DATA_DIR=/app/data
# uid 1000 = toezbit on the host — same convention as mission-control, kept
# for consistency even though this image doesn't need host file access.
USER 1000:1000

EXPOSE 3001

# PH_HOST/PH_PORT come from compose. Bind 0.0.0.0 inside the container —
# compose's port mapping is what restricts reachability to the tailnet IP.
CMD ["sh", "-c", "exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p \"${PH_PORT:-3001}\""]
