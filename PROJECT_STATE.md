# V-GOLD Project State Record

---

## Current Execution Summary

* **Project Version:** `0.5.0-alpha`
* **Current Stage:** **Stage 5 — Authoritative Pricing Engine (Audited & Finalized)**
* **Stage Status:** **COMPLETE & FINALIZED**
* **Active Working Branch:** `main`
* **Last Verified Snapshot:** `V-GOLD_STAGE_05_FINAL_COMPLETE`
* **Next Target Stage:** **Stage 6 — Catalog & Inventory Foundations**
* **Execution Status:** **HALTED / AWAITING USER COMMAND**

---

## Stage Completion Matrix

| Stage | Name | Status | Verified Tests | Typecheck | Build | Notes |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **0** | **Discovery & Foundational Architecture** | **COMPLETE** | N/A (Audit & Docs) | PASS | PASS | Baseline established; ADRs defined |
| **1** | **Architecture & Monorepo Foundation** | **COMPLETE** | 16 passed / 0 skipped / 0 failed | PASS | PASS | Workspaces, boundary AST tests, Next.js web |
| **2** | **Domain Models & Database Foundations** | **COMPLETE** | 56 passed / 0 skipped / 0 failed | PASS | PASS | Money, GoldPurity, Weight, Tenant, Store, Drizzle ORM, 0001 migration |
| **3** | **IAM & Multi-Tenancy** | **COMPLETE** | 90 passed / 0 skipped / 0 failed | PASS | PASS | User, Email, PasswordHash, TenantMembership, Session, Scrypt, HttpOnly cookies, 0002 migration |
| **4** | **Market Data Infrastructure** | **COMPLETE** | 140 passed / 0 skipped / 0 failed | PASS | PASS | Sources, Instruments, Price, Observations, Freshness policy, Ingestion, Query, Drizzle schema, 0003 migration |
| **4.1**| **Financial Precision & Currency Semantics** | **COMPLETE** | 187 passed / 0 skipped / 0 failed | PASS | PASS | Audited precision matrix, audited rounding modes, NUMERIC(32, 16) FX storage, truncation guard, 0004 migration |
| **5** | **Authoritative Pricing Engine** | **COMPLETE (AUDITED)** | **237 passed / 0 skipped / 0 failed** | **PASS** | **PASS** | Audited reference rule segregation, no silent commercial defaults, carat separation, rule config snapshot, 0005 & 0006 migrations |
| 6 | Catalog & Inventory Foundations | PENDING | — | — | — | Awaiting user command |
| 7 | Seller Marketplace | PENDING | — | — | — | |
| 8 | Seller OS | PENDING | — | — | — | |
| 9 | AI Conversational Designer | PENDING | — | — | — | |
| 10| AI Concept Generation | PENDING | — | — | — | |
| 11| Visual Search Engine | PENDING | — | — | — | |
| 12| Budget-Aware Design | PENDING | — | — | — | |
| 13| 3D Jewelry Studio | PENDING | — | — | — | |
| 14| Virtual Try-On Infrastructure | PENDING | — | — | — | |
| 15| Custom Manufacturing & RFQ | PENDING | — | — | — | |
| 16| AI Packaging & Box Studio | PENDING | — | — | — | |
| 17| Commerce, Orders & Payments | PENDING | — | — | — | |
| 18| AI Content Studio | PENDING | — | — | — | |
| 19| Social Commerce | PENDING | — | — | — | |
| 20| Trust, Safety & Moderation | PENDING | — | — | — | |
| 21| Analytics & Business Intelligence | PENDING | — | — | — | |
| 22| Performance Optimization | PENDING | — | — | — | |
| 23| Security Hardening & Audit | PENDING | — | — | — | |
| 24| Production Readiness & Ops | PENDING | — | — | — | |
| 25| Comprehensive Product Audit | PENDING | — | — | — | |
| 26| Future Platform Extensions | PENDING | — | — | — | |

---

## Stage 5 Critical Audit & Correction Summary

### 1. Segregation of Reference Rules
- Rules previously seeded as reference models (`rule_iran_bazaar_18k_v1`, `rule_iran_bullion_melt_v1`, `rule_global_retail_18k_v1`) are explicitly marked:
  - `isReferenceSample = true`
  - `specificationSource = 'REFERENCE_SAMPLE_NON_AUTHORITATIVE'`
