import http from "k6/http";
import { sleep, check } from "k6";
import { Trend } from "k6/metrics";
import { scenarios } from "../config.js";
import { logEnvs, requireEnvs, env } from "../lib/env-vars.js";
import { httpStatusCodes } from "../lib/http.js";

const statusCounters = httpStatusCodes;

const duration = new Trend("req_duration_ms", true);

export const options = {
  scenarios: {
    default: scenarios("get-version"),
  },
  summaryTrendStats: ["min", "avg", "max"],
  thresholds: {
    req_duration_ms: ["avg<2000"],
  },
};

export function setup() {
  logEnvs();
  requireEnvs(["BASE_URL"]);
}

export default function () {
  const res = http.get(`${env("BASE_URL")}/version`, { timeout: "10s" });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < .5s": (r) => r.timings.duration < 500,
  });
  duration.add(res.timings.duration);
  const status = res.status;
  statusCounters[status].add(1);
  sleep(1);
}
