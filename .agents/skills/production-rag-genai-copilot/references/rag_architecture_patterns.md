# RAG Architecture Patterns

## Purpose

Use this file to design or review RAG systems. Choose the simplest architecture that satisfies freshness, quality, security, latency, and cost requirements.

# 1. Baseline RAG

Flow:

`source → parse → chunk → enrich/metadata → embed/index → retrieve → context → model → answer/citations`

Use when:
- the relevant knowledge can be indexed;
- retrieval is mostly one-shot;
- user questions map well to searchable content.

Avoid adding orchestration complexity until the baseline is measured.

# 2. Retrieval choices

## Lexical
Useful for:
- exact names;
- IDs;
- rare terms;
- error codes;
- phrases.

## Vector
Useful for:
- semantic similarity;
- paraphrases;
- concept matching.

## Hybrid
Use when both lexical precision and semantic recall matter.

Do not assume vector-only is always superior.

# 3. Query rewrite

Use when raw user queries are poor search queries.

Examples:
- pronoun resolution;
- acronym expansion;
- multi-turn context resolution;
- query decomposition.

Guardrail:
rewrite should preserve intent. Evaluate original vs rewritten retrieval.

# 4. Metadata filtering

Use metadata for:
- tenant/user authorization;
- product/region;
- language;
- document type;
- effective date/version;
- source quality.

Authorization filters are not optional ranking hints.

# 5. Chunking

Chunking should preserve retrievable meaning.

Evaluate:
- semantic boundaries;
- section titles;
- overlap;
- tables/lists;
- code;
- chunk size;
- parent-child structure;
- document type.

Do not select one chunk size for every corpus by habit.

# 6. Parent-child retrieval

Pattern:

`retrieve small child chunk → expand to larger parent context`

Useful when:
- small chunks improve search;
- larger context is needed for answer completeness.

Measure duplication and context cost.

# 7. Reranking

Use when first-stage retrieval has reasonable recall but ordering is weak.

Flow:

`retrieve broad candidate set → rerank → context`

Reranking cannot recover documents never retrieved.

Measure quality gain vs latency/cost.

# 8. Multi-query / decomposition

Use when a question contains distinct subproblems.

Pattern:

`query → subqueries → retrieve each → merge/dedupe → rerank/context`

Define merge rules and avoid duplicated context.

# 9. Agentic RAG

Use only when the system must dynamically choose among multiple searches/sources/tools or iteratively gather evidence.

Do not use an agent merely because the application has multiple retrievers.

Bound:
- tool set;
- iterations;
- cost;
- stopping conditions;
- authorization.

# 10. Freshness

Define:
- source-of-truth;
- ingest delay;
- index delay;
- delete/update propagation;
- stale-content tolerance;
- reindex/backfill path.

“RAG is stale” can be an ingestion/indexing problem rather than retrieval.

# 11. Source precedence

When sources conflict, define precedence.

Examples:
- current policy beats archived policy;
- official docs beat community content;
- newer effective date beats older date.

Store enough metadata to implement the rule.

# 12. Context construction

Context should be:
- relevant;
- non-duplicative;
- correctly ordered;
- provenance-preserving;
- within model limits.

Do not pack top-k blindly.

Consider:
- per-source caps;
- diversity;
- parent expansion;
- dedupe;
- recency;
- authority;
- token budget.

# 13. Abstention

Define when the system should not answer.

Examples:
- no sufficiently relevant evidence;
- unauthorized evidence only;
- sources conflict beyond resolution;
- required source is stale/missing.

A useful system can say “I don’t have enough supported evidence.”

# 14. Architecture decision

For material choices state:

**Recommendation**  
**Why**  
**Quality impact**  
**Latency/cost impact**  
**Security impact**  
**Operational burden**  
**What would invalidate this choice**
