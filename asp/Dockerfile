FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV PORT=8182 DB_PATH=/data/asp.sqlite DEPLOYMENT_FILE=/config/deployment.json
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8182
USER node
CMD ["node", "src/main.ts"]
