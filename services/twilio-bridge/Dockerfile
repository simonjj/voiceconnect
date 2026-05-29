FROM node:20-alpine

# ACA server endpoint's TLS chain isn't verifiable without an up-to-date CA
# bundle in node:20-alpine (UNABLE_TO_VERIFY_LEAF_SIGNATURE on some replicas).
RUN apk add --no-cache ca-certificates && update-ca-certificates

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY bridge.mjs ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "bridge.mjs"]
