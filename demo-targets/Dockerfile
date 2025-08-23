FROM node:22-alpine

WORKDIR /app
COPY demo-targets/package.json demo-targets/target.js ./

USER node
CMD ["node", "target.js"]
