# V-GOLD Architecture Documentation

---

## 1. Architectural Philosophy & Guiding Principles

The architectural design of **V-GOLD** adheres to **Onion / Clean / Hexagonal Architecture** principles designed around the central mandate:

> **"Simple Outside. Sophisticated Inside."**

### Core Principles
1. **Domain Independence (The Dependency Rule):** Inner layers have zero knowledge of outer layers. Pure business logic in the domain layer has zero dependencies on React, Next.js, HTTP, databases (ORM), browser APIs, or third-party AI provider SDKs.
2. **Authoritative Financial Integrity:** Every monetary calculation (prices, gold valuations, making fees, stone values, discounts, taxes, shipping, payment amounts) and weight computation is executed server-side using arbitrary-precision arithmetic (`Decimal.js`). Floating-point operations (`number`) are strictly prohibited in financial paths.
3. **Truthful Data & Zero Hallucination:**
   - Gold market spot prices are never hallucinated; when live provider connections are unavailable, explicit `UNAVAILABLE` or deterministic `DEV/TEST` states are returned.
   - AI systems can only perform presentation, styling, or generative suggestions grounded strictly in validated domain attributes (e.g. verified 18K purity, verified 5.2g weight).
4. **Strict Multi-Tenant Isolation:** All marketplace, catalog, inventory, order, and seller operations are tenant-scoped (`storeId`). Cross-tenant access is structurally prevented at both repository and database levels.
5. **Mutation Safety & Idempotency:** Sensitive write operations (order placement, payment processing, inventory reservations, AI token consumption) enforce deterministic idempotency keys.

---

## 2. Layered Hexagonal Blueprint

