import { z } from "zod";

/**
 * Central, fail-fast environment validation. Import `env` instead of touching
 * process.env directly anywhere else in the codebase.
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

  // Exactly one Google account may be the application administrator. Keep this
  // server-only; never expose it through NEXT_PUBLIC_* variables.
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email address"),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().min(1).optional(),
  NVIDIA_API_KEY: z.string().min(1).optional(),
  NVIDIA_API_BASE_URL: z.string().url().optional(),
  NVIDIA_MODEL: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (!value.OPENROUTER_API_KEY && !value.NVIDIA_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["NVIDIA_API_KEY"], message: "Configure NVIDIA_API_KEY or OPENROUTER_API_KEY" });
  }
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const isBuildOrTest =
      process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "test";

    const message = `Invalid or missing environment configuration:\n${parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}`;

    if (isBuildOrTest) {
      return process.env as unknown as Env;
    }

    throw new Error(message);
  }

  return parsed.data;
}

export const env = loadEnv();

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