- `PricingRuleRepositoryPort.findEffective()` excludes reference sample rules by default (`includeReferenceSamples = false`), ensuring they can never be applied as silent production defaults.

### 2. Elimination of Hidden Default Pricing
- If a quote request omits `ruleId` and no tenant-configured authoritative rule exists, the system rejects the request with structured error `EXPLICIT_RULE_REQUIRED` (HTTP 422). The engine never selects an arbitrary or unapproved rule.

### 3. Carat vs. Precious Metal Weight Separation
- Precious metal bulk weight is strictly accepted only in `grams`, `troyOunces`, or `mesghal`.
- Providing `carats` as the metal body weight is explicitly rejected with `INVALID_WEIGHT` ('Carats (ct) are reserved exclusively for gemstone mass...').

### 4. Rule Snapshotting & Historical Reproducibility
- `PricingResult` immutably snapshots the full `effectiveConfig` (making charge type/rate, margin type/rate, tax base/rate, rounding mode/scale), `isReferenceSample`, and `specificationSource`. Subsequent edits or deletions of the rule entity do not alter historical pricing results.

### 5. Separation of Statutory Tax from Commercial Parameters
- Article 26 of Iran VAT Law 1400 (tax levied on making charge + margin; raw gold exempt) is supported via `MARGIN_AND_FEE_ONLY`.
- Commercial percentages (making charge, seller margin) are strictly configurable per rule and never hardcoded as "legal mandates".
- Raw melt/bullion is exempt for raw gold, with workshop service charges explicitly subject to VAT if billed.

---

## Stage 5 Completion Gate Audit

| Gate Item | Target Standard | Measured Result | Status |
| :--- | :--- | :--- | :---: |
| **Pricing Engine** | Deterministic, Decimal-safe, explainable, versionable | Implemented in `PricingEngine` | **PASS** |
| **Calculation Breakdown** | Full granular line items with $\sum \text{lineItems} === \text{finalAmount}$ | Verified in `tests/pricing-engine.test.ts` | **PASS** |
| **Market Data Integration** | Troy Ounce, Mesghal, Gram to pure gram conversion | Verified in `tests/pricing-unit-converter.test.ts` | **PASS** |
| **Freshness Handling** | FRESH succeeds; STALE fails unless explicit override; UNAVAILABLE fails | Verified in `tests/pricing-engine.test.ts` | **PASS** |
| **Purity Semantics** | 24K, 22K, 21K, 18K, 14K, 9K exact decimal fraction | Verified in `tests/pricing-engine.test.ts` | **PASS** |
| **Multi-Currency** | Direct FX, reciprocal inversion, statutory 1:10 Toman/Rial | Verified in `tests/pricing-engine.test.ts` | **PASS** |
| **Tenant Isolation** | Cross-tenant rule usage blocked with IDOR 403; results isolated | Verified in `tests/pricing-tenant-isolation.test.ts` | **PASS** |
| **Reference Rule Segregation**| Reference samples tagged `isReferenceSample: true`, excluded from defaults | Verified in `tests/pricing-specification-audit.test.ts` | **PASS** |
| **Carat Separation** | Carats rejected for gold body mass | Verified in `tests/pricing-specification-audit.test.ts` | **PASS** |
| **Rule Snapshotting** | Immutable `effectiveConfig` stored in `PricingResult` | Verified in `tests/pricing-specification-audit.test.ts` | **PASS** |
| **Database Schema** | `pricing_rules` and `pricing_results` Drizzle tables | Verified in `tests/database-schema-pricing.test.ts` | **PASS** |
| **DDL Migrations** | `0005_authoritative_pricing_engine.sql` and `0006_pricing_rule_audit_metadata.sql` | Verified in `tests/database-migration-pricing.test.ts` | **PASS** |
| **Persistence Contract** | Domain -> Record -> Domain lossless round-trip | Verified in `tests/pricing-persistence-contract.test.ts` | **PASS** |
| **Web API** | `POST /api/v1/pricing/calculate` with Zod validation & structured errors | Verified in `tests/api-pricing.test.ts` | **PASS** |
| **Boundary Isolation** | `@v-gold/core` has ZERO framework, HTTP, DB, or provider SDK imports | Verified in `tests/architecture.test.ts` | **PASS** |
| **Test Suite** | Vitest monorepo suite executes reliably | **237 passed / 0 skipped / 0 failed** (49 test files) | **PASS** |
| **Typecheck** | TypeScript 5.7+ strict check across all workspaces & tests | **0 errors** | **PASS** |
| **Production Build** | `npm run build` compiles all packages and Next.js web app (14 routes) | **Clean build** | **PASS** |
| **PostgreSQL Integration** | Real database availability check | **NOT AVAILABLE** (Sandbox environment; reported transparently) | **REPORTED** |
| **Real Provider Integration** | External market provider credentials detection | **NOT AVAILABLE** (No external API keys in environment; reported transparently) | **REPORTED** |
| **Stage Confinement** | Zero Catalog, Marketplace, or Order checkout code | Strictly Pricing Engine Foundation only | **PASS** |

