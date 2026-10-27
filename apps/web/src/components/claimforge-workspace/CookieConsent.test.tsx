import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CookieConsent } from "./CookieConsent";

beforeEach(() => { document.cookie = "pv_cookie_consent=; Max-Age=0; Path=/"; });
afterEach(() => { cleanup(); document.cookie = "pv_cookie_consent=; Max-Age=0; Path=/"; });

describe("CookieConsent", () => {
  it("keeps necessary cookies on and lets a visitor reject optional storage", async () => {
    window.localStorage.setItem("product-vault-theme", "dark");
    const user = userEvent.setup();
    render(<CookieConsent />);

    expect(await screen.findByRole("dialog", { name: /cookie preferences/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /necessary/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /necessary/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /reject optional/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.cookie).toContain("pv_cookie_consent=v1-p0-a0");
    expect(window.localStorage.getItem("product-vault-theme")).toBeNull();
  });

  it("saves customized functional and analytics choices and lets the visitor reopen settings", async () => {
    const user = userEvent.setup();
    render(<CookieConsent />);
    await user.click(await screen.findByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("checkbox", { name: /preferences/i }));
    await user.click(screen.getByRole("checkbox", { name: /analytics/i }));
    await user.click(screen.getByRole("button", { name: /save choices/i }));

    expect(document.cookie).toContain("pv_cookie_consent=v1-p1-a1");
    await user.click(screen.getByRole("button", { name: /cookie settings/i }));
    expect(screen.getByRole("dialog", { name: /cookie preferences/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /preferences/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /analytics/i })).toBeChecked();
  });
});
