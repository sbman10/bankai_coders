# RAG Security and Guardrails

## Purpose

Use this file to review security boundaries in retrieval and grounded-generation systems.

Retrieved content is untrusted data, not instructions.

# 1. Prompt injection

Threats include:
- direct user injection;
- indirect instructions in retrieved/web content;
- hidden/multimodal instructions;
- malicious metadata;
- poisoned knowledge-base documents.

RAG does not eliminate prompt injection risk.

# 2. Authorization

Enforce access before or during retrieval.

Do not rely on:
- prompt instructions;
- post-generation redaction;
- “the model should not mention it.”

Use authoritative user/tenant/resource filters at the retrieval/data boundary.

# 3. Cross-tenant leakage

Check:
- tenant metadata;
- filter construction;
- cache keys;
- shared indexes;
- query rewrite;
- reranking;
- context assembly;
- trace/log data.

One missing filter can make ranking quality irrelevant.

# 4. RAG poisoning

Threat model:
an attacker changes/indexes content designed to manipulate retrieval or generation.

Controls:
- source allowlists;
- trusted ingestion paths;
- provenance;
- content ownership;
- document versioning;
- anomaly/review workflow;
- separation of instructions from retrieved data.

# 5. Secrets and PII

Do not index or log secrets unnecessarily.

Define:
- redaction;
- retention;
- encryption boundary;
- access control;
- trace policy;
- deletion/update propagation.

If sensitive data must be searchable, protect it at the same level as the source system.

# 6. Unsafe URLs/files

When retrieval includes external links/files:
- validate source;
- sandbox parsing/execution where relevant;
- block dangerous file behavior;
- do not execute retrieved instructions/code automatically.

# 7. Exfiltration

Consider outputs that can leak data through:
- links/URLs;
- markdown/image requests;
- tool calls;
- citations;
- logs;
- third-party APIs.

Restrict outbound destinations when needed.

# 8. Tool-enabled RAG

If retrieved content can influence tools/actions:
- keep tool permissions narrow;
- validate parameters;
- require approval for consequential actions;
- do not treat retrieved text as authority to act.

# 9. Security evals

Include:
- direct injection;
- indirect injection;
- cross-tenant query;
- poisoned document;
- secret-seeking query;
- malicious URL/file;
- unauthorized citation/source.

Measure both blocked attacks and false positives.

# 10. Incident response

For suspected leakage:
1. contain access;
2. preserve traces/evidence;
3. identify affected tenants/documents;
4. revoke/rotate credentials if exposed;
5. remove poisoned content safely;
6. rebuild/reindex only with scoped recovery plan;
7. verify with targeted security evals.

Do not casually purge/rebuild everything before preserving evidence.
