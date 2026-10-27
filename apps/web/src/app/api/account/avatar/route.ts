import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_AVATAR_BYTES + 64 * 1024;
const TYPES = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10" },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) =>
    bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

type ImageMime = keyof typeof TYPES;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function validOwnedPath(path: unknown, userId: string): path is string {
  if (typeof path !== "string") return false;
  const escapedId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path);
}

async function ownUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

async function readAvatarPath(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
}

async function readBoundedFormData(request: Request): Promise<FormData> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) throw new RangeError("Avatar request is too large.");
  if (!request.body) return request.formData();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_MULTIPART_BYTES) {
      await reader.cancel();
      throw new RangeError("Avatar request is too large.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(body, { headers: request.headers }).formData();
}

async function saveAvatarPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  avatarPath: string | null,
) {
  const current = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (current.error) return current;

  if (current.data) {
    return supabase.from("profiles").update({ avatar_path: avatarPath }).eq("id", userId).select("id").single();
  }

  const inserted = await supabase.from("profiles").insert({ id: userId, display_name: null, avatar_path: avatarPath })
    .select("id").single();
  if (!inserted.error || inserted.error.code !== "23505") return inserted;
  return supabase.from("profiles").update({ avatar_path: avatarPath }).eq("id", userId).select("id").single();
}

export async function GET() {
  try {
    const { supabase, user } = await ownUser();
    if (!user) return json({ error: "Sign in to view your profile photo." }, 401);
    const { data, error } = await readAvatarPath(supabase, user.id);
    if (error) return json({ error: "Your profile photo could not be loaded." }, 503);
    if (!validOwnedPath(data?.avatar_path, user.id)) return json({ error: "No profile photo was found." }, 404);

    const { data: file, error: storageError } = await supabase.storage.from(BUCKET).download(data.avatar_path);
    if (storageError || !file) return json({ error: "Your profile photo could not be loaded." }, 404);
    const extension = data.avatar_path.split(".").at(-1);
    const contentType = extension === "jpg" ? "image/jpeg" : extension === "png" ? "image/png" : "image/webp";
    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Your profile photo could not be loaded." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await ownUser();
    if (!user) return json({ error: "Sign in before uploading a profile photo." }, 401);

    let form: FormData;
    try {
      form = await readBoundedFormData(request);
    } catch (error) {
      const tooLarge = error instanceof RangeError || Number(request.headers.get("content-length")) > MAX_MULTIPART_BYTES;
      return json({ error: tooLarge ? "Choose an image smaller than 2 MB." : "Choose a valid image file." }, tooLarge ? 413 : 400);
    }
    const file = form.get("avatar");
    if (!(file instanceof File) || [...form.keys()].some((key) => key !== "avatar")) {
      return json({ error: "Choose one image file to upload." }, 400);
    }
    if (file.size === 0 || file.size > MAX_AVATAR_BYTES) {
      return json({ error: "Choose an image smaller than 2 MB." }, 400);
    }
    if (!Object.hasOwn(TYPES, file.type)) return json({ error: "Use a JPEG, PNG, or WebP image." }, 400);

    const mime = file.type as ImageMime;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!TYPES[mime].signature(bytes)) return json({ error: "The selected file does not match its image type." }, 400);

    const previous = await readAvatarPath(supabase, user.id);
    if (previous.error) return json({ error: "Your profile photo could not be saved." }, 503);
    const oldPath = validOwnedPath(previous.data?.avatar_path, user.id) ? previous.data.avatar_path : null;
    const newPath = `${user.id}/${crypto.randomUUID()}.${TYPES[mime].extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(newPath, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (uploadError) return json({ error: "Your profile photo could not be uploaded." }, 503);

    const { error: profileError } = await saveAvatarPath(supabase, user.id, newPath);
    if (profileError) {
      try { await supabase.storage.from(BUCKET).remove([newPath]); } catch { /* Keep the profile write error authoritative. */ }
      return json({ error: "Your profile photo could not be saved." }, 503);
    }
    if (oldPath && oldPath !== newPath) {
      try { await supabase.storage.from(BUCKET).remove([oldPath]); } catch { /* The new private avatar is already active. */ }
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Your profile photo could not be saved." }, 503);
  }
}

export async function DELETE() {
  try {
    const { supabase, user } = await ownUser();
    if (!user) return json({ error: "Sign in before removing your profile photo." }, 401);
    const { data, error } = await readAvatarPath(supabase, user.id);
    if (error) return json({ error: "Your profile photo could not be removed." }, 503);
    const oldPath = validOwnedPath(data?.avatar_path, user.id) ? data.avatar_path : null;
    if (!oldPath) return json({ ok: true });

    const { error: profileError } = await saveAvatarPath(supabase, user.id, null);
    if (profileError) return json({ error: "Your profile photo could not be removed." }, 503);
    try { await supabase.storage.from(BUCKET).remove([oldPath]); } catch { /* The profile no longer references this object. */ }
    return json({ ok: true });
  } catch {
    return json({ error: "Your profile photo could not be removed." }, 503);
  }
}
