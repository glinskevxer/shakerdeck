# The desk in a container, for a client that wants it on their own machines
# without a node install. It carries the examples so the image can be checked
# in one command after it is pulled.
FROM node:20.18.2-bookworm-slim

WORKDIR /app

# The manifest and the lock file go first so the layer caches on a source
# change. Only the runtime dependency tree is installed.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY bin ./bin
COPY src ./src
COPY examples ./examples

# Nothing in here needs to write anything, so it runs as the node user the
# base image already carries.
USER node

ENTRYPOINT ["node", "/app/bin/shakerdeck.js"]
CMD ["commands"]
