# V-GOLD Project State Record

---

## Current Execution Summary

* **Project Version:** `0.5.0-alpha`
* **Current Stage:** **Stage 5 — Authoritative Pricing Engine**
* **Stage Status:** **COMPLETE**
* **Active Working Branch:** `main`
* **Last Verified Snapshot:** `V-GOLD_STAGE_05_COMPLETE`
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
| **5** | **Authoritative Pricing Engine** | **COMPLETE** | **224 passed / 0 skipped / 0 failed** | **PASS** | **PASS** | Deterministic engine, line item breakdown invariant, unit-to-gram conversion, Iranian VAT (law 1400), 0005 migration |
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

## Stage 5 Implemented Pricing Formulas

### 1. Base Gold Spot Value
$$\text{ratePerGram} = \frac{\text{marketPrice.amount}}{\text{gramsPerMarketUnit}}$$
$$\text{pureGrams} = \text{weight.grams} \times \left(\frac{\text{purity.fineness}}{1000}\right)$$
$$\text{baseMetalValue} = \text{pureGrams} \times \text{ratePerGram}$$

### 2. Making Charge ($\text{Ojrat}$)
- `PERCENTAGE`: $\text{baseMetalValue} \times \text{rate}$
- `PER_GRAM`: $\text{weight.grams} \times \text{rate}$
- `FIXED`: Flat monetary amount in target currency
- `ZERO`: $\text{Money.zero(currency)}$

### 3. Seller Margin ($\text{Sood}$)
- `PERCENTAGE`: $(\text{baseMetalValue} + \text{makingCharge}) \times \text{marginRate}$
- `FIXED`: Flat monetary amount in target currency
- `ZERO`: $\text{Money.zero(currency)}$

### 4. Stone / Gemstone Value
- Sum of discrete gemstones / diamonds / pearls provided in quote context (default: $\text{Money.zero(currency)}$).

### 5. Statutory Tax / Value Added Tax (VAT)
- `MARGIN_AND_FEE_ONLY` (Iranian statutory gold reform 1400):
  $$\text{taxableBase} = \text{makingCharge} + \text{sellerMargin}$$
  $$\text{taxAmount} = \text{taxableBase} \times \text{taxRate}$$
  *(Raw gold bullion is legally exempt from VAT).*
- `TOTAL_VALUE` (International standard retail luxury VAT):
  $$\text{taxAmount} = \text{subtotal} \times \text{taxRate}$$
- `EXEMPT`: $\text{Money.zero(currency)}$

### 6. Presentation Rounding & Line Item Invariant
$$\text{finalAmount} = \text{round}(\text{unroundedTotal}, \text{scale}, \text{mode})$$
$$\text{roundingAdjustment} = \text{finalAmount} - \text{unroundedTotal}$$
$$\sum \text{lineItems} = \text{finalAmount} \quad (\text{Strict Invariant Verified})$$

### 7. Formally Unimplemented Features (Strictly Stage-Confined)
- Dynamic multi-seller RFQ reverse bidding: **NOT IMPLEMENTED — specification not defined**.
- 4Cs Diamond Rapaport pricing matrix: **NOT IMPLEMENTED — specification not defined**.
- Customer coupon / loyalty discount stacking: **NOT IMPLEMENTED (deferred to Stage 17)**.
- Order checkout and payment gateway execution: **NOT IMPLEMENTED (deferred to Stage 17)**.

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
| **Tenant Isolation** | Cross-tenant rule usage blocked with IDOR 403; results scoped | Verified in `tests/pricing-tenant-isolation.test.ts` | **PASS** |
| **Database Schema** | `pricing_rules` and `pricing_results` Drizzle tables | Verified in `tests/database-schema-pricing.test.ts` | **PASS** |
| **DDL Migration** | Sequentially numbered `0005_authoritative_pricing_engine.sql` | Verified in `tests/database-migration-pricing.test.ts` | **PASS** |
| **Persistence Contract** | Domain -> Record -> Domain lossless round-trip | Verified in `tests/pricing-persistence-contract.test.ts` | **PASS** |
| **Web API** | `POST /api/v1/pricing/calculate` with Zod validation & structured errors | Verified in `tests/api-pricing.test.ts` | **PASS** |
| **Boundary Isolation** | `@v-gold/core` has ZERO framework, HTTP, DB, or provider SDK imports | Verified in `tests/architecture.test.ts` | **PASS** |
| **Test Suite** | Vitest monorepo suite executes reliably | **224 passed / 0 skipped / 0 failed** (48 test files) | **PASS** |
| **Typecheck** | TypeScript 5.7+ strict check across all workspaces & tests | **0 errors** | **PASS** |
| **Production Build** | `npm run build` compiles all packages and Next.js web app (14 routes) | **Clean build** | **PASS** |
| **PostgreSQL Integration** | Real database availability check | **NOT AVAILABLE** (Sandbox environment; reported transparently) | **REPORTED** |
| **Real Provider Integration** | External market provider credentials detection | **NOT AVAILABLE** (No external API keys in environment; reported transparently) | **REPORTED** |
| **Stage Confinement** | Zero Catalog, Marketplace, or Order checkout code | Strictly Pricing Engine Foundation only | **PASS** |

---

## File System Inventory (Stage 5 Additions)

```text
packages/core/src/domain/pricing/
├── pricing-types.ts (Making charge, margin, tax, and rule configs)
├── pricing-error.ts (Structured Domain errors: stale, unavailable, idor, etc.)
├── pricing-unit-converter.ts (Lossless conversion from Troy Ounce/Mesghal to gram)
├── pricing-rule.ts (PricingRule entity with versioning & time boundaries)
├── pricing-breakdown.ts (PricingBreakdown value object & invariant verification)
├── pricing-result.ts (PricingResult entity with market snapshots)
└── pricing-engine.ts (Pure deterministic calculation engine)
packages/core/src/ports/
├── pricing-rule.repository.port.ts
└── pricing-result.repository.port.ts
packages/database/src/
├── schema/
│   ├── pricing-rules.ts
│   └── pricing-results.ts
├── migrations/
│   └── 0005_authoritative_pricing_engine.sql
├── repositories/
│   ├── drizzle-pricing-rule.repository.ts
│   └── drizzle-pricing-result.repository.ts
└── adapters/
    ├── in-memory-pricing-rule.repository.ts
    └── in-memory-pricing-result.repository.ts
apps/web/
├── lib/pricing/
│   ├── pricing-service.ts
│   └── pricing-container.ts
└── app/api/v1/pricing/
    └── calculate/route.ts
tests/
├── pricing-unit-converter.test.ts
├── pricing-rule.test.ts
├── pricing-engine.test.ts
├── pricing-tenant-isolation.test.ts
├── pricing-persistence-contract.test.ts
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
* [x] Rule versioning and historical reproducibility verified.
* [x] Strict tenant isolation and IDOR protection enforced.
* [x] No catalog, cart, order, or checkout code created.
* [x] Exactly Stage 5 completed.
* [x] Engine stopped awaiting user authorization for Stage 6.
