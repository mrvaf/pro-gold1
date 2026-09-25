# V-GOLD Master Execution Roadmap

This document outlines the strict 26-stage clean-room reconstruction plan for the **V-GOLD** platform. Each stage is governed by the **ONE STAGE AT A TIME** principle and the **Completion Gate**.

---

## Stage Progression & Status

### Stage 0 — Discovery & Foundational Architecture
* **Status:** **COMPLETE**
* **Focus:** Clean-room workspace audit, domain discovery, architectural decisions (ADRs), core documentation (`README.md`, `ARCHITECTURE.md`, `PROJECT_STATE.md`, `ROADMAP.md`), and test infrastructure blueprint.
* **Completion Criteria:** All core architectural decisions accepted; full lifecycle constraints documented.

---

### Stage 1 — Architecture & Monorepo Foundation
* **Status:** **COMPLETE**
* **Focus:** 
  - Monorepo setup (`apps/web`, `packages/core`, `packages/database`, `packages/ai-gateway`).
  - Strict TypeScript 5.7+ configuration across packages.
  - Vitest 3.x test harness and scripts (`npm test`, `npm run typecheck`, `npm run build`).
  - Architecture boundary linting and layer validation (AST scan asserting zero leakage into domain).
  - Domain primitives (`Result<T,E>`, `Entity`, `ValueObject`, `EntityId`, `DomainError`, Ports).
  - Next.js 15 App Router & React 19 web foundation with Persian RTL layout (lang=fa, dir=rtl); bilingual layout not yet implemented; includes `/api/health` endpoint.
* **Completion Gate:** 16 passed / 0 skipped / 0 failed, 0 type errors, clean Next.js production build.

---

### Stage 2 — Domain Models & Database Foundations
* **Status:** **COMPLETE**
* **Focus:**
  - Core domain entities: `Tenant` (TenantId), `Store` (StoreId).
  - Value objects: `Money` (Decimal.js, strict arithmetic, currency parity), `Currency` (`IRR`, `TOMAN`, `USD`, `EUR`), `GoldPurity` (Karat/Fineness), `Weight` (canonical grams, mesghal, carats, ounces), `ActorReference`, `AuditMetadata`, `JewelryIdentity`.
  - PostgreSQL schema and initial DDL migration `0001_core_foundation.sql` via Drizzle ORM.
  - Repository ports: `TenantRepositoryPort`, `StoreRepositoryPort`.
  - Drizzle repositories (`DrizzleTenantRepository`, `DrizzleStoreRepository`) with record-to-entity mappers.
  - In-memory repository adapters (`InMemoryTenantRepository`, `InMemoryStoreRepository`) enforcing tenant isolation.
* **Completion Gate:** 56 passed / 0 skipped / 0 failed, 0 type errors, clean build, clean DDL verification.

---

