# ProductVault

ProductVault helps consumers manage products after purchase: organize product records, understand supplied warranty terms, prepare claim or rejection-response drafts, and set price and replenishment reminders.

## Current priority

Build the ProductVault MVP while keeping the Reforged '26 deck accurate. See [slide copy and visuals](deck/slide-copy.md), [deck outline](deck/pitch-deck-outline.md), and [research notes](research.md).

## Product documents

- [Product requirements](PRD.md)
- [Agent and coding instructions](AGENTS.md)
- [Workflow specification](workflows/warranty-claim-intake.md)
- [Research and citations](research.md)
- [Evolving notes](NOTES.md)

## Status

The web app uses Supabase Auth and owner-scoped routes for claim intake, products, manual price watches, and in-app reminder records. The signed-in dashboard now reads the same saved products, reminders, price watches, and claims as the product library and timeline; fictional sample records remain limited to the signed-out preview. Claim submissions store selected files in private Supabase Storage and create an idempotent event. The `ProductVault App API` and daily reminders n8n workflows now point at the app routes, but remain inactive until their separate credentials, additive migrations, and HTTPS synthetic verification are complete. The app-side processor sends extracted claim-document text to the configured Groq service; n8n does not receive document contents. Automated retailer price checks and outbound notifications are not live-verified.

## MVP codebase

The web app is in [`apps/web`](apps/web/README.md). See [the n8n integration findings](docs/n8n-integration.md) for the activation boundary and workflow contract.

To run it locally:

```powershell
cd apps/web
npm install
npm run dev
```

See the [web app README](apps/web/README.md) for the current scope and checks.
