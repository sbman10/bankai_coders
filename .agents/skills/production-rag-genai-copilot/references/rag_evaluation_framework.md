# RAG Evaluation Framework

## Purpose

Use this file to design evaluations that support product and engineering decisions.

Evaluate the layer being changed, then verify end-to-end behavior.

# 1. Start with the decision

Examples:
- Did hybrid retrieval improve answerability?
- Should we change chunking?
- Did the reranker improve ordering enough to justify latency?
- Did a model change improve groundedness?
- Is the new index safe to promote?

Write the decision before choosing metrics.

# 2. Eval dataset

Build from:
- real user queries;
- known failures;
- important business tasks;
- hard negatives;
- ambiguous questions;
- no-answer cases;
- conflicting-source cases;
- multilingual/domain slices;
- security/adversarial cases.

Track expected source/evidence where possible.

# 3. Retrieval evaluation

When relevance labels/qrels exist, use metrics such as:
- recall@k;
- precision@k;
- MRR;
- NDCG;
- hit rate.

Also inspect:
- relevant document missing;
- relevant chunk poorly ranked;
- irrelevant source dominating;
- filter leakage.

Do not judge retrieval only by final answer quality.

# 4. Context evaluation

Measure whether final model context:
- contains required evidence;
- excludes unauthorized evidence;
- avoids excessive duplication;
- preserves provenance;
- fits token budget;
- handles conflicts/recency.

# 5. Generation evaluation

Possible dimensions:
- groundedness;
- factual correctness;
- relevance;
- completeness;
- instruction adherence;
- abstention;
- citation correctness.

Separate answer quality from retrieval quality.

# 6. Citation evaluation

Evaluate:
1. citation presence where needed;
2. claim support;
3. correct source attribution;
4. source coverage for multi-claim answers.

A high citation count is not a quality metric.

# 7. No-answer / abstention

Include cases where the correct behavior is:
- “not enough evidence”;
- “source unavailable”;
- “conflicting sources”;
- “not authorized.”

Measure false answers and unnecessary abstention separately.

# 8. LLM-as-judge

Use model judges for qualitative criteria when needed.

Guardrails:
- explicit rubric;
- representative examples;
- calibration against human labels;
- consistency checks;
- blinded comparison where practical.

Do not treat judge output as ground truth.

# 9. Slices

Report by meaningful slices:
- query type;
- document type;
- language;
- tenant/domain;
- answerable vs unanswerable;
- fresh vs stale;
- short vs complex query.

Avoid hiding a bad slice inside one average.

# 10. Regression gates

Define before launch:
- minimum retrieval quality;
- no security regression;
- groundedness/citation threshold;
- latency budget;
- cost budget;
- no-answer behavior.

Document why a threshold changes.

# 11. Online validation

Use when appropriate:
- shadow;
- canary;
- limited beta;
- feature flag;
- human review.

Offline improvement is not proof of production improvement.

# 12. Continuous evals

Add production failures to the eval set.

Version results by:
- corpus/index;
- embedding model;
- chunker;
- retriever;
- reranker;
- prompt;
- model;
- application version.

This makes regressions diagnosable instead of anecdotal.
