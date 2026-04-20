FROM grafana/k6:latest

USER root
RUN apk add --no-cache bash
USER k6

WORKDIR /k6s
COPY . .
RUN ls

