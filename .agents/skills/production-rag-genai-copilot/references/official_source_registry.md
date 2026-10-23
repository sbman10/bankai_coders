# Official Source Registry

Use current primary documentation whenever behavior depends on a model/provider, vector store, retrieval service, SDK, framework, pricing model, or security feature.

## OpenAI plugin packaging

- Package plugins: https://developers.openai.com/plugins/build/plugins
- Build skills: https://developers.openai.com/plugins/build/skills
- Submit plugins: https://developers.openai.com/plugins/deploy/submission
- Submission validation/errors: https://developers.openai.com/plugins/deploy/submission-errors

## OpenAI retrieval and RAG-related APIs

- File search: https://developers.openai.com/api/docs/guides/tools-file-search
- Retrieval / vector stores: https://developers.openai.com/api/docs/guides/retrieval
- Vector store search: https://developers.openai.com/api/reference/python/resources/vector_stores/methods/search
- Safety in agentic systems / prompt injection: https://developers.openai.com/api/docs/guides/agent-builder-safety
- Deprecations: https://developers.openai.com/api/docs/deprecations

## Security guidance

- OWASP GenAI Security Project: https://genai.owasp.org/
- OWASP Top 10 for LLM Applications / current GenAI guidance: https://genai.owasp.org/

## Evaluation note

Do not hardcode a vendor-specific eval platform as the architecture default.

OpenAI announced deprecation of its legacy Evals platform in 2026. Use the current primary OpenAI evaluation guidance, datasets, or a product-appropriate external/offline harness when implementation details matter.

## Usage rule

Treat this registry as pointers, not frozen truth. Verify the current official docs for the exact provider, model, SDK, vector store, retriever, reranker, or framework named by the user.
