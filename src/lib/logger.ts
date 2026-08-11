import pino from "pino";

/**
 * Field names that must never appear in logs. Applied both via pino's
 * built-in `redact` (fast path for known key paths) and a deep-scan
 * fallback (`redactSecrets`) for ad-hoc objects assembled at call sites,
 * so a forgotten path in `redact` can't leak a secret.
 */
const SENSITIVE_KEYS = new Set([
  "authorization",
  "code",
  "access_token",
  "accesstoken",
  "id_token",
  "idtoken",
  "refresh_token",
  "refreshtoken",
  "client_secret",
  "clientsecret",
  "session_token",
  "sessiontoken",
  "token_hash",
  "cookie",
  "set-cookie",
  "password",
  "nvidia_api_key_nemotron_vl_12b",
  "nvidia_api_key_llama_nemotron_vl_8b",
  "nvidia_api_key_nemotron_9b",
]);

export function redactSecrets<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      out[key] = redactSecrets(val, depth + 1);
    } else {
      out[key] = val;
    }
  }
  return out as T;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.code",
      "*.access_token",
      "*.id_token",
      "*.refresh_token",
      "*.client_secret",
      "*.session_token",
      "*.token_hash",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

/** Attach a correlation/request ID to every log line for a given request lifecycle. */
export function loggerWithCorrelation(correlationId: string) {
  return logger.child({ correlationId });
}
