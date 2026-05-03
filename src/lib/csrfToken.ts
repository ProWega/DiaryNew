/**
 * Reads the Double-Submit CSRF token from the `newdiary_csrf` cookie.
 * The cookie is JS-readable by design; an attacker on a different origin
 * cannot read it (Same-Origin Policy), so they cannot set the matching
 * `X-CSRF-Token` header. The server compares the two on every mutating
 * request and rejects mismatches with 403.
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)newdiary_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
