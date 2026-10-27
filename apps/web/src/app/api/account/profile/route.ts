import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const PROFILE_FIELDS = "display_name, avatar_path";
const MAX_DISPLAY_NAME_LENGTH = 80;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function profileDto(row: { display_name: string | null; avatar_path: string | null } | null, userId: string) {
  const avatarPath = row?.avatar_path;
  const hasAvatar = typeof avatarPath === "string" &&
    avatarPath.startsWith(`${userId}/`) &&
    !avatarPath.includes("..") &&
    avatarPath.split("/").length === 2;

  return { profile: { displayName: row?.display_name ?? null, hasAvatar } };
}

async function readOwnProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase.from("profiles").select(PROFILE_FIELDS).eq("id", userId).maybeSingle();
}

async function updateOwnProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  displayName: string,
) {
  const current = await readOwnProfile(supabase, userId);
  if (current.error) return { data: null, error: current.error };

  if (current.data) {
    return supabase.from("profiles").update({ display_name: displayName })
      .eq("id", userId).select(PROFILE_FIELDS).single();
  }

  const inserted = await supabase.from("profiles").insert({
    id: userId,
    display_name: displayName,
    avatar_path: null,
  }).select(PROFILE_FIELDS).single();
  if (!inserted.error || inserted.error.code !== "23505") return inserted;

  // Two first-time edits can race to create the same profile row. Retry as an
  // owner-scoped update after the winning insert commits.
  return supabase.from("profiles").update({ display_name: displayName })
    .eq("id", userId).select(PROFILE_FIELDS).single();
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Sign in to view your profile." }, 401);

    const { data, error } = await readOwnProfile(supabase, user.id);
    if (error) return json({ error: "Your profile could not be loaded." }, 503);
    return json(profileDto(data, user.id));
  } catch {
    return json({ error: "Your profile could not be loaded." }, 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Sign in before updating your profile." }, 401);

    let body: unknown;
    try {
      body = await readJsonBody(request, 2 * 1024);
    } catch (error) {
      const status = error instanceof JsonBodyError ? error.status : 400;
      return json({ error: status === 413 ? "Profile details are too large." : "Enter valid profile details." }, status);
    }

    if (!isRecord(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, "displayName") ||
      typeof body.displayName !== "string") {
      return json({ error: "Only your display name can be changed here." }, 400);
    }

    const displayName = body.displayName.trim();
    if (displayName.length < 1 || displayName.length > MAX_DISPLAY_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(displayName)) {
      return json({ error: `Display name must be between 1 and ${MAX_DISPLAY_NAME_LENGTH} characters.` }, 400);
    }

    const { data, error } = await updateOwnProfile(supabase, user.id, displayName);
    if (error || !data) return json({ error: "Your profile could not be saved." }, 503);
    return json(profileDto(data, user.id));
  } catch {
    return json({ error: "Your profile could not be saved." }, 503);
  }
}
