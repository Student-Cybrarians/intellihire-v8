"use client";

import { useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You closed the Google sign-in window before finishing. No account changes were made.",
  state_mismatch: "Your sign-in session expired or was tampered with. Please try again.",
  invalid_request: "The sign-in link was incomplete. Please start again from this page.",
  invalid_id_token: "Google couldn't be verified for this sign-in attempt. Please try again.",
  nonce_mismatch: "Your sign-in session expired. Please try again.",
  email_not_verified: "This Google account's email isn't verified. Verify it with Google, then try again.",
  account_suspended: "This account has been suspended. Contact support if you believe this is a mistake.",
  database_schema_missing: "IntelliHire's account database is still being prepared. Please try again shortly.",
  database_error: "IntelliHire could not finish creating your account. Please try Google sign-in again.",
  session_error: "IntelliHire verified your Google account but could not create your session. Please try again.",
  server_error: "Something went wrong on our end. Please try again in a moment.",
};

function friendlyError(code: string | null): string | null {
  if (!code) return null;
  return ERROR_MESSAGES[code] ?? "Sign-in didn't complete. Please try again.";
}

function buildGoogleUrl(returnTo: string | null): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return query ? `/api/auth/google?${query}` : "/api/auth/google";
}

export function GoogleSignInCard({
  initialErrorCode,
  returnTo,
}: {
  initialErrorCode: string | null;
  returnTo: string | null;
}) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const errorMessage = friendlyError(initialErrorCode);
  const googleUrl = buildGoogleUrl(returnTo);

  return (
    <div className="ih-card" role="region" aria-labelledby="ih-signin-heading">
      <p className="ih-card__eyebrow">Sign in</p>
      <h2 id="ih-signin-heading" className="ih-card__title">
        Welcome to IntelliHire
      </h2>
      <p className="ih-card__subtitle">
        One account, one step. We use Google to verify who you are — no separate password to
        create or remember.
      </p>

      {errorMessage ? (
        <div className="ih-alert" role="alert">
          <span className="ih-alert__dot" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <a
        href={googleUrl}
        className="ih-google-btn"
        aria-label="Continue with Google to sign in or create your IntelliHire account"
        onClick={() => setIsRedirecting(true)}
      >
        {isRedirecting ? (
          <>
            <span className="ih-spinner" aria-hidden="true" />
            <span>Redirecting to Google…</span>
          </>
        ) : (
          <>
            <GoogleGlyph />
            <span>Continue with Google</span>
          </>
        )}
      </a>

      {errorMessage ? (
        <a href={googleUrl} className="ih-retry-link" onClick={() => setIsRedirecting(true)}>
          Try again
        </a>
      ) : null}

      <p className="ih-card__legal">
        By continuing, you agree to IntelliHire&apos;s{" "}
        <a href="/terms" className="ih-card__legal-link">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="ih-card__legal-link">
          Privacy Policy
        </a>
        .
      </p>

      <div className="ih-security-note">
        <LockGlyph />
        <span>Secured with Google OAuth 2.0 — IntelliHire never sees or stores your password.</span>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.34-.17-1.98H10v3.75h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.29Z" />
      <path fill="#34A853" d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.23-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.06v2.59A10 10 0 0 0 10 20Z" />
      <path fill="#FBBC05" d="M4.41 11.92a5.99 5.99 0 0 1 0-3.84V5.49H1.06a10 10 0 0 0 0 9.02l3.35-2.59Z" />
      <path fill="#EA4335" d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 10 0 10 10 0 0 0 1.06 5.49l3.35 2.6c.79-2.37 2.99-4.13 5.59-4.13Z" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm0 1.5A2 2 0 0 1 10 4.5V6H6V4.5A2 2 0 0 1 8 2.5Z" />
    </svg>
  );
}
