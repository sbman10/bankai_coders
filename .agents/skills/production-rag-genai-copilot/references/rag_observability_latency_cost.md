# RAG Observability, Latency, and Cost

## Purpose

Use this file to instrument and optimize production RAG systems without sacrificing correctness blindly.

# 1. Trace the whole request

Capture when relevant:

- request/run ID;
- user/tenant context identifier;
- query;
- rewrite/router output;
- filters;
- retrieval method;
- retrieved document/chunk IDs;
- retrieval scores;
- reranker input/output;
- context IDs/order/token count;
- model/version;
- response/citations;
- latency by stage;
- tokens/usage/cost;
- errors/retries;
- final outcome.

Redact sensitive payloads.

# 2. Latency budget

Break end-to-end latency into:
- rewrite/router;
- retrieval;
- reranking;
- context processing;
- model generation;
- tools/external APIs;
- post-processing.

Optimize the dominant stage first.

# 3. Retrieval latency

Check:
- index/query type;
- filter complexity;
- candidate count;
- hybrid/multi-query fan-out;
- reranking depth;
- network region;
- concurrency.

A faster retriever that destroys recall is not an optimization.

# 4. Model latency

Check:
- model choice;
- input context size;
- output length;
- reasoning level where applicable;
- streaming;
- concurrency/rate limits.

Measure quality per successful task, not only tokens/request.

# 5. Context cost

Reduce context using evidence:
- dedupe;
- better ranking;
- per-source caps;
- parent/child expansion;
- concise metadata;
- dynamic top-k;
- compression only if it preserves evidence.

Do not truncate required evidence merely to lower token cost.

# 6. Reranking trade-off

Measure:
- ranking gain;
- answer-quality gain;
- added p95 latency;
- added cost.

Remove reranking only if first-stage ordering is already sufficient.

# 7. Caching

Possible cache layers:
- parsed documents;
- embeddings;
- retrieval results;
- model responses;
- summaries.

Define:
- cache key;
- tenant/auth scope;
- freshness;
- invalidation;
- privacy.

Never share cached private results across authorization boundaries.

# 8. Indexing cost

Track:
- parsing volume;
- embedding volume;
- re-embedding rate;
- index storage;
- update frequency;
- stale-document cleanup.

Avoid full reindex when a scoped update is sufficient and safe.

# 9. SLOs

Useful production signals:
- availability;
- answer success;
- retrieval recall proxy/eval score;
- citation/groundedness failures;
- p50/p95/p99 latency;
- error/retry rate;
- stale-index lag;
- cost per request/success.

Tie alerts to an action threshold.

# 10. No-action case

If quality, security, latency, and cost are inside targets, avoid speculative optimization.

Define the threshold that would justify change.
