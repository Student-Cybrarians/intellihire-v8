import { z } from "zod";

/**
 * Central, fail-fast environment validation. Import `env` instead of touching
 * `process.env` directly anywhere else in the codebase — this guarantees every
 * required secret is present and correctly shaped before the app serves traffic,
 * and gives every consumer a typed object instead of `string | undefined`.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_URL: z.string().url(),
  API_URL: z.string().url().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z.string().url(),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters of high-entropy data"),

  // NVIDIA AI provider credentials — never referenced from the client bundle.
  NVIDIA_API_KEY_NEMOTRON_VL_12B: z.string().optional(),
  NVIDIA_API_KEY_LLAMA_NEMOTRON_VL_8B: z.string().optional(),
  NVIDIA_API_KEY_NEMOTRON_9B: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // During `next build`'s static analysis pass, and in unit tests, real
  // secrets may not be present. We still want the module graph to load so
  // build-time page/type generation doesn't fail — but any attempt to
  // actually *use* an invalid env at runtime (a request coming in) throws.
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const isBuildOrTest =
      process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "test";

    const message = `Invalid or missing environment configuration:\n${parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}`;

    if (isBuildOrTest) {
      // Return a permissive placeholder object so the build can complete;
      // real requests in `next start`/production always re-validate.
      return process.env as unknown as Env;
    }

    throw new Error(message);
  }

  return parsed.data;
}

export const env = loadEnv();

/** Explicit runtime re-check, intended to be called once from app startup / instrumentation. */
export function assertEnvOrThrow(): void {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Startup aborted — invalid environment configuration:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }
}
