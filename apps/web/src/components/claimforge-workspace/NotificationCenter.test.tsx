import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationCenter } from "./NotificationCenter";

afterEach(() => {
  cleanup();
});

describe("NotificationCenter", () => {
  it("renders the notification popover with title, badges, and active items", () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const onUnreadCountChange = vi.fn();
    const triggerRef = { current: document.createElement("button") };

    render(
      <NotificationCenter
        onClose={onClose}
        onNavigate={onNavigate}
        triggerRef={triggerRef}
        unreadCount={3}
        onUnreadCountChange={onUnreadCountChange}
      />
    );

    expect(screen.getByRole("heading", { name: /^notifications$/i })).toBeInTheDocument();
    expect(screen.getByText(/3 new/i)).toBeInTheDocument();
    expect(screen.getByText("LG Refrigerator AMC Due")).toBeInTheDocument();
    expect(screen.getByText("Sony WH-1000XM5 Price Drop")).toBeInTheDocument();
    expect(screen.getByText("Minimalist Sunscreen Restock")).toBeInTheDocument();
  });

  it("marks all notifications as read when clicking 'Mark all read'", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const onUnreadCountChange = vi.fn();
    const triggerRef = { current: document.createElement("button") };

    render(
      <NotificationCenter
        onClose={onClose}
        onNavigate={onNavigate}
        triggerRef={triggerRef}
        unreadCount={3}
        onUnreadCountChange={onUnreadCountChange}
      />
    );

    const markAllBtn = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllBtn);

    expect(onUnreadCountChange).toHaveBeenCalledWith(0);
    expect(screen.queryByRole("button", { name: /mark all read/i })).not.toBeInTheDocument();
  });

  it("navigates to the target view and closes the popover when a notification is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const onUnreadCountChange = vi.fn();
    const triggerRef = { current: document.createElement("button") };

    render(
      <NotificationCenter
        onClose={onClose}
        onNavigate={onNavigate}
        triggerRef={triggerRef}
        unreadCount={3}
        onUnreadCountChange={onUnreadCountChange}
      />
    );

    const priceDropItem = screen.getByText("Sony WH-1000XM5 Price Drop").closest("button");
    expect(priceDropItem).toBeInTheDocument();
    await user.click(priceDropItem!);

    expect(onNavigate).toHaveBeenCalledWith("prices");
    expect(onClose).toHaveBeenCalled();
  });

  it("dismisses an individual notification and shows empty state when all are removed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const onUnreadCountChange = vi.fn();
    const triggerRef = { current: document.createElement("button") };

    render(
      <NotificationCenter
        onClose={onClose}
        onNavigate={onNavigate}
        triggerRef={triggerRef}
        unreadCount={3}
        onUnreadCountChange={onUnreadCountChange}
      />
    );

    const dismissBtns = screen.getAllByRole("button", { name: /dismiss notification/i });
    expect(dismissBtns).toHaveLength(3);

    for (const btn of dismissBtns) {
      await user.click(btn);
    }

    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.getByText(/no active alerts/i)).toBeInTheDocument();
  });

  it("closes on Escape key press", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const onUnreadCountChange = vi.fn();
    const triggerRef = { current: document.createElement("button") };

    render(
      <NotificationCenter
        onClose={onClose}
        onNavigate={onNavigate}
        triggerRef={triggerRef}
        unreadCount={3}
        onUnreadCountChange={onUnreadCountChange}
      />
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