---

## File System Inventory (Stage 5 Additions & Audit Remediations)

```text
packages/core/src/domain/pricing/
├── pricing-types.ts (Making charge, margin, tax, rule configs, EXPLICIT_RULE_REQUIRED error code)
├── pricing-error.ts (Structured Domain errors: explicitRuleRequired, stale, unavailable, idor)
├── pricing-unit-converter.ts (Lossless conversion from Troy Ounce/Mesghal to gram)
├── pricing-rule.ts (PricingRule entity with isReferenceSample, specificationSource, versioning)
├── pricing-breakdown.ts (PricingBreakdown value object & invariant verification)
├── pricing-result.ts (PricingResult entity with immutable effectiveConfig rule snapshot)
└── pricing-engine.ts (Pure deterministic calculation engine with zero commercial hardcodes)
packages/core/src/ports/
├── pricing-rule.repository.port.ts (findEffective with includeReferenceSamples flag)
└── pricing-result.repository.port.ts
packages/database/src/
├── schema/
│   ├── pricing-rules.ts (isReferenceSample, specificationSource columns)
│   └── pricing-results.ts (ruleReferenceJson snapshot column)
├── migrations/
│   ├── 0005_authoritative_pricing_engine.sql
│   └── 0006_pricing_rule_audit_metadata.sql (Immutable audit metadata migration)
├── repositories/
│   ├── drizzle-pricing-rule.repository.ts
│   └── drizzle-pricing-result.repository.ts
└── adapters/
    ├── in-memory-pricing-rule.repository.ts
    └── in-memory-pricing-result.repository.ts
apps/web/
├── lib/pricing/
│   ├── pricing-service.ts (Enforces carat rejection on gold, EXPLICIT_RULE_REQUIRED)
│   └── pricing-container.ts (Reference sample rules tagged explicitly)
└── app/api/v1/pricing/
    └── calculate/route.ts (Zod validation, carat rejection)
tests/
├── pricing-unit-converter.test.ts
├── pricing-rule.test.ts
├── pricing-engine.test.ts
├── pricing-tenant-isolation.test.ts
├── pricing-persistence-contract.test.ts
├── pricing-specification-audit.test.ts (10 dedicated audit & specification tests)
├── database-schema-pricing.test.ts
├── database-migration-pricing.test.ts
└── api-pricing.test.ts
```

---

## Invariant Adherence Verification

* [x] Every authoritative financial value calculates via Decimal.js.
* [x] No `parseFloat()`, `Math.round()`, or binary float math in authoritative paths.
* [x] Clear codified distinction between `MarketPrice` (quote per mass unit) and `Money` (balance).
* [x] Exact deterministic 1:10 relationship between Iranian Toman and Rial.
* [x] Unit conversion handles Troy Ounces, Grams, and Mesghals losslessly.
* [x] Complete, explainable calculation breakdown provided with line items.
* [x] Mathematical invariant verified: $\sum \text{lineItems} === \text{finalAmount}$.
* [x] Strict market data freshness enforcement.
* [x] Rule versioning and historical reproducibility verified with snapshot of applied parameters.
* [x] Strict tenant isolation and IDOR protection enforced.
* [x] No undocumented commercial percentages are authoritative defaults.
* [x] Reference sample rules segregated with `isReferenceSample = true`.
* [x] Carats strictly rejected for gold body mass.
* [x] No catalog, cart, order, or checkout code created.
* [x] Exactly Stage 5 completed and audited.
* [x] Engine stopped awaiting user authorization for Stage 6.
