import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "./AccountSettings";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ profile: { displayName: "Kapish", hasAvatar: false } }) });
});

describe("account settings", () => {
  it("shows the signed-in email and saves the editable display name", async () => {
    const user = userEvent.setup();
    render(<AccountSettings email="kapish@example.com" onBack={vi.fn()} />);

    expect(await screen.findByDisplayValue("Kapish")).toBeInTheDocument();
    expect(screen.getByDisplayValue("kapish@example.com")).toBeDisabled();
    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), "Kapish T");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ profile: { displayName: "Kapish T", hasAvatar: false } }) });
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(fetchMock).toHaveBeenLastCalledWith("/api/account/profile", expect.objectContaining({ method: "PATCH" }));
    expect(await screen.findByText(/profile saved/i)).toBeInTheDocument();
  });

  it("uploads and removes a profile photo through private same-origin routes", async () => {
    const user = userEvent.setup();
    render(<AccountSettings email="kapish@example.com" onBack={vi.fn()} />);
    const input = await screen.findByLabelText(/upload profile photo/i);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await user.upload(input, new File(["image"], "avatar.png", { type: "image/png" }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/account/avatar", expect.objectContaining({ method: "POST" }));

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await user.click(await screen.findByRole("button", { name: /remove photo/i }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/account/avatar", expect.objectContaining({ method: "DELETE" }));
  });

  it("explains that password login is not enabled for this passwordless account", async () => {
    render(<AccountSettings email="kapish@example.com" onBack={vi.fn()} />);
    expect(await screen.findByText(/google or email sign-in link/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change password/i })).not.toBeInTheDocument();
  });
});
