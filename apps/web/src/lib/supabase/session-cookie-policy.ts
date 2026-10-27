export const REMEMBER_DEVICE_COOKIE = "pv_remember_device";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type CookieToSet = {
  name: string;
  value: string;
  options: { maxAge?: number; domain?: string; path?: string; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: string | boolean };
};

/** Supabase SSR defaults auth cookies to a long persistent lifetime. Override that per request. */
export function applySessionCookieLifetime<T extends CookieToSet>(cookies: T[], rememberDevice: boolean): T[] {
  return cookies.map((cookie) => {
    const options = { ...cookie.options };
    if (options.maxAge !== 0) {
      if (rememberDevice) options.maxAge = SESSION_COOKIE_MAX_AGE_SECONDS;
      else delete options.maxAge;
    }
    return { ...cookie, options };
  });
}

export function readBrowserCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    const name = separator < 0 ? part : part.slice(0, separator);
    const rawValue = separator < 0 ? "" : part.slice(separator + 1);
    try { return { name, value: decodeURIComponent(rawValue) }; }
    catch { return { name, value: rawValue }; }
  });
}

export function writeBrowserSessionCookies<T extends CookieToSet>(cookies: T[], rememberDevice: boolean): void {
  if (typeof document === "undefined") return;
  for (const { name, value, options } of applySessionCookieLifetime(cookies, rememberDevice)) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
    if (typeof options.domain === "string") parts.push(`Domain=${options.domain}`);
    if (typeof options.path === "string") parts.push(`Path=${options.path}`);
    if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
    if (options.httpOnly === true) parts.push("HttpOnly");
    if (options.secure === true) parts.push("Secure");
    if (options.sameSite) parts.push(`SameSite=${String(options.sameSite).replace(/^./, (letter) => letter.toUpperCase())}`);
    document.cookie = parts.join("; ");
  }
}

export function rememberDeviceSelected(cookies: { name: string; value: string }[] = readBrowserCookies()): boolean {
  return cookies.some(({ name, value }) => name === REMEMBER_DEVICE_COOKIE && value === "1");
}
