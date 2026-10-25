import { createEmbedTextHandler } from "../_shared/embed-text-handler.ts";
import { createSupabaseGteSmallEmbeddingService } from "../_shared/embeddings.ts";

const embeddings = createSupabaseGteSmallEmbeddingService();
Deno.serve(createEmbedTextHandler(embeddings));
