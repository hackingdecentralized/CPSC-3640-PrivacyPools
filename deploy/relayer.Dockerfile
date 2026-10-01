# syntax=docker/dockerfile:1
# Course relayer: the upstream relayer (core/packages/relayer, flat-fee patch, see UPSTREAM.md) with the
# ceremony artifacts baked in and a config rendered at start-up from env + the mounted deployment file.
# Upstream's own core/packages/relayer/Dockerfile is left untouched.
#
# Build from the repo root (context core/packages; the entrypoint comes from the named context "deploy"):
#   docker build -f deploy/relayer.Dockerfile --build-context deploy=deploy -t course-relayer core/packages
# Run:
#   docker run -p 3132:3132 -e RPC_URL=... -e RELAYER_PRIVATE_KEY=... \
#     -v "$PWD/deployments/<net>.json:/config/deployment.json:ro" -v relayer-data:/data course-relayer
FROM node:23

WORKDIR /build
# Upstream installs an unpinned global TypeScript; pin it to the monorepo's version so builds stay reproducible.
RUN yarn global add typescript@5.5.4

# Install and build exactly as upstream does.
COPY relayer/package.json relayer/tsconfig.build.json ./
RUN yarn install && yarn cache clean
COPY relayer/src/ ./src/
RUN yarn build

# Circuit artifacts for the SDK's off-chain proof verification: the same files circuits/scripts/present.sh copies.
COPY circuits/trusted-setup/final-keys/commitment.zkey \
     circuits/trusted-setup/final-keys/commitment.vkey \
     circuits/trusted-setup/final-keys/withdraw.zkey \
     circuits/trusted-setup/final-keys/withdraw.vkey \
     circuits/build/commitment/commitment_js/commitment.wasm \
     circuits/build/withdraw/withdraw_js/withdraw.wasm \
     /build/node_modules/@0xbow/privacy-pools-core-sdk/dist/node/artifacts/

COPY --from=deploy relayer-entrypoint.mjs /build/relayer-entrypoint.mjs

ENV NODE_ENV=production PORT=3132 DEPLOYMENT_FILE=/config/deployment.json RELAYER_DB_PATH=/data/relayer.sqlite
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 3132
USER node
ENTRYPOINT ["node", "/build/relayer-entrypoint.mjs"]
