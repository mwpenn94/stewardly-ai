export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// The state parameter encodes: origin + returnPath so the OAuth callback
// can redirect the user back to the page they were on before signing in.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const origin = window.location.origin;
  const redirectUri = `${origin}/api/oauth/callback`;
  // Encode origin + the path the user should return to after auth
  const path = returnPath || window.location.pathname + window.location.search;
  const statePayload = JSON.stringify({ origin, returnPath: path });
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
