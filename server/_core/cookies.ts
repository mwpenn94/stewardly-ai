import type { CookieOptions, Request } from "express";

/**
 * Session cookie options.
 *
 * IMPORTANT: We intentionally do NOT set a `domain` on the cookie.
 * When domain is omitted, the browser scopes the cookie to the exact
 * origin that set it (host-only cookie). This is the safest approach
 * behind reverse proxies (Manus, Cloudflare, etc.) because:
 *
 *   1. `req.hostname` behind a proxy may resolve to the internal
 *      container hostname instead of the public domain, which would
 *      set the cookie on the wrong domain.
 *   2. Setting `.stewardly.manus.space` as the domain enables
 *      subdomain sharing, which we don't need and which can cause
 *      cookie leakage to sibling subdomains.
 *   3. Host-only cookies (no domain) are always sent back to the
 *      exact origin, regardless of proxy configuration.
 */
function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    // domain: intentionally omitted — see comment above
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
