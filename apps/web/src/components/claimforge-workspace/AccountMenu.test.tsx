import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

describe("account menu", () => {
  it("opens account settings and offers sign out from the profile dropdown", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onSignOut = vi.fn();
    render(<AccountMenu email="kapish@example.com" onOpenSettings={onOpenSettings} onSignOut={onSignOut} />);

    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /account settings/i }));
    expect(onOpenSettings).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<AccountMenu email="kapish@example.com" onOpenSettings={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /account menu/i });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
