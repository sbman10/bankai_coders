export const COOKIE_CONSENT_NAME = "pv_cookie_consent";
export const THEME_PREFERENCE_KEY = "product-vault-theme";

export type CookiePreferences = { necessary: true; preferences: boolean; analytics: boolean };

export function readCookiePreferencesValue(cookieHeader?: string): string | null {
  const source = cookieHeader ?? (typeof document === "undefined" ? "" : document.cookie);
  const match = source.match(/(?:^|;\s*)pv_cookie_consent=(v1-p[01]-a[01])(?:;|$)/);
  return match?.[1] ?? null;
}

export function parseCookiePreferences(value: string | null): CookiePreferences | null {
  if (!value) return null;
  return { necessary: true, preferences: value.includes("p1"), analytics: value.includes("a1") };
}

export function readCookiePreferences(cookieHeader?: string): CookiePreferences | null {
  return parseCookiePreferences(readCookiePreferencesValue(cookieHeader));
}

export function subscribeCookiePreferences(callback: () => void) {
  window.addEventListener("product-vault-cookie-consent-change", callback);
  return () => window.removeEventListener("product-vault-cookie-consent-change", callback);
}

export function writeCookiePreferences(preferences: boolean, analytics: boolean): CookiePreferences {
  const value = `v1-p${preferences ? 1 : 0}-a${analytics ? 1 : 0}`;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_CONSENT_NAME}=${value}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  if (!preferences) window.localStorage.removeItem(THEME_PREFERENCE_KEY);
  window.dispatchEvent(new Event("product-vault-cookie-consent-change"));
  return { necessary: true, preferences, analytics };
}
