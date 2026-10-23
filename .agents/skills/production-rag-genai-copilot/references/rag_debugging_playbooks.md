# RAG Debugging Playbooks

## Purpose

Use this file for production incidents and quality regressions. Find the first failing boundary rather than tuning everything at once.

# Diagnostic path

`query → rewrite/router → retrieval → reranker → context → generation → citations`

At each boundary ask:
- expected input;
- actual input;
- expected output;
- actual output.

# 1. Relevant document not retrieved

## Most likely
Index/query/filter strategy is excluding or under-ranking the required evidence.

## Check first
1. Confirm the answer actually exists in the current corpus.
2. Search using exact terms from the source.
3. Inspect metadata/authorization filters.
4. Compare lexical, vector, and hybrid retrieval.
5. Inspect query rewrite.
6. Check embedding/index freshness.

## Confirms
The document is searchable under one path but absent under the production query/filter path.

## Fix
Correct the first failing retrieval boundary before changing the generator.

# 2. Right document retrieved, wrong chunk

## Check
- parsing;
- heading preservation;
- chunk boundary;
- overlap;
- table/list handling;
- parent context.

## Fix
Change chunking only after reproducing the miss across a representative eval slice.

# 3. Retrieval quality suddenly regressed

Compare:
- last known-good index/config;
- corpus count;
- index freshness;
- embedding model/version;
- metadata schema;
- filters;
- query rewrite;
- ranker/reranker;
- top-k/threshold.

Containment:
restore a known-good config/index only when compatibility is understood.

# 4. Answer hallucinates despite good retrieval

First confirm the needed evidence appears in final context.

Then inspect:
- context ordering;
- conflicting chunks;
- prompt instructions;
- truncation;
- model behavior;
- unsupported synthesis.

Possible fixes:
- stronger evidence-use instruction;
- explicit abstention;
- conflict handling;
- context cleanup;
- model change only when measured.

# 5. Citation mismatch

## Check
- claim-to-source alignment;
- chunk IDs/provenance mapping;
- post-processing;
- source ordering;
- citation insertion logic.

A citation to a related source is not sufficient if the exact claim is unsupported.

# 6. Stale answers

Trace:
`source update → ingestion → parse → index write → retrieval`

Measure delay at each stage.

Check deletes and replacements, not just inserts.

Do not solve stale indexing with a generation prompt.

# 7. Too many irrelevant chunks

Check:
- query rewrite;
- lexical/vector balance;
- metadata filters;
- top-k;
- score distribution;
- duplicate chunks;
- corpus noise.

Do not simply lower top-k until recall impact is measured.

# 8. Reranker hurts quality

Compare:
- pre-rerank candidate recall;
- post-rerank ordering;
- hard query slices;
- latency.

If relevant documents enter the candidate set but are demoted, isolate reranker behavior.

# 9. Multilingual degradation

Check separately:
- source language;
- query language;
- embedding behavior;
- analyzer/tokenizer;
- rewrite language;
- reranker;
- generation language.

Do not treat it as one generic “model problem.”

# 10. Production incident output

Use:

## Most likely
## First decisive check
## Next 15 Minutes
## Containment
## Permanent fix
## Validate
## Risk if wrong

Containment should be reversible and low blast radius.