```text
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│          Next.js App Router (React 19, Server/         │
│          Client Components, Persian RTL / En LTR)      │
│          apps/web                                      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Application Layer                    │
│      Controllers / Route Handlers, Zod Validation,     │
│         Use Cases / Application Orchestration          │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                      Domain Layer                      │
│        Entities, Value Objects, Aggregates, Domain     │
│       Events, Pure Pricing Formulas (Decimal.js)       │
│       packages/core                                    │
└───────────────────────────┬────────────────────────────┘
                            │ (Defines Ports / Interfaces)
┌───────────────────────────▼────────────────────────────┐
│                   Infrastructure Layer                 │
│   PostgreSQL Drizzle Repositories & In-Memory Adapters │
│   packages/database                                    │
│   AI Gateway Adapters & Client                         │
│   packages/ai-gateway                                  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Implemented Domain Vocabulary (Stage 2)

### 3.1 Financial Value Objects (`packages/core/src/domain/finance/`)
* **`Currency` (`CurrencyCode`):** Supports `IRR`, `TOMAN`, `USD`, `EUR`. Explicit standard minor units (0 for IRR/TOMAN, 2 for USD/EUR).
* **`Money`:**
  - Encapsulates `amount: Decimal` and `currency: CurrencyCode`.
  - Rejects non-finite/NaN inputs.
  - Operations: `add`, `subtract`, `multiply`, `divide`, `compare`, `equals`, `round`.
  - Enforces strict currency parity on addition, subtraction, and comparison (`CurrencyMismatchError`).
  - Rounding is strictly deterministic and explicit (`round(decimals, mode)`, `roundToStandardMinorUnits()`). Zero silent rounding.

### 3.2 Precious Metal & Mass Value Objects (`packages/core/src/domain/material/`)
* **`GoldPurity`:**
  - Represents gold purity in millesimal fineness (parts per 1000) and karat equivalent.
  - Rejects invalid fineness ($\le 0$ or $> 1000$) and invalid karat ($\le 0$ or $> 24$).
  - Industry presets: `K24` (999.9), `K22` (916.6), `K21` (875), `K18` (750), `K14` (585), `K9` (375).
  - Calculates exact pure gold fraction: $\text{pureGoldFraction} = \text{fineness} / 1000$.
* **`Weight`:**
  - Canonical internal unit: **Grams (g)**.
  - Mass is guaranteed non-negative.
  - Conversions: Milligrams ($1\text{g} = 1000\text{mg}$), Carats ($1\text{ct} = 0.2\text{g}$), Iranian Mesghal ($1\text{mesghal} = 4.6083\text{g}$), Troy Ounces ($1\text{oz t} = 31.1034768\text{g}$).
  - Operations: `add`, `subtract` (rejects negative mass), `multiply`, `round`.

### 3.3 Tenancy & Identity Foundations (`packages/core/src/domain/tenant/`, `identity/`, `product/`, `audit/`)
* **`Tenant`:** Root organizational isolation boundary (`TenantId`). Validates lowercase alphanumeric slugs.
* **`Store`:** Seller organization entity (`StoreId`). Always strictly bound to `tenantId`.
* **`ActorReference`:** Tracks identity of mutating agent (`USER`, `SYSTEM`, `EXTERNAL`) without coupling to concrete auth systems.
* **`AuditMetadata`:** Immutable record of creation/update timestamps and actor references.
* **`JewelryIdentity`:** Foundation identifier (`JewelryId`, SKU, Barcode) for future catalog items.

---

## 4. Persistence & Database Foundations (Stage 2)

* **PostgreSQL + Drizzle ORM:** Database schemas defined in `packages/database/src/schema/`:
  - `tenantsTable`: `id`, `name`, `slug` (unique), `status`, `created_at`, `updated_at`.
  - `storesTable`: `id`, `tenant_id` (FK to `tenants.id` with `ON DELETE CASCADE`), `name`, `code`, `status`, `created_at`, `updated_at`.
  - Indexes: `stores_tenant_id_code_idx` (composite unique index on `(tenant_id, code)`), `stores_tenant_id_idx`.
* **Numbered Migrations:** `packages/database/src/migrations/0001_core_foundation.sql`:
  - Clean, deterministic, idempotent (`IF NOT EXISTS`), reviewable PostgreSQL DDL.
* **Repository Implementations & Boundaries:**
  - `DrizzleTenantRepository` & `DrizzleStoreRepository` implement `TenantRepositoryPort` & `StoreRepositoryPort`.
  - Mappers (`toDomainTenant`, `toDatabaseTenant`, `toDomainStore`, `toDatabaseStore`) convert records to domain entities without leaking Drizzle or database drivers into `@v-gold/core`.
  - `InMemoryTenantRepository` & `InMemoryStoreRepository` enable complete, fast, deterministic testing without requiring an active PostgreSQL instance.

---

## 5. Architectural Decision Records (ADRs)

* **ADR-0001:** Adoption of Hexagonal Architecture & Clean Separation (Implemented in Stage 1)
* **ADR-0002:** Arbitrary-Precision Financial Engine with Decimal.js (Implemented in Stage 1 & 2)
* **ADR-0003:** Dedicated AI Gateway with Factual Grounding (Implemented in Stage 1)
* **ADR-0004:** Multi-Tenant Data Isolation Strategy (Implemented in Stage 1 & 2)
* **ADR-0005:** Idempotency Pattern for All State Mutations (Accepted)
* **ADR-0006:** Sequential Immutable Migrations (Implemented in Stage 2 with `0001_core_foundation.sql`)
* **ADR-0007:** Bilingual Architecture with Native RTL Support (Implemented in Stage 1)
* **ADR-0008:** In-Memory Repository Testing Strategy (Implemented in Stage 1 & 2)
* **ADR-0009:** Separation of Custom Manufacturing (RFQ) from Standard Commerce (Accepted)
* **ADR-0010:** Digital Jewelry Passport & Style DNA Extensibility (Accepted)

### ADR-0011: Canonical Grams and Millesimal Fineness for Precious Metal Primitives
* **Status:** Accepted (Stage 2)
* **Context:** The gold and jewelry market uses diverse historical and international mass units (grams, carats, mesghals, troy ounces) and purity systems (karat vs fineness). Inconsistent internal representations lead to rounding drift and pricing errors.
* **Decision:**
  - Canonical internal mass unit is strictly **Grams (g)** stored as arbitrary-precision `Decimal`. Conversion to milligrams, carats, mesghals, and ounces is computed via exact mathematical constants.
  - Gold purity is canonicalized as millesimal fineness (parts per 1000) alongside standard karat definitions. Karat is computed as $(\text{Fineness} / 1000) \times 24$.

### ADR-0012: Drizzle ORM Schema Separation and Record-to-Entity Mappers
* **Status:** Accepted (Stage 2)
* **Context:** Domain entities must not be annotated with ORM decorators or coupled to SQL column types. Direct Drizzle entity exposure violates domain independence.
* **Decision:** Drizzle table schemas (`tenantsTable`, `storesTable`) reside strictly in `packages/database`. Repositories map Drizzle `$inferSelect` records to pure domain entities using deterministic mapper functions.

---

## 6. What Stage 2 Intentionally Does NOT Implement

In strict adherence to the **ONE STAGE AT A TIME** principle:
* **No Authentication / IAM:** Login, password hashing, JWTs, sessions, RBAC roles (scheduled for Stage 3).
* **No Market Data:** Live gold feeds, spot price fetchers, caching (scheduled for Stage 4).
* **No Pricing Engine:** Product pricing formulas, VAT calculations, maker fee computations (scheduled for Stage 5).
* **No Catalog / Products:** Product browsing, category trees, product variants (scheduled for Stage 6).
* **No Commerce / Orders:** Carts, payments, checkout flows (scheduled for Stage 17).
