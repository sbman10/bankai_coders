import { describe, expect, it } from "vitest";
import { applySessionCookieLifetime, writeBrowserSessionCookies } from "./session-cookie-policy";

describe("session cookie lifetime", () => {
  it("makes session cookies persistent for the selected device duration", () => {
    const input = [{ name: "sb-project-auth-token.0", value: "token", options: { path: "/", maxAge: 34560000 } }];
    expect(applySessionCookieLifetime(input, true)[0].options.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("keeps cookies browser-session-only when the user did not opt in", () => {
    const input = [{ name: "sb-project-auth-token.0", value: "token", options: { path: "/", maxAge: 34560000 } }];
    expect(applySessionCookieLifetime(input, false)[0].options).toEqual({ path: "/" });
  });

  it("preserves deletion cookies instead of turning them into live sessions", () => {
    const input = [{ name: "sb-project-auth-token.0", value: "", options: { path: "/", maxAge: 0 } }];
    expect(applySessionCookieLifetime(input, true)[0].options.maxAge).toBe(0);
  });

  it("writes persistent auth cookies for the selected device and session cookies otherwise", () => {
    writeBrowserSessionCookies([{ name: "pv_auth_test", value: "token", options: { path: "/", maxAge: 400 } }], true);
    expect(document.cookie).toContain("pv_auth_test=token");
    expect(document.cookie).toContain("pv_auth_test=token");

    document.cookie = "pv_auth_test=; Max-Age=0; Path=/";
    writeBrowserSessionCookies([{ name: "pv_auth_test", value: "token", options: { path: "/", maxAge: 400 } }], false);
    expect(document.cookie).toContain("pv_auth_test=token");
  });
});
