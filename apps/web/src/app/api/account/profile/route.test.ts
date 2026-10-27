import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET, PATCH } from "./route";

const ownerId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const maybeSingle = vi.fn();
const single = vi.fn();
const select = vi.fn();
const eq = vi.fn();
const update = vi.fn();
const from = vi.fn();
const getUser = vi.fn();

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/account/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { display_name: "Kapish", avatar_path: null }, error: null });
  single.mockResolvedValue({ data: { display_name: "Kapish", avatar_path: null }, error: null });
  select.mockReturnValue({ eq, maybeSingle, single });
  eq.mockReturnValue({ select, maybeSingle, single });
  update.mockReturnValue({ eq });
  from.mockReturnValue({ select, update });
  getUser.mockResolvedValue({ data: { user: { id: ownerId, email: "person@example.com" } }, error: null });
  createClient.mockResolvedValue({ auth: { getUser }, from });
});

describe("account profile API", () => {
  it("returns only the signed-in user's editable profile fields", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ profile: { displayName: "Kapish", hasAvatar: false } });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("id", ownerId);
  });

  it("rejects signed-out profile reads", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("updates only the current user's display name and ignores no authority fields", async () => {
    const response = await PATCH(jsonRequest({ displayName: "  Kapish T.  " }));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ display_name: "Kapish T." });
    expect(eq).toHaveBeenCalledWith("id", ownerId);
    expect(await response.json()).toEqual({ profile: { displayName: "Kapish", hasAvatar: false } });
  });

  it("rejects attempts to set account ownership or protected auth fields", async () => {
    const response = await PATCH(jsonRequest({ displayName: "Someone", id: "other-user", email: "other@example.com", role: "admin" }));

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects profile changes from a signed-out request", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await PATCH(jsonRequest({ displayName: "Changed" }));

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});
