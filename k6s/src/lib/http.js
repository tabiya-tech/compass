import { Counter } from "k6/metrics";

const status_codes = [
  200, 201, 202,

  400, 401, 403, 404, 409, 413, 422, 429,

  500, 503,
];

export const httpStatusCodes = status_codes.reduce((acc, code) => {
  acc[code] = new Counter(`http_status_code_${code}`);
  return acc;
}, {});
