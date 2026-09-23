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
  - Next.js 15 App Router & React 19 web foundation with bilingual layout and `/api/health` endpoint.
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

### Stage 3 — IAM & Multi-Tenant Isolation
* **Status:** **PENDING** (Awaiting explicit user command)
* **Focus:**
  - Secure session management (HttpOnly, Secure, SameSite).
  - RBAC: Customer, Seller, Goldsmith, Platform Admin.
  - Multi-tenant boundary enforcement (`storeId` context in repositories).
  - Password hashing (Argon2id/Bcrypt) and tenant leakage test suite.
* **Completion Criteria:** Cross-tenant access proven impossible by automated test suite.

---

### Stage 4 — Market Data Infrastructure
* **Status:** **PENDING**
* **Focus:**
  - Gold spot rate feeds (18K, 24K, Mesghal, Ounce, Coin rates).
  - Provider abstraction port (`GoldRateProviderPort`).
  - Truthful fallback state: Explicit `UNAVAILABLE` or deterministic dev data.
  - Rate caching layer with TTL and staleness indicators.
* **Completion Criteria:** Invariant tests pass; rate provider mock tests pass; zero invented live market data.

---

### Stage 4.1 — Financial Precision & Currency Semantics
* **Status:** **PENDING**
* **Focus:**
  - Currency normalization (`IRR`, `TOMAN`, `USD`).
  - Deterministic rounding modes (`ROUND_HALF_UP`).
  - Precision unit tests for extreme fractional gold weights (milligram levels).
* **Completion Criteria:** Zero floating-point drift across 100,000 synthetic financial computations.

---

### Stage 5 — Authoritative Pricing Engine
* **Status:** **PENDING**
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
* **Status:** **PENDING**
* **Focus:**
  - Catalog browsing and product detail domain models.
  - Multi-variant jewelry attributes (size, metal color, chain length, gemstone cut).
  - Real-time stock availability tracking and concurrency locks.
* **Completion Criteria:** Catalog queries tenant-safe; inventory decrements race-condition safe.

---

### Stage 7 — Seller Marketplace
* **Status:** **PENDING**
* **Focus:**
  - Marketplace product aggregation.
  - Storefront profiles and seller validation flags.
  - Seller product listing flows with automated pricing binding.
* **Completion Criteria:** Marketplace search and filtering tests pass; seller multi-tenancy verified.

---

### Stage 8 — Seller OS & Dashboard
* **Status:** **PENDING**
* **Focus:**
  - Seller administration dashboard (inventory, order overview, pricing adjustments).
  - Bulk stock updates and profit/making fee controls.
  - Seller-scoped API endpoints with strict authorization guards.
* **Completion Criteria:** All seller endpoints reject requests from unauthorized tenants.

---

### Stage 9 — AI Conversational Designer
* **Status:** **PENDING**
* **Focus:**
  - Interactive design session aggregate (`DesignSession`).
  - AI Gateway integration for natural language prompt analysis.
  - Extraction of jewelry design attributes (metal, purity, stone, occasion).
* **Completion Criteria:** AI Gateway port handles timeouts, fallback, and structured output parsing.

---

### Stage 10 — AI Concept Generation
* **Status:** **PENDING**
* **Focus:**
  - Concept generation pipeline with prompt refinement.
  - Strict domain attribute grounding: AI cannot alter validated material specs.
  - Generation idempotency and token accounting.
* **Completion Criteria:** Output validation enforces domain boundaries; mock provider fallback passes.

---

### Stage 11 — Visual Search Engine
* **Status:** **PENDING**
* **Focus:**
  - Image-based jewelry similarity search abstraction.
  - Feature embedding vector indexing ports.
  - Attribute matching against live catalog.
* **Completion Criteria:** Search endpoint validates file types, prevents path traversal, and returns ranked results.

---

### Stage 12 — Budget-Aware Design Engine
* **Status:** **PENDING**
* **Focus:**
  - Reverse pricing algorithm: Computes viable weight, karat, and stone options for a given target budget.
  - Synchronization with real-time gold spot rates.
* **Completion Criteria:** Recommended configurations strictly satisfy target budget ceiling without floating-point error.

---

### Stage 13 — 3D Jewelry Studio
* **Status:** **PENDING**
* **Focus:**
  - 3D asset metadata models (GLTF/GLB formats, mesh scale, material maps).
  - Asset storage port with signed URLs and mime-type verification.
  - Studio preview abstraction.
* **Completion Criteria:** Safe asset validation tests pass; 3D viewer contracts verified.

---

### Stage 14 — Virtual Try-On Infrastructure
* **Status:** **PENDING**
* **Focus:**
  - AR/Try-On configuration models (ring finger sizing, wrist scale, ear anchoring).
  - Signed temporary asset URLs and privacy compliance.
* **Completion Criteria:** Try-on session lifecycle tests pass; zero persistent unauthorized asset leaks.

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
