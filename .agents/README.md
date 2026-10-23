# ClaimForge skills for Zed

These project-local skills are copied from the installed Codex skill packs for use with Zed's Agent Skills support. Zed discovers each skill from a direct child folder of `.agents/skills/` containing `SKILL.md`; keep this layout flat.

## Included skills

### Research and RAG
- `research` — source-led research and repository research notes.
- `production-rag-genai-copilot` — production RAG design, evaluation, security, and operations.

### Product engineering
- `tdd`, `codebase-design`, `domain-modeling`, `implement`, `improve-codebase-architecture`, `wizard` — Matt Pocock workflows for testing, architecture, implementation, and problem shaping.
- `karpathy-guidelines` — simple, careful, scoped coding practices.
- `documentation-and-adrs`, `engineering-workflow-guide`, `workflow-designer` — planning, documentation, and workflow design.

### Frontend and prompts
- `frontend-ui-engineering`, `design-taste-frontend`, `high-end-visual-design` — UI engineering and visual design guidance.
- `prompt-design` — prompt structure and evaluation guidance.

### Backend and security
- `supabase`, `create-a-backend`, `security-and-hardening` — Supabase, Vercel backend, and security guidance.

## Use in Zed

Open this folder as a trusted project in Zed. Its Agent should discover these skills under `.agents/skills/`. Check Zed's AI > Skills settings if they do not appear. Zed supports project-local skills in this folder; skills must not be nested inside category folders.

This is a curated ClaimForge set, not a copy of every installed Codex skill. The premium frontend skill stored under `C:\Users\thaku\Desktop\26045` was intentionally not read or copied due to the existing project boundary; `high-end-visual-design` and `frontend-ui-engineering` are included as available alternatives.
