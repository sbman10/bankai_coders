import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fileFields = "id, product_id, storage_path, original_filename";
type Context = { params: Promise<{ id: string; documentId: string }> };

async function ownedDocument(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, productId: string, documentId: string) {
  return supabase.from("product_documents").select(fileFields)
    .eq("id", documentId).eq("product_id", productId).eq("user_id", userId).maybeSingle();
}

export async function GET(_request: Request, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to open product documents." }, { status: 401 });
    const { id: productId, documentId } = await context.params;
    if (!uuid.test(productId) || !uuid.test(documentId)) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });
    const { data: document, error } = await ownedDocument(supabase, user.id, productId, documentId);
    if (error) return NextResponse.json({ error: "The document could not be checked." }, { status: 503 });
    if (!document) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });

    const { data, error: linkError } = await supabase.storage.from("claim-documents")
      .createSignedUrl(document.storage_path, 60, { download: document.original_filename });
    if (linkError || !data?.signedUrl) return NextResponse.json({ error: "A private document link could not be created." }, { status: 503 });
    return NextResponse.json({ url: data.signedUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Private document access is not configured yet." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before removing a document." }, { status: 401 });
    const { id: productId, documentId } = await context.params;
    if (!uuid.test(productId) || !uuid.test(documentId)) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });
    const { data: document, error } = await ownedDocument(supabase, user.id, productId, documentId);
    if (error) return NextResponse.json({ error: "The document could not be checked." }, { status: 503 });
    if (!document) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });

    const { error: storageError } = await supabase.storage.from("claim-documents").remove([document.storage_path]);
    if (storageError) return NextResponse.json({ error: "The private file could not be removed. Your document record is still saved." }, { status: 503 });
    const { data: removed, error: deleteError } = await supabase.from("product_documents").delete()
      .eq("id", documentId).eq("product_id", productId).eq("user_id", user.id).select("id").maybeSingle();
    if (deleteError || !removed) return NextResponse.json({ error: "The file was removed, but its product record could not be cleaned up." }, { status: 503 });
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Product document storage is not configured yet." }, { status: 503 });
  }
}
