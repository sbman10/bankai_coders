import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { DELETE, GET, POST } from "./route";

const ownerId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const getUser = vi.fn();
const maybeSingle = vi.fn();
const single = vi.fn();
const select = vi.fn();
const eq = vi.fn();
const update = vi.fn();
const insert = vi.fn();
const upload = vi.fn();
const download = vi.fn();
const remove = vi.fn();
const storageFrom = vi.fn();
const from = vi.fn();

function supabaseMock() {
  return { auth: { getUser }, from, storage: { from: storageFrom } };
}

function avatarRequest(file?: File) {
  const body = new FormData();
  if (file) body.set("avatar", file);
  return { headers: new Headers(), body: null, formData: async () => body } as unknown as Request;
}

function imageFile(bytes: number[], name = "avatar.png", type = "image/png") {
  const file = new File([new Uint8Array(bytes)], name, { type });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array(bytes).buffer });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
  maybeSingle.mockResolvedValue({ data: { avatar_path: null, display_name: "Kapish" }, error: null });
  single.mockResolvedValue({ data: { avatar_path: `${ownerId}/avatar.png`, display_name: "Kapish" }, error: null });
  select.mockReturnValue({ eq, maybeSingle, single });
  eq.mockReturnValue({ select, maybeSingle, single });
  update.mockReturnValue({ eq });
  insert.mockReturnValue({ select });
  from.mockReturnValue({ select, update, insert });
  upload.mockResolvedValue({ error: null });
  download.mockResolvedValue({ data: new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }), error: null });
  remove.mockResolvedValue({ error: null });
  storageFrom.mockReturnValue({ upload, download, remove });
  createClient.mockResolvedValue(supabaseMock());
});

describe("private account avatar API", () => {
  it("rejects signed-out uploads before touching storage", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const response = await POST(avatarRequest(imageFile([137, 80, 78, 71, 13, 10, 26, 10])));
    expect(response.status).toBe(401);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("rejects image MIME spoofing before upload", async () => {
    const file = imageFile([...new TextEncoder().encode("not an image")]);
    const response = await POST(avatarRequest(file));
    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("stores a validated PNG under the authenticated user's private path", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const response = await POST(avatarRequest(imageFile([...bytes])));
    expect(response.status).toBe(200);
    expect(storageFrom).toHaveBeenCalledWith("profile-avatars");
    const [path, , options] = upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${ownerId}/[0-9a-f-]{36}\\.png$`));
    expect(options).toMatchObject({ contentType: "image/png", upsert: false });
    expect(update).toHaveBeenCalledWith({ avatar_path: path });
    expect(await response.json()).toEqual({ ok: true });
  });

  it("does not read an avatar path belonging to another user", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { avatar_path: "another-user/avatar.png" }, error: null });
    const response = await GET();
    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("streams an owner's private photo with non-cacheable image headers", async () => {
    const path = `${ownerId}/550e8400-e29b-41d4-a716-446655440000.png`;
    maybeSingle.mockResolvedValueOnce({ data: { avatar_path: path }, error: null });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(download).toHaveBeenCalledWith(path);
  });

  it("clears only the owner's avatar reference before removing their object", async () => {
    const path = `${ownerId}/550e8400-e29b-41d4-a716-446655440000.png`;
    maybeSingle.mockResolvedValueOnce({ data: { avatar_path: path }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { id: ownerId }, error: null });
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ avatar_path: null });
    expect(eq).toHaveBeenCalledWith("id", ownerId);
    expect(remove).toHaveBeenCalledWith([path]);
  });

  it("requires authentication before avatar reads and deletion", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET()).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    expect(download).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
