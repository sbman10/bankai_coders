import { NextResponse } from "next/server";
import { chunkExtractedPages, extractPdfPages, isPdf } from "@/lib/rag/pdf-indexer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string; documentId: string }> };

async function setIngestionState(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  productId: string,
  documentId: string,
  state: Record<string, unknown>,
) {
  return supabase.from("product_documents").update(state)
    .eq("id", documentId).eq("product_id", productId).eq("user_id", userId)
    .select("id").maybeSingle();
}

async function needsReview(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  productId: string,
  documentId: string,
  reason: string,
) {
  const { error } = await setIngestionState(supabase, userId, productId, documentId, {
    ingestion_status: "needs_review",
    ingestion_warning_code: reason,
  });
  if (error) return NextResponse.json({ error: "The document status could not be saved." }, { status: 503 });
  return NextResponse.json({ status: "needs_review", reason }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to prepare this document." }, { status: 401 });

    const { id: productId, documentId } = await context.params;
    if (!uuid.test(productId) || !uuid.test(documentId)) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });

    const { data: document, error: documentError } = await supabase.from("product_documents")
      .select("id, product_id, user_id, storage_path, mime_type, size_bytes, index_version")
      .eq("id", documentId).eq("product_id", productId).eq("user_id", user.id).maybeSingle();
    if (documentError) return NextResponse.json({ error: "The document could not be checked." }, { status: 503 });
    if (!document) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });

    const admin = createAdminClient();
    if (document.mime_type !== "application/pdf") return needsReview(admin, user.id, productId, documentId, "ocr_required");
    if (!Number.isInteger(document.size_bytes) || document.size_bytes < 1 || document.size_bytes > 10 * 1024 * 1024) {
      return needsReview(admin, user.id, productId, documentId, "unsupported_file_size");
    }

    const { error: processingError } = await setIngestionState(admin, user.id, productId, documentId, {
      ingestion_status: "extracting",
      ingestion_warning_code: null,
    });
    if (processingError) return NextResponse.json({ error: "The document status could not be saved." }, { status: 503 });

    const { data: file, error: downloadError } = await supabase.storage.from("claim-documents").download(document.storage_path);
    if (downloadError || !file || file.size !== document.size_bytes) {
      await setIngestionState(admin, user.id, productId, documentId, {
        ingestion_status: "failed",
        ingestion_warning_code: "source_unavailable",
      });
      return NextResponse.json({ error: "The private document could not be read." }, { status: 503 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(bytes)) return needsReview(admin, user.id, productId, documentId, "invalid_pdf_content");

    let pages;
    try {
      pages = await extractPdfPages(bytes);
    } catch {
      return needsReview(admin, user.id, productId, documentId, "pdf_unreadable");
    }

    if (pages.length === 0 || pages.some((page) => page.text.trim().length === 0)) {
      return needsReview(admin, user.id, productId, documentId, "text_incomplete_or_ocr_required");
    }

    const chunks = chunkExtractedPages(pages);
    if (chunks.length === 0) return needsReview(admin, user.id, productId, documentId, "text_not_found");
    const nextVersion = (document.index_version ?? 0) + 1;
    const { error: cleanupError } = await admin.from("document_chunks").delete()
      .eq("user_id", user.id).eq("document_id", documentId).eq("index_version", nextVersion);
    if (cleanupError) {
      await setIngestionState(admin, user.id, productId, documentId, {
        ingestion_status: "failed",
        ingestion_warning_code: "stale_index_cleanup_failed",
      });
      return NextResponse.json({ error: "A previous indexing attempt could not be cleared safely." }, { status: 503 });
    }

    const { error: insertError } = await admin.from("document_chunks").insert(chunks.map((chunk) => ({
      user_id: user.id,
      document_id: documentId,
      page_number: chunk.page_number,
      section_path: chunk.section_path,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      content_hash: chunk.content_hash,
      extraction_confidence: chunk.extraction_confidence,
      index_version: nextVersion,
    })));
    if (insertError) {
      await setIngestionState(admin, user.id, productId, documentId, {
        ingestion_status: "failed",
        ingestion_warning_code: "index_write_failed",
      });
      return NextResponse.json({ error: "The document could not be prepared for search." }, { status: 503 });
    }

    const { error: indexedError } = await setIngestionState(admin, user.id, productId, documentId, {
      ingestion_status: "indexed",
      ingestion_warning_code: null,
      indexed_at: new Date().toISOString(),
      index_version: nextVersion,
    });
    if (indexedError) {
      await setIngestionState(admin, user.id, productId, documentId, {
        ingestion_status: "failed",
        ingestion_warning_code: "index_publish_failed",
      });
      return NextResponse.json({ error: "The document could not be marked ready for search." }, { status: 503 });
    }

    return NextResponse.json({ status: "indexed", pagesIndexed: pages.length, chunksCreated: chunks.length }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Document processing is temporarily unavailable." }, { status: 503 });
  }
}
