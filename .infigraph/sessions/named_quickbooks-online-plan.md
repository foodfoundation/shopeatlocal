
## Save @ 11:32 UTC

Started a fresh planning session for a QuickBooks Online integration. The mandatory Infigraph session check found no previous session, and list_projects found no index. Because Plan mode prohibits non-readonly indexing, three read-only exploration agents mapped architecture, commerce/accounting data, and integration infrastructure. They found an Express 4/Handlebars/MySQL monolith under app, with Transact as the balance ledger, four Invc* tables as financial source documents, cycle phase settlement in EvtCyc.js, Square as the best idempotency/webhook precedent, PayPal as only a basic client-credentials example, and no QuickBooks/Intuit code. The app has no queue or scheduler; phase processing is request-driven. Deployment is one Kubernetes Deployment manifest with no explicit replicas and Flyway migrations through app/Extra V01-V09. Direct reads confirmed wAdd_Transact, Square checkout finalization guards, Square webhook event deduplication, accounting-summary cycle aggregation, accounting staff routes, current config style, and the existing Cashier UI. Official Intuit documentation research confirmed one-hour access tokens, rolling 100-day refresh tokens with rotation that must be atomically persisted, API throttling and 429 retry requirements, and that A/R journal lines require a Customer entity. The user selected all outbound flows, a hybrid model with summarized sales and individual producer accounting, a new QBO company, automatic posting with held exceptions, US accrual accounting, payment-method clearing accounts, QBO Classes by sales channel, detailed producer gross/fee/net accounting, an in-web-process sync runtime, cutover-only history, Intuit sandbox availability, automatic chart/account bootstrap, shopeatlocal as the member A/R subledger, shopeatlocal tax totals as authoritative, append-only reversals for corrections, shopeatlocal-originated producer payouts, and gross Bills plus Vendor Credits for producer fee deductions.

## Save @ 11:33 UTC

After the initial codebase review and requirement rounds, the final operational choices were established. Sales and membership activity will be summarized by cycle while payments and adjustments will post as daily payment-method summaries. Automatic sync failures will appear in a staff dashboard and trigger email after retries are exhausted. Producer payouts lack invoice identifiers in the existing schema, so the integration will allocate them to the producer’s oldest open QuickBooks Bills and Vendor Credits first and permit partial payment. These complete the major design choices needed for the plan.

## Save @ 11:34 UTC

A final check of Intuit API guidance confirmed that QBO write idempotency uses a unique requestid query parameter. The integration must persist the same requestid for every retry of a logical operation and use stable document numbers to verify ambiguous timeout outcomes before resubmitting.

## Save @ 11:36 UTC

The user explicitly removed Kubernetes from scope. The plan was edited so QBO credentials, redirect URI, polling settings, and token-encryption key use application runtime environment-variable overrides, and rollout follows the project's non-Kubernetes deployment mechanism. It now explicitly prohibits adding or modifying Kubernetes resources.

## Save @ 11:38 UTC

The user requested that native Intuit resources be used wherever possible and cited intuit-oauth. Official Intuit documentation and the Intuit-owned GitHub repository confirmed intuit-oauth is the official Node OAuth/OpenID client. Its current package supports authorization URL generation, code exchange, refresh and revoke, token validation, API requests with environment base URL resolution, QuickBooks Fault parsing, Intuit transaction IDs, and transient retry/error handling. The plan now requires this package, wraps it with thin local adapters, uses makeApiCall for Accounting API calls, follows official entity documentation and requestid guidance, and excludes the unaffiliated community node-quickbooks SDK. Local code remains responsible only for persistence, encryption, locking, durable jobs, and application-level observability.

## Save @ 11:39 UTC

The prior plan included an idempotent bootstrap service and admin UI action but did not explicitly specify a standalone script. The plan now includes app/scripts/bootstrap-quickbooks.js plus an npm quickbooks:bootstrap command. The CLI reuses the same service, runs after OAuth authorization, supports dry-run and cutover selection, emits sanitized machine-readable results, records audit events, validates realm/environment, avoids destructive account changes, and has dedicated rerun/conflict tests.
