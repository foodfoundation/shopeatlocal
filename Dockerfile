FROM node:18 AS builder
WORKDIR workspace

COPY package*.json .
COPY app app
COPY producers-report producers-report
COPY turbo.json .

RUN npm ci
RUN cp app/Extra/Cfg.js_example app/Cfg.js
RUN npm run build:release:static --prefix producers-report
RUN npm run build

FROM node:18
WORKDIR workspace

COPY --from=builder workspace/package*.json .
COPY --from=builder workspace/app app
COPY --from=builder workspace/node_modules node_modules
CMD npm start --prefix app
