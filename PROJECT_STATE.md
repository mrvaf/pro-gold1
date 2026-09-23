# V-GOLD Project State Record

---

## Current Execution Summary

* **Project Version:** `0.4.1-alpha`
* **Current Stage:** **Stage 4.1 — Financial Precision & Currency Semantics (Audited & Hardened)**
* **Stage Status:** **COMPLETE & AUDITED**
* **Active Working Branch:** `main`
* **Last Verified Snapshot:** `V-GOLD_STAGE_04_1_FINAL_COMPLETE`
* **Next Target Stage:** **Stage 5 — Authoritative Pricing Engine**
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
| **4.1**| **Financial Precision & Currency Semantics** | **COMPLETE (AUDITED)** | **187 passed / 0 skipped / 0 failed** | **PASS** | **PASS** | Audited precision matrix, audited rounding modes, NUMERIC(32, 16) FX storage, truncation guard, 0004 migration |
| 5 | Authoritative Pricing Engine | PENDING | — | — | — | Awaiting user command |
| 6 | Catalog & Inventory Foundations | PENDING | — | — | — | |
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

## Financial Precision & Rounding Audit Results (Stage 4.1)

### 1. Precision Matrix
| Data Type | Domain Precision | Storage Precision | Presentation Precision | Rounding Boundary | Lossless? |
|---|---|---|---|---|---|
| **Monetary Amount (`Money`)** | Arbitrary (`Decimal.js`) | `NUMERIC(24, 4)` | Minor Units (USD/EUR: 2, IRR/TOMAN: 0) | Presentation / Storage Boundary | Yes (within 4 decimal places) |
| **Market Spot Rate (`MarketPrice`)** | Arbitrary (`Decimal.js`) | `NUMERIC(24, 8)` | 2–4 decimals depending on quote unit | Ingestion & Display Boundary | Yes (within 8 decimal places) |
| **FX Conversion Rate (`FxRate`)** | Arbitrary (`Decimal.js`) | `NUMERIC(32, 16)` | 4–8 decimals | Persistence Boundary | Yes (within 16 decimal places; micro-currencies preserved) |
| **Precious Metal Weight (`Weight`)** | Arbitrary (`Decimal.js`) | `NUMERIC(16, 6)` | 3–4 decimals (grams) / 2 decimals (troy oz) | Physical Scale / Order Boundary | Yes (within 1 microgram) |
| **Gold Purity (`GoldPurity`)** | Arbitrary (`Decimal.js`) | `NUMERIC(6, 4)` | 3–4 decimals (millesimal) / 0–1 decimals (karat) | Catalog Specification Boundary | Yes (within 0.0001 fineness) |

### 2. Rounding Matrix
All financial rounding is executed through `FinancialRoundingPolicy` wrapping exact `Decimal.js` rounding modes. Terminology is audited to eliminate conflation between directionality and ceiling/floor:

| Mode Key | Decimal.js Constant | Mathematical Definition | Positive Midpoint (+1.25 to 1 dec) | Negative Midpoint (-1.25 to 1 dec) | Typical Use Case in V-GOLD |
|---|---|---|---|---|---|
| `HALF_UP` | `ROUND_HALF_UP` (4) | Nearest neighbor; exact midpoints (.5) round away from zero | `+1.3` | `-1.3` | Commercial pricing, consumer quotes, invoices |
| `HALF_EVEN` | `ROUND_HALF_EVEN` (6) | Banker's rounding; exact midpoints round to nearest even digit | `+1.2` (`+1.35` -> `+1.4`) | `-1.2` (`-1.35` -> `-1.4`) | General ledger accounting, statistical aggregations |
| `UP` | `ROUND_UP` (0) | Away from zero (positive increases, negative decreases) | `+1.3` (`+1.21` -> `+1.3`) | `-1.3` (`-1.21` -> `-1.3`) | Conservative fee estimation, buyer-facing tax rounding |
| `DOWN` | `ROUND_DOWN` (1) | Towards zero (truncation) | `+1.2` (`+1.29` -> `+1.2`) | `-1.2` (`-1.29` -> `-1.2`) | Conservative buyer loyalty point earning, payout truncation |
| `CEIL` | `ROUND_CEIL` (2) | Towards $+\infty$ (true mathematical ceiling) | `+1.3` | `-1.2` (`-1.21` -> `-1.2`) | Physical packaging unit allocation |
| `FLOOR` | `ROUND_FLOOR` (3) | Towards $-\infty$ (true mathematical floor) | `+1.2` | `-1.3` (`-1.29` -> `-1.3`) | Minimum guaranteed yield calculations |

### 3. Persistence Contract & Truncation Guard
- Database persistence expanded: `fx_rates.rate` now uses `NUMERIC(32, 16)`.
- Silent database truncation is explicitly prevented via `FinancialRoundingPolicy.assertStorageScale()` and `FinancialRoundingPolicy.fitsStorageScale()`.
- Persistence contract verified in `tests/storage-precision-contract.test.ts`.

---

## Stage 4.1 Completion Gate Audit

