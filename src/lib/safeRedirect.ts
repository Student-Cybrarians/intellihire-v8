/**
 * Only ever allow redirecting to a same-origin, relative application path.
 * Rejects absolute URLs, protocol-relative URLs ("//evil.com"), and anything
 * that doesn't start with a single leading slash — the classic open-redirect
 * vectors — and falls back to a safe default.
 */
export function sanitizeReturnTo(candidate: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!candidate) return fallback;

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }

  // Reject values that decode to a scheme-bearing or protocol-relative URL.
  // The scheme check is anchored to "right after the single leading slash"
  // (not just "start of string") so an encoded scheme like
  // "/%68ttps://evil.com" -> "/https://evil.com" is still caught.
  try {
    const decoded = decodeURIComponent(candidate);
    if (/^\/{2,}/.test(decoded) || /^\/[a-z][a-z0-9+.-]*:/i.test(decoded)) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return candidate;
}
