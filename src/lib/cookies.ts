import { env } from "./env";

export const SESSION_COOKIE = "ih_session";
export const OAUTH_STATE_COOKIE = "ih_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "ih_oauth_verifier";
export const OAUTH_NONCE_COOKIE = "ih_oauth_nonce";
export const OAUTH_RETURN_TO_COOKIE = "ih_return_to";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days sliding
export const OAUTH_FLOW_TTL_SECONDS = 60 * 10; // 10 minutes to complete the round trip

export const baseCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