| Gate Item | Target Standard | Measured Result | Status |
| :--- | :--- | :--- | :---: |
| **Financial Precision** | Decimal.js for authoritative values (zero `number`, `parseFloat()`, or float math) | Tested in `tests/financial-precision-invariants.test.ts` | **PASS** |
| **Three-Tier Precision** | Calculation (raw) vs Storage (`NUMERIC(32, 16)` / `NUMERIC(24, 8)`) vs Presentation | Tested in `tests/financial-rounding-policy.test.ts` | **PASS** |
| **Rounding Policy** | Explicit rounding modes with audited Decimal.js semantics; zero premature rounding | Tested in `tests/financial-rounding-policy.test.ts` | **PASS** |
| **Storage Contract** | Lossless domain-to-storage-to-domain round-trip, silent truncation prevention | Tested in `tests/storage-precision-contract.test.ts` | **PASS** |
| **Currency Semantics** | `IRR`, `TOMAN`, `USD`, `EUR` with minor units, accounting status, and fiat metadata | Tested in `tests/currency-semantics.test.ts` | **PASS** |
| **Toman/Rial Relationship** | Exact deterministic 1:10 ratio (`IRR_PER_TOMAN = 10`, `TOMAN_PER_IRR = 0.1`) | Tested in `tests/currency-semantics.test.ts` | **PASS** |
| **FX Rate Semantics** | Explicit direction ($1 \text{ base} = \text{rate} \times \text{quote}$), positive non-zero, deterministic inversion | Tested in `tests/fx-rate.test.ts` | **PASS** |
| **Currency Conversion** | `CurrencyConverter.convert()` enforces base match and preserves raw precision | Tested in `tests/currency-conversion.test.ts` | **PASS** |
| **Database Schema** | Drizzle schema for `fx_rates` with `NUMERIC(32, 16)` and unique idempotency constraint | Tested in `tests/database-schema-fx.test.ts` | **PASS** |
| **DDL Migration** | Sequentially numbered `0004_financial_precision_currency_semantics.sql` | Tested in `tests/database-migration-fx.test.ts` | **PASS** |
| **API Endpoints** | `/api/v1/finance/currencies`, `/api/v1/finance/fx-rates` | Implemented and verified in `apps/web` | **PASS** |
| **Boundary Isolation** | `@v-gold/core` has ZERO framework, HTTP, DB, or provider SDK imports | AST file inspection in `tests/architecture.test.ts` | **PASS** |
| **Test Suite** | Vitest monorepo suite executes reliably | **187 passed / 0 skipped / 0 failed** (40 test files) | **PASS** |
| **Typecheck** | TypeScript 5.7+ strict check across all workspaces & tests | **0 errors** | **PASS** |
| **Production Build** | `npm run build` compiles all packages and Next.js web app (12 routes) | **Clean build** | **PASS** |
| **PostgreSQL Integration** | Real database availability check | **NOT AVAILABLE** (PSQL daemon not in sandbox; reported transparently) | **REPORTED** |
| **Real Provider Integration** | External market provider credentials detection | **NOT AVAILABLE** (No external API keys in environment; reported transparently) | **REPORTED** |
| **Stage Confinement** | Zero pricing engine or customer quote logic implemented | Strictly Financial Precision & Currency Semantics only | **PASS** |

---

## File System Inventory (Stage 4.1 Additions)

```text
packages/core/src/domain/finance/
├── currency.ts (enhanced with metadata, fiat, accounting status, and Toman/Rial ratio)
├── rounding-policy.ts (Three-tier precision architecture, precision limits & explicit rounding modes)
├── fx-rate.ts (Directional exchange rate value object with inversion)
└── currency-conversion.ts (Authoritative currency conversion service)
packages/core/src/ports/
└── fx-rate.repository.port.ts
packages/database/src/
├── schema/
│   └── fx-rates.ts (NUMERIC(32, 16))
├── migrations/
│   └── 0004_financial_precision_currency_semantics.sql (NUMERIC(32, 16))
├── repositories/
│   └── drizzle-fx-rate.repository.ts
└── adapters/
    └── in-memory-fx-rate.repository.ts
apps/web/
├── lib/finance/
│   └── finance-container.ts
└── app/api/v1/finance/
    ├── currencies/route.ts
    └── fx-rates/route.ts
tests/
├── currency-semantics.test.ts
├── fx-rate.test.ts
├── currency-conversion.test.ts
├── financial-rounding-policy.test.ts
├── financial-precision-invariants.test.ts
├── storage-precision-contract.test.ts
├── database-schema-fx.test.ts
├── database-migration-fx.test.ts
└── api-finance.test.ts
```

---

## Invariant Adherence Verification

* [x] Every authoritative financial value calculates via Decimal.js.
* [x] No `parseFloat()`, `Math.round()`, or binary float math in authoritative paths.
* [x] Clear codified distinction between `MarketPrice` (quote per mass unit) and `Money` (balance).
* [x] Exact deterministic 1:10 relationship between Iranian Toman and Rial.
* [x] Directional FX rate modeling with arbitrary-precision inversion.
* [x] Three-tier precision architecture: Calculation vs Storage vs Presentation.
* [x] Audited rounding semantics distinguishing away-from-zero/towards-zero from ceiling/floor.
* [x] `NUMERIC(32, 16)` FX rate storage preventing precision collapse on micro-currencies.
* [x] Explicit truncation guard preventing silent database precision loss.
* [x] No pricing engine formulas (labor fee, taxes, margin, quotes) implemented in Stage 4.1.
* [x] Exactly Stage 4.1 audited and finalized.
* [x] Engine stopped awaiting user authorization for Stage 5.