### Stage 3 — IAM & Multi-Tenancy
* **Status:** **COMPLETE**
* **Focus:**
  - Domain entities & value objects: `User`, `UserId`, `Email`, `PasswordHash`, `TenantMembership`, `Session`, `AuthorizationService`.
  - Password security: `ScryptPasswordHasher` (memory-hard KDF, 16-byte random salt, timing-safe equality, strict password policy).
  - Server-side sessions: Cryptographically random 64-character tokens, HttpOnly/SameSite/Secure cookies, zero client-side token storage, immediate server revocation on logout.
  - Authorization: Explicit role-to-permission resolution (`OWNER`, `ADMIN`, `MEMBER`), centralized server-side evaluation, IDOR protection.
  - PostgreSQL schema & numbered migration `0002_iam_foundation.sql` (`users`, `tenant_memberships`, `sessions` tables).
  - API endpoints: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me` with Zod validation.
* **Completion Gate:** 90 passed / 0 skipped / 0 failed across 20 test files, 0 typecheck errors, clean Next.js production build.

---

### Stage 4 — Market Data Infrastructure
* **Status:** **COMPLETE**
* **Focus:**
  - Domain entities & value objects: `MarketDataSource`, `MarketInstrument`, `MarketPrice` (Decimal.js), `MarketObservation`, `MarketUnit`, `MarketDataFreshnessPolicy`.
  - Provider abstraction: `MarketDataProviderPort` with explicit capability model (`ProviderCapabilities`).
  - Truthful fallback: `UnavailableMarketDataProvider` (no fake live data); `MockMarketDataProvider` for automated tests only.
  - Ingestion: `MarketDataIngestionService` enforcing capability checks, Decimal parsing, idempotency by `(sourceId, instrumentId, observedAt)`, and append-only immutability.
  - Query: `MarketDataQueryService` evaluating freshness (`FRESH`, `STALE`, `UNAVAILABLE`) and historical ranges.
  - PostgreSQL schema & numbered migration `0003_market_data_foundation.sql` (`market_data_sources`, `market_instruments`, `market_observations` with `NUMERIC(24, 8)`).
  - API endpoints: `/api/v1/market-data/instruments`, `/api/v1/market-data/latest`, `/api/v1/market-data/latest/:instrument`.
* **Completion Gate:** 140 passed / 0 skipped / 0 failed across 31 test files, 0 typecheck errors, clean Next.js production build.

---

### Stage 4.1 — Financial Precision & Currency Semantics
* **Status:** **COMPLETE**
* **Focus:**
  - Three-tier precision architecture: Calculation (arbitrary Decimal) vs Storage (per-type `NUMERIC` scale boundaries — see the Precision Matrix in `ARCHITECTURE.md` §5.2) vs Presentation (currency minor units).
  - Explicit rounding policy: `ROUND_HALF_UP`, `ROUND_HALF_EVEN`, `ROUND_UP`, `ROUND_DOWN` with zero premature rounding on intermediate calculation chains.
  - Enhanced currency semantics (`IRR`, `TOMAN`, `USD`, `EUR`) and statutory Toman/Rial deterministic ratio (`1 TOMAN = 10 IRR`).
  - Directional foreign exchange rate modeling (`FxRate`) with arbitrary-precision reciprocal inversion.
  - Authoritative currency conversion (`CurrencyConverter.convert()`, `tomanToIrr()`, `irrToToman()`).
  - PostgreSQL schema & migration `0004_financial_precision_currency_semantics.sql` (`fx_rates` table).
  - API endpoints: `/api/v1/finance/currencies`, `/api/v1/finance/fx-rates`.
* **Completion Gate:** 187 passed / 0 skipped / 0 failed across 40 test files (the 175 / 39 figures were the pre-audit count), 0 typecheck errors, clean Next.js production build.

---

### Stage 5 — Authoritative Pricing Engine
* **Status:** **COMPLETE**
* **Focus:**
  - Pure domain pricing service calculating:
    - Base Gold Value = $Weight \times \frac{Purity}{750} \times SpotPrice$
    - Making Fee (Percentage or Fixed per gram)
    - Gemstone & Material Surcharges
    - Seller Margin
    - Value Added Tax (VAT applied only on fee + margin per gold tax regulations)
    - Shipping & Discounts
  - Client-side price override prevention.
* **Completion Criteria:** 100% test coverage of all pricing edge cases and statutory tax scenarios.

---

### Stage 6 — Catalog & Inventory Foundations
* **Status:** **COMPLETE**
* **Focus:**
  - Decoupling of Catalog (Product, ProductVariant) from physical serialized stock (InventoryItem, InventoryLocation).
  - Multi-variant jewelry attributes (purity, metal mass, gemstone carat metadata).
  - Physical mass invariants ($\text{grossWeight} \ge \text{netGoldWeight} + \sum \text{gemstoneWeight}$) and strict non-interchangeability of carats with gold mass.
  - Finite Inventory State Machine (`AVAILABLE`, `RESERVED`, `SOLD`, `DAMAGED`, `LOST`, `IN_TRANSIT`) with explicit `startTransfer` and `completeTransfer` transitions.
  - Append-only immutable `InventoryMovement` audit log.
  - Transaction-safe `InventoryUnitOfWorkPort` with atomic persistence and failure rollback.
  - Tenant store ownership verification and composite foreign keys `(store_id, tenant_id)`.
  - Authoritative `ProductVariant` SKU derivation with caller mismatch rejection.
* **Completion Criteria:** 293 tests passing; zero regressions; strict tenant-scoped SKU and IDOR protection; sequential migrations 0007 and 0008.

---

### Stage 7 — Seller Marketplace Foundation
* **Status:** **COMPLETE**
* **Focus:**
  - SellerProfile identity, finite state machine (`DRAFT`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`), and metadata.
  - Global normalized SellerSlug validation and public storefront presence (explicit URL architectural assumption).
  - Decoupled SellerListing domain linking Seller to existing Catalog ProductVariant (zero catalog/pricing duplication).
  - Cross-tenant catalog ownership invariants and database composite foreign keys `(product_id, tenant_id)` & `(product_variant_id, product_id, tenant_id)`.
  - Non-archived listing uniqueness semantics via PostgreSQL partial unique index.
  - Cascading seller suspension policy with instant dynamic public discovery suppression.
  - Public sanitized discovery endpoints stripped of internal tenant/tax data.
