# ProductVault RAG: Supabase, n8n, and RAGBuilder research

**Prepared:** 27 October 2026  
**Question:** What production-grade RAG architecture fits ProductVault, how should n8n participate, and is RAGBuilder useful?  
**Sources:** Official Supabase, n8n, and RAGBuilder documentation/repository only, plus the linked YouTube page where accessible.

## Recommendation

Use **Supabase Postgres/pgvector as the authoritative document and retrieval store**, and keep **Next.js as the authenticated user-facing answer API**. Use n8n for asynchronous ingestion orchestration and retries if desired, with narrowly scoped service credentials, explicit owner/document checks, and minimized execution data. Do not let a shared n8n vector-store credential answer arbitrary end-user queries without reproducing ProductVault's user/document authorization boundary.

Use **RAGBuilder for local/offline experimentation** on synthetic or carefully redacted documents to compare chunking, embeddings, and retriever choices against a representative evaluation set. Treat it as an experiment workbench, not the production retrieval runtime. Its documentation offers an API server and calls its generated systems production-ready, but the reviewed docs do not establish ProductVault-specific Supabase Auth/RLS enforcement, user/document scoping, citation integrity, Groq integration, or app safety and deletion guarantees. Those need independent implementation and security validation.

## What the official docs establish

### Supabase