* **Completion Criteria:** 337 tests passing; zero regressions; strict tenant-scoped isolation; sequential migrations 0009 and 0010.

---

### Stage 8 — Seller OS Foundation
* **Status:** **COMPLETE & FINALIZED**
* **Focus:**
  - `SellerWorkspace` aggregate root bound strictly to `Tenant`, `SellerProfile`, and optional `Store`.
  - Single workspace per seller profile invariant with finite lifecycle (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
  - IAM reuse: additive `OPERATOR` role and granular `seller.*` permissions on existing `TenantMembership`.
  - Zero-fake-KPI operational overview aggregation from authoritative inventory, listing, and staff repositories.
  - Inventory inspection and transfers orchestrated via Stage 6 `InventoryService` and `InventoryUnitOfWorkPort`.
  - Listing lifecycle management orchestrated via Stage 7 `SellerListing`.
  - Multi-tenant isolation and IDOR mitigation with composite foreign keys in PostgreSQL.
* **Completion Criteria:** 385 tests passing across 65 test files; zero regressions; strict tenant isolation; sequential migration `0011_seller_os_foundation.sql`.

---

### Stage 8.1 — API Authentication & Error-Handling Hardening
* **Status:** **COMPLETE & FINALIZED**
* **Focus:**
  - Tenant/actor identity derived exclusively from the HttpOnly `vgold_session` session cookie via shared `authenticateRequest` (generalized from `authenticateSellerOsRequest`).
  - Client identity input (`tenantId`/`actorId` in query/body, `x-tenant-id`/`x-actor-id` headers) rejected with `400 VALIDATION_ERROR` on every route.
  - Explicit per-operation permissions (`catalog.read/manage`, `inventory.read/manage`, `pricing.read`) with role mapping recorded in ADR-0041.
  - `/api/v1/inventory/movements` reaches data only through `InventoryService` with Zod-validated pagination.
  - Shared error mapper (`toErrorResponse`): domain errors keep their contract; unknown errors → generic `INTERNAL_ERROR` + secret/PII-free server logs (ADR-0042).
* **Completion Criteria:** 525 tests passing (385 baseline preserved without assertion changes + 140 negative-matrix tests: 20 route methods × 7 scenarios); live `next start` verification: all 12 formerly-open routes return 401 without a cookie.

---

### Stage 8.2 — ID/scrypt/Purity Hardening
* **Status:** **COMPLETE & FINALIZED**
* **Focus:**
  - UUIDv7 entity identifiers from a single `IdGenerator` port (RFC 9562; CSPRNG via `globalThis.crypto.getRandomValues`), injectable via `setDefaultIdGenerator`; all 12 `Math.random`/`Date.now` fallback sites (plus the mock provider's `externalId`) now delegate to `generateId` (ADR-0043).
  - scrypt password hashing upgraded to OWASP parameters `N=2^17, r=8, p=1` with computed `maxmem`, environment overrides (`VGOLD_SCRYPT_N/R/P`) behind a safe floor (`N ≥ 2^14`), parameters read from the stored hash (legacy N=16384 hashes keep verifying), and transparent re-hash after successful login (ADR-0044).
  - 22-karat fineness canonicalized from 916.6 to **916** (ISO 9202 millesimal mark, aligned with the 585/14K style); documented pricing effect: ≈ −0.0655 % gold content (ADR-0045).
  - PostgreSQL decision recorded (ADR-0046): real connection, safe migration, and RLS deferred to Stage 8.3, before Stage 9.
* **Completion Criteria:** 537 tests passing (525 baseline preserved + 12 new: IdGenerator suite, transparent hash-upgrade suite, scrypt legacy-compat/env-floor tests, 22K→916 purity test); typecheck PASS; build PASS.

---

### Stage 8.3 — Real Data Infrastructure (actual PostgreSQL, safe migration, RLS)
* **Status:** **COMPLETE & FINALIZED**
* **Focus:**
  - First live database driver in the project's history: `pg` + Drizzle over `node-postgres`; `createPersistence()` composition factory serves all 21 ports with explicit `DATABASE_ENABLED=true` opt-in (default remains in-memory) across all eight composition roots (ADR-0047).
  - Sequential SQL migration runner: 0001–0012 applied to a real cluster, each file atomic with its `schema_migrations` ledger entry, idempotent re-runs, loud out-of-order refusal (ADR-0048).
  - Row-Level Security enabled + forced on all 12 tenant-scoped tables; conditional tenant policy keyed on the transaction-local `app.tenant_id` GUC; tenant-context decorators bind every repository call to its tenant while the deliberate un-scoped branch preserves cross-tenant probes, public discovery, and login flows (ADR-0049).
* **Completion Criteria:** 550 tests passing against a live embedded PostgreSQL cluster (537 baseline preserved + 13 new: migration ledger/idempotency, RLS catalog assertions, pg+Drizzle round-trips, cross-tenant probe contract, composition factory modes, and the six-cell RLS enforcement matrix as restricted role `vgold_app`); typecheck PASS; build PASS.

---

### Stage 9 — AI Conversational Designer
* **Status:** **COMPLETE & FINALIZED**
* **Focus:**
  - Interactive design session aggregate (`DesignSession`) with progressive attribute accumulation (`ExtractedDesignAttributes`).
  - AI Gateway integration with prompt analysis, structured attribute extraction, resilience timeouts (504 `AiTimeoutError`), and truthful fallback (503 `AiProviderUnavailableError`).
  - Extraction of jewelry design attributes (metal, purity, stone, occasion, jewelry type).
  - Multi-tenant persistence: `design_sessions` schema, migration `0013_ai_conversational_designer.sql` with Row-Level Security, Drizzle/In-Memory repositories, and tenant-scoped decorator.
  - API endpoints `/api/v1/ai/design-sessions` with session-derived identity, granular `ai.design` permission, and 400 rejection for spoofed identity fields.
* **Completion Criteria:** 571 tests passing; zero regressions; typecheck PASS; build PASS; AI Gateway port handles timeouts, fallback, and structured output parsing.

---

### Stage 10 — AI Concept Generation
* **Status:** **COMPLETE & FINALIZED**
* **Focus:**
  - Concept generation pipeline (`DesignConcept`) with prompt refinement and creative design proposals.
  - Strict domain attribute grounding: AI cannot alter validated material specs (enforced via `ConceptGroundingViolationError`).
  - Generation idempotency (`idempotencyKey` uniqueness) and comprehensive token accounting (`TokenAccounting`).
  - Resilient AI Gateway integration with timeout protection and fallback.
  - Multi-tenant persistence: `design_concepts` schema, migration `0014_ai_concept_generation.sql` with Row-Level Security, Drizzle/In-Memory repositories, and tenant-scoped decorators.
  - API endpoints `/api/v1/ai/design-sessions/[id]/concepts` with session auth, approval workflow, and IDOR protection.
* **Completion Criteria:** 588 tests passing; zero regressions; typecheck PASS; build PASS; output validation enforces domain boundaries; mock provider fallback passes.

---

### Stage 11 — Visual Search Engine
* **Status:** **DONE**
* **Focus:**
  - Image-based jewelry similarity search abstraction.
  - Feature embedding vector indexing ports and cosine similarity math.
  - Attribute matching against live catalog.
  - Path traversal and MIME-type validation.
  - Row-Level Security for product feature embeddings.
* **Completion Criteria:** 603 tests passing; zero regressions; typecheck PASS; build PASS; ADR-0052 recorded; vector cosine similarity and tenant isolation verified.
* **Completion Criteria:** Search endpoint validates file types, prevents path traversal, and returns ranked results.

---

### Stage 12 — Budget-Aware Design Engine
* **Status:** **DONE**
* **Focus:**
  - Reverse pricing algorithm: Computes viable weight, karat, and stone options for a given target budget.
  - Synchronization with real-time gold spot rates.
  - Arbitrary-precision bisection search guaranteeing zero floating-point error.
  - API endpoint `POST /api/v1/ai/budget-engine`.
* **Completion Criteria:** 608 tests passing; zero regressions; typecheck PASS; build PASS; ADR-0053 recorded; recommended configurations strictly satisfy target budget ceiling without floating-point error.

---

### Stage 13 — 3D Jewelry Studio
* **Status:** **DONE**
* **Focus:**
  - 3D asset metadata models (GLTF/GLB formats, mesh scale, material maps).
  - Asset storage port with signed URLs and mime-type verification.
  - Studio preview abstraction.
  - Migration 0016_studio_3d_foundation.sql with PostgreSQL Row-Level Security.
  - REST endpoints `POST /api/v1/studio-3d/assets` and `GET /api/v1/studio-3d/assets/[id]`.
* **Completion Criteria:** 616 tests passing; zero regressions; typecheck PASS; build PASS; ADR-0054 recorded; safe asset validation tests pass; 3D viewer contracts verified.

---

### Stage 14 — Virtual Try-On Infrastructure
* **Status:** **DONE**
* **Focus:**
  - AR/Try-On configuration models (ring finger sizing, wrist scale, ear anchoring).
  - Signed temporary asset URLs and privacy compliance.
  - Ephemeral session lifecycles and state machine transitions.
  - Migration 0017_virtual_try_on_foundation.sql with PostgreSQL Row-Level Security.
  - REST endpoints `POST /api/v1/try-on/sessions` and `GET /api/v1/try-on/sessions/[id]`.
* **Completion Criteria:** 622 tests passing; zero regressions; typecheck PASS; build PASS; ADR-0055 recorded; try-on session lifecycle tests pass; zero persistent unauthorized asset leaks.

---

### Stage 15 — Custom Manufacturing & RFQ Workflows
* **Status:** **PENDING**
* **Focus:**
  - Request for Quote (RFQ) aggregate between customer, seller, and certified goldsmiths.
  - Milestone-based quotes, specification approval, and in-band messaging.
* **Completion Criteria:** State transitions for RFQ lifecycle enforced by domain state machine tests.

---

### Stage 16 — AI Packaging & Box Studio
* **Status:** **PENDING**
* **Focus:**
  - Box dimensions, materials (leather, velvet, wood), luxury tiers, dieline specifications.
  - Packaging cost model integrated with order pricing.
  - AI packaging visual generator abstraction (returns 503 if provider offline).
* **Completion Criteria:** Structural validation of packaging specs; cost model tests pass.

---

### Stage 17 — Commerce, Orders & Payments
* **Status:** **PENDING**
* **Focus:**
  - Cart, Cart Line, Order, Order Line, Stock Reservation aggregates.
  - Atomic inventory reservation with expiration sweeps.
  - Authoritative final price computation on server.
  - Payment provider abstraction (mock adapter for dev/test; secure callback verification).
  - Complete commerce idempotency.
* **Completion Criteria:** Double-submission tests pass; concurrent stock reservations prevent overselling.

---

### Stage 18 — AI Content Studio
* **Status:** **PENDING**
* **Focus:**
  - Automated product description, Instagram/social caption, and certificate copy generation.
  - Factual grounding check: Copies must match registered karat, weight, and gemstones.
* **Completion Criteria:** Grounding validation rejects hallucinated specs; multi-language output validated.

---

### Stage 19 — Social Commerce & Multi-Platform Publishing
* **Status:** **PENDING**
* **Focus:**
  - Social publishing abstraction (Instagram, Telegram, WhatsApp catalogs).
  - Secure credential storage (AES-GCM encryption for seller access tokens).
  - Scheduled publishing queue models.
* **Completion Criteria:** Zero plain-text credentials; publishing port mock tests pass.

---

### Stage 20 — Trust, Safety & Seller Verification
* **Status:** **PENDING**
* **Focus:**
  - Goldsmith guild license verification and hallmark audit trails.
  - Customer review moderation and fraud detection hooks.
  - Immutable audit event logging.
* **Completion Criteria:** Trust score calculation uses verified evidence only; no synthetic ratings.

---

### Stage 21 — Analytics & Business Intelligence
* **Status:** **PENDING**
* **Focus:**
  - Pure analytical aggregation of persisted order, product, and inventory data.
  - Real-time seller revenue, margin, and gold turnover metrics.
* **Completion Criteria:** Zero fabricated analytics data; queries enforce tenant boundaries.

---

### Stage 22 — Performance Optimization & Scaling
* **Status:** **PENDING**
* **Focus:**
  - Database index optimization (compound indices on tenant, date, status).
  - Bounded pagination and query optimization (avoid N+1 queries).
  - Caching strategies for gold pricing and public catalog.
* **Completion Criteria:** Deterministic benchmark tests verify bounded memory and query execution times.

---

### Stage 23 — Security Hardening & Penetration Audit
* **Status:** **PENDING**
* **Focus:**
  - Threat modeling (OWASP Top 10): CSRF, SSRF, SQLi, XSS, rate limiting.
  - Session replay protection and header hardening.
  - Secret scanning and automated security tests.
* **Completion Criteria:** Comprehensive security test suite passes with zero high/critical vulnerabilities.

---

### Stage 24 — Production Readiness & Operations
* **Status:** **PENDING**
* **Focus:**
  - Health check and readiness probes (`/health/live`, `/health/ready`).
  - Graceful shutdown, telemetry, structured JSON logging, and database backup scripts.
* **Completion Criteria:** Containerized build verification; health checks return appropriate HTTP status codes.

---

### Stage 25 — Comprehensive Product Audit
* **Status:** **PENDING**
* **Focus:**
  - Full-system end-to-end audit: Domain, API, DB, IAM, Financials, AI, UI, i18n, Accessibility.
  - Verification of all previous stage invariants.
* **Completion Criteria:** End-to-end user journeys pass cleanly across all modules.

---

### Stage 26 — Future Platform Extensions
* **Status:** **PENDING**
* **Focus:**
  - Architectural extension points: Jewelry Style DNA modeling, Digital Jewelry Passport provenance.
  - Extensible schema hooks documented without premature or fake feature claims.
* **Completion Criteria:** Extension points validated as clean, non-breaking architectural interfaces.