- Supabase documents storing document chunks and embeddings in Postgres with pgvector and using RLS to limit semantic-search results to rows the signed-in user is allowed to access. The RAG permissions example links each chunk to its source document and applies an owner check in RLS. [RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)
- Supabase documents hybrid retrieval combining Postgres full-text search (tsvector) and pgvector semantic search, with result fusion such as Reciprocal Rank Fusion. This fits warranty/policy terms because exact clause language and paraphrased questions both matter. [Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)
- Supabase secret keys bypass RLS; use them only in controlled backend components that enforce authorization themselves. If n8n has a shared privileged credential, treat it as a trusted ingestion service and validate identifiers/ownership before writes. [API keys](https://supabase.com/docs/guides/getting-started/api-keys) · [Securing data](https://supabase.com/docs/guides/database/secure-data)

### n8n

- The official Supabase Vector Store node can insert/update documents, retrieve matching documents, and connect to a retriever or AI chain. It supports a configured query function and metadata filters. This is a useful orchestration/integration option, but its existence alone does not prove user-scoped permissions are correctly enforced for a multi-tenant application. [Supabase Vector Store node](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoresupabase/)
- n8n advises avoiding complete payloads, credentials, personal information, or sensitive content in execution metadata. It recommends storing large files externally and passing references, and allows successful production executions to be disabled after stabilization. For ProductVault, keep document bodies out of execution logs; store references and safe status/IDs, and verify all node outputs and error paths. [Execution-data minimization](https://support.n8n.io/article/optimizing-and-debugging-large-workflows-in-n8n-s4a4a93ogxsxtyta34z3br80)
- n8n execution redaction only affects what is shown through the execution viewer; it does not stop sensitive data from flowing to downstream nodes or change data stored in the database. Therefore minimize payloads before nodes and configure save policies; do not rely on redaction as a privacy boundary. [Execution data redaction](https://docs.n8n.io/workflows/executions/execution-data-redaction/)

### RAGBuilder

- RAGBuilder describes itself as a toolkit for tuning RAG settings such as chunking strategy/size, embedding model, and retriever against a generated or user-supplied test dataset; it provides predefined templates and an API deployment mode. [RAGBuilder repository](https://github.com/kruxai/ragbuilder) · [Quickstart](https://ragbuilder.pages.dev/quickstart/)
- Its current documented local setup expects an OpenAI API key by default, plus keys for selected integrations; the quickstart launches a local dashboard. ProductVault should not assume it will use Groq or its existing Supabase embedding schema without verifying provider compatibility and exported artifact behavior.
- The repository says the UI/SDK server binds to 127.0.0.1 by default. Remote binding requires a random API token and TLS through a trusted reverse proxy. It describes itself as a tool for trusted operators, not a public service. Usage telemetry is enabled by default and sends event type, version, component, and random installation ID to a collector; the repository states documents, prompts, model responses, file paths, API keys, and exception messages are not sent, and documents how to opt out with ENABLE_ANALYTICS=false. Review this before using any non-public documents. [RAGBuilder security and telemetry notes](https://github.com/kruxai/ragbuilder#security-and-local-use)
- The repository describes an API service endpoint, but the reviewed documentation does not demonstrate integration with ProductVault's existing RLS rules, user-specific document authorization, policy-safe citation rendering, or production multi-tenant controls. The inference from these docs is that RAGBuilder can help compare pipeline parameters and may generate a prototype/API artifact, but ProductVault must own its production auth, retrieval boundary, answer validation, citation provenance, audit/deletion behavior, and deployment.

### Video availability

The provided YouTube URL could not be fetched by the available browser research tool, and its official oEmbed metadata and timed-text endpoints also returned fetch failures. I did not watch the video or use a third-party synopsis. Findings in this note are based on the official platform sources above.

## Suggested ProductVault topology

    Signed-in user
      └─ Next.js API: authenticate session; authorize selected product/document IDs
           ├─ Supabase private Storage: source PDFs/images (direct upload/download)
           ├─ Supabase Postgres:
           │    ├─ document + extraction status/version metadata
           │    ├─ page/section-preserving chunks + source locations
           │    ├─ tsvector + pgvector hybrid retrieval (RLS enforced)
           │    └─ minimal chat/evaluation/audit metadata
           └─ Groq (server-side only): answer from bounded retrieved passages
                └─ server validates response schema and citation IDs
                     └─ UI shows evidence, uncertainty, or abstention

    Ingestion (separate asynchronous path):
    Upload event → authenticated app/n8n trigger → extract text/OCR with page provenance
    → structure-aware chunking → embeddings → idempotent Supabase writes
    → update ingestion state → app reflects indexed / needs-review / failed

Keep the original document private. Preserve page number, section heading, document/version ID, extraction provider/version, and quality flags on each chunk. A user question should select a specific product/document scope; search must filter that scope and remain protected by RLS. Return citations only by mapping model-returned IDs back to retrieved chunks in the server. If retrieval is weak, OCR is uncertain, clauses conflict, or a required definition/endorsement is missing, return a clear insufficient-evidence or clarification state. RAG does not guarantee correct eligibility decisions.

## Use RAGBuilder safely and productively

1. Create a local, isolated experiment with synthetic or redacted warranty/policy examples. Do not upload real personal insurance/receipt data until reviewing RAGBuilder's dependency/security posture, telemetry settings, and model/provider data terms.
2. Prepare a small labeled evaluation set with exact questions and expected supporting page/clause: exact exclusion terms, paraphrases, definitions, exceptions, deductible/waiting period, conflict between policy versions, absent endorsement, OCR-corrupted clause, unrelated question, and malicious instructions embedded in a document.
3. Compare a simple baseline (section-aware chunks + keyword search) with semantic search and hybrid retrieval. Record chosen embedding/model/chunk settings and each evaluation result. Tune based on retrieval recall/precision and citation coverage, not a broad “best RAG” score alone.
4. Export or record only useful configuration decisions. Reimplement them in ProductVault's own Supabase schema/RPC and Next.js route, preserving Auth/RLS. Do not directly expose the RAGBuilder API to browsers or make its local API service the production tenancy boundary.
5. Validate the production path with synthetic accounts/documents including cross-user access attempts, citation tampering, incomplete OCR, prompt injection, and deletion/re-index flows before deployment or real-document pilot.

## Architecture judgment

- **RAGBuilder:** useful as a local tuning and prototyping tool; optional, not a runtime dependency.
- **Supabase:** source of truth for user-owned document metadata, chunks, embeddings, access policies, and retrieval.
- **n8n:** optional ingestion orchestration for long-running extraction/embedding/retries after a secured trigger is configured. Avoid sending document content into execution history. Keep chat answer authorization in the app/database boundary.
- **Next.js:** authenticate the signed-in user, check selected-document ownership, call a narrowly scoped Supabase retrieval function under the user's identity/RLS, call Groq server-side, validate response/citations, and return a safe typed result.
- **Human control:** chatbot is read-only Q&A. Any claim drafting or external communication remains a separate workflow with explicit user approval.

## References

- [Supabase: RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)
- [Supabase: Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)
- [Supabase: API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [n8n: Supabase Vector Store](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoresupabase/)
- [n8n: Minimize execution data](https://support.n8n.io/article/optimizing-and-debugging-large-workflows-in-n8n-s4a4a93ogxsxtyta34z3br80)
- [n8n: Execution data redaction](https://docs.n8n.io/workflows/executions/execution-data-redaction/)
- [RAGBuilder GitHub repository](https://github.com/kruxai/ragbuilder)
- [RAGBuilder quickstart](https://ragbuilder.pages.dev/quickstart/)
- [User-provided YouTube video](https://www.youtube.com/watch?v=5aCi42dVOTA&t=58s) — not accessible in this research session; not reviewed.

