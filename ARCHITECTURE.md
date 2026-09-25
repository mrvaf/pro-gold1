# V-GOLD Architecture Documentation

---

## 1. Architectural Philosophy & Guiding Principles

The architectural design of **V-GOLD** adheres to **Onion / Clean / Hexagonal Architecture** principles designed around the central mandate:

> **"Simple Outside. Sophisticated Inside."**

### Core Principles
1. **Domain Independence (The Dependency Rule):** Inner layers have zero knowledge of outer layers. Pure business logic in the domain layer has zero dependencies on React, Next.js, HTTP, cookies, databases (ORM), browser APIs, or third-party AI/market provider SDKs.
2. **Authoritative Financial Integrity:** Every monetary calculation (prices, gold valuations, making fees, stone values, discounts, taxes, shipping, payment amounts) and weight computation is executed server-side using arbitrary-precision arithmetic (`Decimal.js`). Floating-point operations (`number`) are strictly prohibited in financial paths.
3. **Truthful Data & Zero Hallucination:**
   - Gold market spot prices are never hallucinated; when live provider connections are unavailable, explicit `UNAVAILABLE` or deterministic `DEV/TEST` states are returned.
   - Market data answers: *"What is the externally observed market data?"*
   - Pricing engine (Stage 5) answers: *"How does V-GOLD calculate a product/customer price from market data?"*
   - AI systems can only perform presentation, styling, or generative suggestions grounded strictly in validated domain attributes (e.g. verified 18K purity, verified 5.2g weight).
4. **Strict Multi-Tenant Isolation:** All marketplace, catalog, inventory, order, and seller operations are tenant-scoped (`storeId`, `tenantId`). Cross-tenant access is structurally prevented at both repository, database, and IAM membership levels.
5. **Mutation Safety & Idempotency:** Sensitive write operations (order placement, payment processing, inventory reservations, market data ingestion, FX persistence) enforce deterministic idempotency.

---

## 2. Layered Hexagonal Blueprint

```text
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│          Next.js App Router (React 19, Server/         │
│          Client Components, Persian RTL / En LTR)      │
│          apps/web (api/v1/auth/..., api/v1/market-data)│
│          api/v1/finance/...                            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Application Layer                    │
│      AuthService, MarketDataQueryService,              │
│      MarketDataIngestionService, FreshnessPolicy,      │
│      FinancialRoundingPolicy, CurrencyConverter        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                      Domain Layer                      │
│        Entities (User, TenantMembership, Session,      │
│        MarketDataSource, MarketInstrument,             │
│        MarketObservation),                             │
│        Value Objects (Email, PasswordHash, Money,      │
│        MarketPrice, FxRate, GoldPurity, Weight)        │
│        packages/core                                   │
└───────────────────────────┬────────────────────────────┘
                            │ (Defines Ports / Interfaces)
┌───────────────────────────▼────────────────────────────┐
│                   Infrastructure Layer                 │
│   PostgreSQL Drizzle Repositories & In-Memory Adapters │
│   packages/database (ScryptPasswordHasher, Providers)  │
│   AI Gateway Adapters & Client                         │
│   packages/ai-gateway                                  │
└────────────────────────────────────────────────────────┘
```

---

## 3. IAM & Multi-Tenancy Architecture (Stage 3 Implemented)

### 3.1 Domain Models (`packages/core/src/domain/iam/`)
* **`Email`:** Value object enforcing lowercase normalization, whitespace rejection, and RFC-compliant format. Max length 255 chars, local part max 64 chars.
* **`PasswordHash`:** Value object encapsulating cryptographic hash output. Redacts plaintext from `toString()` to prevent log leakage.
* **`User`:** Entity (`UserId`). Features `updateDisplayName`, `changePassword`, `suspend`, `activate`. Generates safe `UserDto` which strictly omits `passwordHash`.
* **`TenantMembership`:** Entity (`MembershipId`) associating a `UserId` with a `TenantId` under an explicit `Role` (`OWNER`, `ADMIN`, `MEMBER`).
* **`Permissions`:** Domain permissions (`tenant.read`, `tenant.update`, `tenant.members.read`, `tenant.members.manage`). Role-to-permission resolution:
  - `OWNER`: All 4 permissions
  - `ADMIN`: `tenant.read`, `tenant.members.read`, `tenant.members.manage`
  - `MEMBER`: `tenant.read`
* **`Session`:** Entity (`SessionId`) tracking authenticated server sessions. Features `isValid()`, `isExpired()`, `isRevoked()`, `revoke()`, and `recordActivity()`.
* **`AuthorizationService`:** Centralized domain service evaluating `can(userId, tenantId, permission)`. Verifies active membership in the target tenant before granting any permission.

### 3.2 Password & Cookie Security
* **Password Hashing:** `ScryptPasswordHasher` implements `PasswordHasherPort` using Node's native `crypto.scrypt` with a 16-byte random salt and `crypto.timingSafeEqual` to prevent timing attacks. Password policy mandates 8 to 128 characters.
* **Session Storage & Cookies:** Zero client-side token storage (no tokens or JWTs in `localStorage` or `sessionStorage`). Sessions are referenced via a cryptographically random 64-character hex token set in a server-side cookie:
  - Name: `vgold_session`
  - `HttpOnly: true`
  - `Secure: process.env.NODE_ENV === 'production'`
  - `SameSite: 'lax'`
  - `Path: '/'`
  - `MaxAge: 7 days`

---

## 4. Market Data Infrastructure Architecture (Stage 4 Implemented)

### 4.1 Responsibility Boundary
Market Data Infrastructure strictly answers: *"What is the externally observed market data?"*
It is completely decoupled from the Stage 5 Pricing Engine, which later answers: *"How does V-GOLD calculate customer jewelry prices from market data?"*

### 4.2 Core Primitives & Invariants (`packages/core/src/domain/market-data/`)
* **`MarketDataSource`:** Explicit external provider identity (e.g., `NASDAQ_FEED`, `TGJU`, `LBMA`).
* **`MarketInstrument`:** Extensible instrument definitions (`XAU/USD`, `XAU/EUR`, `XAU/IRR`, `XAG/USD`). Uniquely distinguishes base metal asset (`XAU`), quote currency (`USD`), market trading unit (`TROY_OUNCE` vs `GRAM` vs `MESGHAL`), and asset type (`PRECIOUS_METAL`).
* **`MarketPrice`:** Authoritative value object encapsulating exact `Decimal.js` numeric rates, quote currency, trading unit, bid, ask, and calculated spread (`ask - bid`). Strictly validates finite, non-negative numbers and enforces `bid <= ask`.
* **`MarketObservation`:** Immutable entity recording an external market observation.
  - Distinct Timestamps: `observedAt` (when the source recorded the rate) and `ingestedAt` (when V-GOLD persisted it). Overwriting `observedAt` is prohibited.
  - Rejection of future dates (>5 minutes clock skew).
  - Safe DTO projection serializing numbers to exact strings.
* **`MarketDataFreshnessPolicy`:** Centralized evaluation of observation age:
  - `FRESH`: Within acceptable threshold (default: 5 minutes for real-time rates, 30 minutes for delayed, 24 hours for daily close).
  - `STALE`: Observation age exceeds threshold.
  - `UNAVAILABLE`: No observation exists or provider offline.

---

## 5. Financial Precision & Currency Semantics Architecture (Stage 4.1 Implemented)

### 5.1 Three-Tier Precision Architecture
V-GOLD explicitly separates precision concerns into three non-interchangeable tiers:
1. **Calculation Precision:** Internal computations execute in arbitrary precision via `Decimal.js` (default: 28+ significant digits). Intermediate operations must **never be prematurely rounded**.
2. **Storage Precision:** Database persistence in PostgreSQL uses explicit scale boundaries per data type:
   - `NUMERIC(32, 16)` for FX rates (accommodates micro-currency inverse rates like `IRR/USD`).
   - `NUMERIC(24, 8)` for market spot prices and unit rates.
   - `NUMERIC(24, 4)` for monetary amounts and transaction balances.
   Values exceeding the target column scale must never be silently truncated; explicit scale validation (`FinancialRoundingPolicy.assertStorageScale()`) or rounding (`prepareForStorage()`) is enforced before persistence.
3. **Presentation Precision:** Final rounding occurs solely at the presentation boundary, formatted according to currency minor units (e.g. 2 decimal places for USD/EUR, 0 decimal places for IRR/TOMAN) using deterministic rounding modes.

### 5.2 Precision Matrix
| Data Type | Domain Precision | Storage Precision | Presentation Precision | Rounding Boundary | Lossless? |
|---|---|---|---|---|---|
| **Monetary Amount (`Money`)** | Arbitrary (`Decimal.js`) | `NUMERIC(24, 4)` | Currency Minor Units (USD/EUR: 2, IRR/TOMAN: 0) | Presentation / Storage Boundary | Yes (within 4 decimal places) |
| **Market Spot Rate (`MarketPrice`)** | Arbitrary (`Decimal.js`) | `NUMERIC(24, 8)` | 2–4 decimals depending on quote unit | Ingestion & Display Boundary | Yes (within 8 decimal places) |
| **FX Conversion Rate (`FxRate`)** | Arbitrary (`Decimal.js`) | `NUMERIC(32, 16)` | 4–8 decimals | Persistence Boundary | Yes (within 16 decimal places; micro-currencies preserved) |
| **Precious Metal Weight (`Weight`)** | Arbitrary (`Decimal.js`) | `NUMERIC(16, 6)` | 3–4 decimals (grams) / 2 decimals (troy oz) | Physical Scale / Order Boundary | Yes (within 1 microgram) |
| **Gold Purity (`GoldPurity`)** | Arbitrary (`Decimal.js`) | `NUMERIC(6, 4)` | 3–4 decimals (millesimal) / 0–1 decimals (karat) | Catalog Specification Boundary | Yes (within 0.0001 fineness) |

### 5.3 Rounding Matrix & Detailed Semantics
All financial rounding is executed through `FinancialRoundingPolicy` wrapping exact `Decimal.js` rounding modes. Terminology is audited to eliminate conflation between directionality and ceiling/floor:

| Mode Key | Decimal.js Constant | Mathematical Definition | Positive Midpoint (+1.25 to 1 dec) | Negative Midpoint (-1.25 to 1 dec) | Typical Use Case in V-GOLD |
|---|---|---|---|---|---|
| `HALF_UP` | `ROUND_HALF_UP` (4) | Nearest neighbor; exact midpoints (.5) round away from zero | `+1.3` | `-1.3` | Commercial pricing, consumer quotes, invoices |
| `HALF_EVEN` | `ROUND_HALF_EVEN` (6) | Banker's rounding; exact midpoints round to nearest even digit | `+1.2` (`+1.35` -> `+1.4`) | `-1.2` (`-1.35` -> `-1.4`) | General ledger accounting, statistical aggregations |
| `UP` | `ROUND_UP` (0) | Away from zero (positive increases, negative decreases) | `+1.3` (`+1.21` -> `+1.3`) | `-1.3` (`-1.21` -> `-1.3`) | Conservative fee estimation, buyer-facing tax rounding |
| `DOWN` | `ROUND_DOWN` (1) | Towards zero (truncation) | `+1.2` (`+1.29` -> `+1.2`) | `-1.2` (`-1.29` -> `-1.2`) | Conservative buyer loyalty point earning, payout truncation |
| `CEIL` | `ROUND_CEIL` (2) | Towards $+\infty$ (true mathematical ceiling) | `+1.3` | `-1.2` (`-1.21` -> `-1.2`) | Physical packaging unit allocation |
| `FLOOR` | `ROUND_FLOOR` (3) | Towards $-\infty$ (true mathematical floor) | `+1.2` | `-1.3` (`-1.29` -> `-1.3`) | Minimum guaranteed yield calculations |

### 5.4 Mathematical Invariants & Precision Boundaries
* **Addition / Subtraction:** Associativity $(A + B) + C = A + (B + C)$ and Commutativity $A + B = B + A$ are exact mathematical identities in unrounded `Decimal.js` arithmetic. Zero binary floating-point drift over $50,000+$ cumulative iterations.
* **Toman / Rial Conversion:** The $10:1$ ratio is an exact integer ratio ($1 \text{ TOMAN} = 10 \text{ IRR}$). Conversions between integer Rials and Tomans are mathematically lossless and drift-free.
* **Division & FX Round-Trip Boundaries:** In base-10 decimal arithmetic, fractions with non-terminating expansions (e.g. $1/3$, $1/7$, or reciprocal FX rates like $1 / 0.9 = 1.1111...$) cannot be represented in finite decimals. In V-GOLD, division and FX round-trips ($M \to A \to B \to A \to M$) are finite-precision approximations bounded by calculation precision:
  $$|\Delta_{\text{round-trip}}| \le 10^{-18}$$
  V-GOLD does **not** claim infinite precision for repeating decimals; numerical stability and error bounds are explicitly documented, tested, and guarded.

### 5.5 Currency Semantics & The Toman/Rial Relationship
* **Statutory Currency (`IRR`):** Official legal and banking currency of Iran. 0 standard minor units.
* **Commercial Currency (`TOMAN`):** Commercial unit of account widely used in jewelry bazaars. 0 standard minor units.
* **Deterministic Conversion Ratio:**
  $$\text{1 Toman} = 10 \text{ Iranian Rials (Exact Decimal)}$$
  Codified in `IRR_PER_TOMAN = new Decimal(10)` and `TOMAN_PER_IRR = new Decimal(0.1)`. Conversions are executed via dedicated domain primitives `CurrencyConverter.tomanToIrr()` and `CurrencyConverter.irrToToman()`.
* **International Currencies (`USD`, `EUR`):** Fiat reference currencies with 2 standard minor units (cents).

### 5.6 Directional Foreign Exchange (FX) Rates
* **`FxRate`:** Directional value object representing:
  $$1 \text{ baseCurrency} = \text{rate} \times \text{quoteCurrency}$$
  Enforces `rate > 0` and `baseCurrency !== quoteCurrency`.
* **Inversion:** Deterministically generates the reciprocal rate:
  $$\text{inverseRate} = \frac{1}{\text{rate}}$$
  Calculated with high Decimal precision without IEEE-754 binary floating-point pollution.
* **`CurrencyConverter`:** Converts `Money` amounts across currencies via `Money(base) * FxRate(base -> quote) = Money(quote)`. Verifies base currency parity and preserves raw intermediate decimals.

### 5.7 Distinction between `MarketPrice` and `Money`
* **`MarketPrice`:** Represents an *external commodity quote per unit of mass* (e.g. $2650.50 \text{ USD} / \text{troy ounce}$ or $54,000,000 \text{ IRR} / \text{gram}$). It encapsulates a trading unit (`MarketUnitCode`).
* **`Money`:** Represents a *discrete monetary value or transaction balance* ($\text{amount} + \text{currency}$). It does not represent a unit price or physical mass.

---

## 6. Authoritative Pricing Engine Architecture (Stage 5 Implemented)

### 6.1 Guiding Mandates
The **Authoritative Pricing Engine** is designed to provide fully deterministic, explainable, auditable, and mathematically invariant jewelry and precious metals pricing. It produces structured calculations rather than opaque numbers:

```text
PricingBreakdown
├── Base Metal Value (pure gold mass × spot rate per canonical gram)
├── Making Charge (ojrat: percentage, per-gram, or fixed)
├── Seller Margin (sood: percentage on metal + ojrat, or fixed)
├── Stone / Component Value (optional discrete gemstones)
├── Subtotal
├── Statutory Tax / VAT (Iranian rule: tax on ojrat+margin only; International: total VAT)
├── Unrounded Total (exact arbitrary-precision sum)
├── Rounding Adjustment (difference to presentation minor units)
└── Final Price (authoritative rounded Money balance)
```

### 6.2 The Precious Metal Pricing Formula
1. **Canonical Price Per Gram Conversion:**
   External spot prices are quoted in various units (`TROY_OUNCE`, `MESGHAL`, `GRAM`, `KILOGRAM`, `TOLA`). The engine converts the rate to a pure gram base:
   $$\text{ratePerGram} = \frac{\text{marketPrice.amount}}{\text{gramsPerUnit}}$$
   Using exact constants (e.g., $1\text{ troy ounce} = 31.1034768\text{ g}$, $1\text{ mesghal} = 4.6083\text{ g}$).
2. **Pure Metal Content:**
   $$\text{pureGrams} = \text{weight.grams} \times \left(\frac{\text{purity.fineness}}{1000}\right)$$
3. **Base Metal Value:**
   $$\text{baseMetalValue} = \text{pureGrams} \times \text{ratePerGram}$$
4. **Making Charge ($\text{Ojrat}$):**
   - `PERCENTAGE`: $\text{baseMetalValue} \times \text{rate}$
   - `PER_GRAM`: $\text{weight.grams} \times \text{rate}$
   - `FIXED`: Flat fee in target currency
   - `ZERO`: Raw bullion melt ($\text{Abshodeh}$)
5. **Seller Margin ($\text{Sood}$):**
   - `PERCENTAGE`: $(\text{baseMetalValue} + \text{makingCharge}) \times \text{marginRate}$
   - `FIXED`: Flat fee in target currency
   - `ZERO`: Wholesale / raw bullion
6. **Statutory Tax / VAT ($\text{Maliat}$):**
   - `MARGIN_AND_FEE_ONLY` (Iranian statutory gold reform 1400):
     $$\text{taxableAmount} = \text{makingCharge} + \text{sellerMargin}$$
     $$\text{taxAmount} = \text{taxableAmount} \times \text{taxRate}$$
     *Raw gold base is completely exempt from VAT.*
   - `TOTAL_VALUE` (International luxury retail):
     $$\text{taxAmount} = \text{subtotal} \times \text{taxRate}$$
   - `EXEMPT`: Zero tax.
7. **Presentation Rounding & Invariant:**
   $$\text{finalAmount} = \text{round}(\text{unroundedTotal}, \text{scale}, \text{mode})$$
   $$\text{roundingAdjustment} = \text{finalAmount} - \text{unroundedTotal}$$
   **Strict Mathematical Invariant:**
   $$\sum_{i} \text{lineItem}_{i} = \text{finalAmount}$$

### 6.3 Market Data Freshness Policy Integration
- `FRESH`: Observation is evaluated immediately.
- `STALE`: If `allowStaleMarketData = false`, calculation fails with `MARKET_DATA_STALE`. If allowed, calculation proceeds and flags `isStaleMarketData = true` in `PricingResult`.
- `UNAVAILABLE`: Calculation strictly rejected with `MARKET_DATA_UNAVAILABLE`. No synthetic or hallucinated prices.

### 6.4 Rule Versioning, Immutability & Historical Reproducibility
* **Snapshot of Applied Configuration:** `PricingResult` does not merely record a `ruleId` and `ruleVersion`; it snapshots the entire `effectiveConfig` (making charge type/rate, margin type/rate, tax base/rate, rounding mode/scale), `isReferenceSample` status, and `specificationSource`. If a rule entity in the database is subsequently modified, deactivated, or deleted, historical quotes remain 100% reproducible and auditable from their own immutable record.
* **Prohibition of Silent Commercial Defaults:** If an API client or tenant requests a quote without specifying a `ruleId`, and no explicit authoritative rule has been configured for that tenant, the engine strictly rejects the request with `EXPLICIT_RULE_REQUIRED`. The system never picks a "default" rule with undocumented commercial percentages.

### 6.5 Segregation of Authoritative Rules vs. Reference Samples
* **Reference / Sample Rules:** Rules used for demonstrations, benchmarks, or unit tests are explicitly tagged with `isReferenceSample: true` and `specificationSource: 'REFERENCE_SAMPLE_NON_AUTHORITATIVE'`. The repository method `findEffective()` excludes reference sample rules by default (`includeReferenceSamples: false`). They can only be executed when their explicit `ruleId` is supplied in test/sample contexts.
* **Authoritative Rules:** Configured by an authenticated tenant or authorized platform administrator with explicit specification sources (e.g. signed store agreements or statutory mandates).

### 6.6 Separation of Precious Metal Mass and Gemstone Carats
* **Gold Body Mass:** Precious metal bulk mass is strictly measured and accepted in `grams`, `mesghal`, or `troyOunces`.
* **Gemstone Carats:** Carats ($1\text{ ct} = 0.2\text{ g}$) are strictly reserved for gemstone components and must never be accepted as the gold body mass. Any attempt to supply `carats` as the metal body weight is rejected with `INVALID_WEIGHT`.
* **Gemstone Valuation:** Stage 5 implements pure monetary aggregation (`stoneValue` passthrough). Automated gemstone valuation (4Cs appraisal, Rapaport diamond lists) is **NOT IMPLEMENTED** in Stage 5.

### 6.7 Explicitly Unimplemented Specifications (Stage Confinement)
- Dynamic multi-seller RFQ reverse bidding: **NOT IMPLEMENTED — specification not defined**.
- 4Cs Diamond Rapaport pricing matrix: **NOT IMPLEMENTED — specification not defined**.
- Customer coupon / loyalty discount stacking: **NOT IMPLEMENTED (deferred to Stage 17)**.
- Order checkout and payment gateway execution: **NOT IMPLEMENTED (deferred to Stage 17)**.

---

## 7. Catalog & Inventory Foundations Architecture (Stage 6)

### 7.1 Decoupling of Commercial Catalog from Physical Inventory
* **Catalog Layer (Commercial Concept):**
  - `Product`: High-level commercial model (e.g., "18K Classic Solitaire Ring Model A"). Represents catalog metadata, branding, and jewelry category.
  - `ProductVariant`: Concrete specification variant (e.g., "18K / Size 54 / 6.0g net gold / 1.0ct G-VS1 diamond") with its own immutable, tenant-scoped `SKU`.
  - **Financial Separation:** Neither `Product` nor `ProductVariant` performs price calculations. Authoritative pricing is exclusively calculated on demand by the **Stage 5 Pricing Engine**. Variants may store a non-authoritative reference (`pricingRuleId`) pointing to an effective pricing rule.
* **Inventory Layer (Physical Asset Tracking):**
  - `InventoryItem`: Represents a discrete, serialized, physical piece of precious jewelry stored in an inventory location. Holds physical mass (`grossWeight`, `goldWeight`, `purity`), serial number, barcode, and status.
  - `InventoryLocation`: Tenant-scoped physical or digital storage area (e.g. `MAIN_VAULT`, `SHOWROOM_DISPLAY`, `WORKSHOP`). Code uniqueness is enforced per tenant (`tenantId + code`).

### 7.2 SKU Semantics & Tenant-Scoped Uniqueness
* **Format:** Strict regex validation `^[A-Z0-9_-]{3,64}$` guarantees consistency across barcode scanners and inventory ERP systems.
* **Uniqueness:** Scoped strictly to `tenantId`. Two distinct tenants can independently utilize identical internal SKU formats without collision.
* **Deterministic Generation:** A deterministic helper `SKU.generate({ prefix, productType, purityKarat, serialOrCode })` ensures standard SKU conventions.

### 7.3 Material and Physical Jewelry Invariants
* **Precious Metal Purity & Mass:** Reuses `GoldPurity` and canonical `Weight` (in grams). Pure gold content is calculated as $\text{netGoldWeight} \times \text{pureGoldFraction}$.
* **Gemstone Carat Segregation:** `GemstoneCaratWeight` is strictly dedicated to gemstone mass ($1\text{ ct} = 0.200\text{ g}$). The domain model prohibits treating gemstone carats as precious metal bulk mass.
* **Physical Weight Invariant:**
  $$\text{grossWeight} \ge \text{netGoldWeight} + \sum \text{gemstonePhysicalMass}$$
  Intake or variant creation is rejected if the physical mass arithmetic is violated.

### 7.4 Finite Inventory State Machine
* **Statuses:** `AVAILABLE`, `RESERVED`, `SOLD`, `DAMAGED`, `LOST`, `IN_TRANSIT`.
* **State Transition Invariants:**
  - `SOLD -> AVAILABLE` is forbidden without an explicit `returnFromSold` return workflow with a documented business reason.
  - `LOST -> SOLD` is strictly forbidden. A lost piece must be formally recovered into inventory (`recoverLost`) before it can be assigned or sold.
  - Redundant or undefined transitions are rejected with `BusinessRuleViolationError`.

### 7.5 Immutable Append-Only Movements Audit Trail
* Every inventory mutation (intake, transfer, reservation, release, sale, return, loss, recovery) generates an immutable `InventoryMovement` record.
* No `UPDATE` or `DELETE` operations exist on `inventory_movements`. The history is an append-only verifiable audit trail.

### 7.6 Foundation for Future Digital Jewelry Passport
* `InventoryItem` carries a stable `passportRef` and derives a foundational `JewelryIdentity` (Stage 2).
* QR code generation, blockchain anchors, and public provenance verification remain deferred to future stages (zero fake features).

---

## 8. Architectural Decision Records (ADRs)

* **ADR-0001:** Adoption of Hexagonal Architecture & Clean Separation (Stage 1)
* **ADR-0002:** Arbitrary-Precision Financial Engine with Decimal.js (Stage 1 & 2)
* **ADR-0003:** Dedicated AI Gateway with Factual Grounding (Stage 1)
* **ADR-0004:** Multi-Tenant Data Isolation Strategy (Stage 1, 2, 3)
* **ADR-0005:** Idempotency Pattern for All State Mutations (Accepted)
* **ADR-0006:** Sequential Immutable Migrations (Stage 2: `0001`, Stage 3: `0002`, Stage 4: `0003`, Stage 4.1: `0004`, Stage 5: `0005`, Stage 5 Audit: `0006`, Stage 6: `0007`)
* **ADR-0007:** Bilingual Architecture with Native RTL Support (Stage 1)
* **ADR-0008:** In-Memory Repository Testing Strategy (Stage 1, 2, 3, 4, 4.1, 5, 6)
* **ADR-0009:** Separation of Custom Manufacturing (RFQ) from Standard Commerce (Accepted)
* **ADR-0010:** Digital Jewelry Passport & Style DNA Extensibility (Accepted)
* **ADR-0011:** Canonical Grams and Millesimal Fineness for Precious Metal Primitives (Stage 2)
* **ADR-0012:** Drizzle ORM Schema Separation and Record-to-Entity Mappers (Stage 2)
* **ADR-0013:** Scrypt Key Derivation Function for Password Security (Stage 3)
* **ADR-0014:** Server-Side State-Backed Sessions with HttpOnly SameSite Cookies (Stage 3)
* **ADR-0015:** Tenant-Scoped Role Assignment and Centralized Domain Authorization (Stage 3)
* **ADR-0016:** Market Data Provider Abstraction & Capability Model (Stage 4)
* **ADR-0017:** Append-Only Immutable Market Observation History & Idempotency (Stage 4)
* **ADR-0018:** Strict Freshness Policy and Truthful Unavailable States (Stage 4)
* **ADR-0019:** Arbitrary Decimal Precision and Unit Semantics for Precious Metals (Stage 4)
* **ADR-0020:** Three-Tier Financial Precision Architecture and Explicit Rounding Policy (Stage 4.1)
* **ADR-0021:** Directional Foreign Exchange (FX) Rate Modeling and Deterministic Inversion (Stage 4.1)
* **ADR-0022:** Statutory Iranian Toman vs Rial 1:10 Deterministic Conversion (Stage 4.1)
* **ADR-0023:** Explainable Calculation Breakdown & Line Item Mathematical Invariant (Stage 5)
* **ADR-0024:** Iranian Statutory Gold VAT Reform Compliance (VAT on Labor and Margin Only) (Stage 5)
* **ADR-0025:** Unit-Aware Canonical Spot Rate Normalization (Stage 5)
* **ADR-0026:** Strict Segregation of Reference Rules and Prohibition of Silent Commercial Defaults (Stage 5 Audit)

### ADR-0027: Decoupling of Catalog Specifications from Discrete Inventory Items
* **Status:** Accepted (Stage 6)
* **Context:** In physical jewelry commerce, a product model or specification (e.g. 18K gold ring with specific band profile) exists independently of physical serialized stock pieces on hand. Conflating catalog with inventory causes duplicate catalog entries, corrupted weight records, and inability to track individual serialized pieces across vaults.
* **Decision:** Strictly split the model into `Product` -> `ProductVariant` (Catalog domain) and `InventoryItem` -> `InventoryLocation` (Inventory domain). Catalog defines specifications; Inventory tracks discrete physical pieces and locations.

### ADR-0028: Tenant-Scoped SKU Semantics and Validation Invariants
* **Status:** Accepted (Stage 6)
* **Context:** Merchants utilize heterogeneous SKU formats. Global SKU uniqueness would lead to cross-tenant naming collisions and information leakage.
* **Decision:** Enforce SKU uniqueness strictly at the tenant level via composite database constraints `(tenant_id, sku)`. Validate SKU format as non-empty uppercase alphanumeric string with hyphens or underscores (3 to 64 characters).

### ADR-0029: Finite Inventory State Machine and Append-Only Movement Audit Log
* **Status:** Accepted (Stage 6)
* **Context:** Physical gold pieces are high-value assets requiring regulatory and audit tracking. In-place state overwrites without audit logs allow inventory shrinkage, silent status changes, and unauthorized stock reversions.
* **Decision:** Implement `InventoryStateMachine` enforcing legal lifecycle transitions. Require explicit documented return workflows for reverting `SOLD` items. Disallow direct sale of `LOST` items. Record every mutation atomically as an immutable, append-only `InventoryMovement`.

### ADR-0030: Physical Jewelry Mass Invariants and Non-Interchangeable Gemstone Carat Semantics
* **Status:** Accepted (Stage 6)
* **Context:** Conflating gemstone carats with gold weight leads to severe financial calculation errors. Physically impossible items (gross weight less than net gold or gemstone mass) corrupt valuation.
* **Decision:** Introduce dedicated `GemstoneCaratWeight` distinct from precious metal `Weight`. Enforce physical validation: $\text{grossWeight} \ge \text{netGoldWeight} + \sum \text{gemstoneWeight}$. Prohibit accepting carats as precious metal weight. Ensure exact physical calculation without arbitrary tolerance subtractions using `WEIGHT_CONVERSION_CONSTANTS.CARATS_PER_GRAM`.

### ADR-0031: Multi-Tenant Store Ownership Verification and Composite Foreign Keys
* **Status:** Accepted (Stage 6 Audit)
* **Context:** A merchant tenant operating multiple physical retail branches or vaults may inadvertently reference a store or location ID belonging to another tenant if only single-column foreign keys `(store_id)` are enforced.
* **Decision:** Enforce tenant ownership validation at application service boundaries (`CatalogService`, `InventoryService`) via `StoreRepositoryPort`. At the PostgreSQL schema level (additive migration `0008_catalog_inventory_integrity.sql`), introduce composite unique constraint `UNIQUE ("id", "tenant_id")` on `stores` and enforce composite foreign keys `FOREIGN KEY ("store_id", "tenant_id") REFERENCES "stores"("id", "tenant_id")` across `products`, `inventory_locations`, and `inventory_items`.

### ADR-0032: Inventory Unit of Work for Atomically Consistent Item and Movement Persistence
* **Status:** Accepted (Stage 6 Audit)
* **Context:** In physical jewelry operations, an intake or lifecycle state transition involves mutating an `InventoryItem` and recording an `InventoryMovement` audit record. Independent calls to `itemRepo.save(item)` and `movementRepo.record(movement)` permit split-brain failure scenarios where an item is saved or updated but movement creation fails, creating un-audited inventory states.
* **Decision:** Introduce domain-agnostic `InventoryUnitOfWorkPort` with `saveItemWithMovement(item, movement)`. Implement `DrizzleInventoryUnitOfWork` executing both writes within a single PostgreSQL ACID transaction (`db.transaction`). Implement `InMemoryInventoryUnitOfWork` providing atomic rollback and failure-injection test hooks for unit and contract testing.

### ADR-0033: Authoritative ProductVariant SKU Snapshot in Physical Inventory Pieces
* **Status:** Accepted (Stage 6 Audit)
* **Context:** An inventory item physically represents a discrete unit of a `ProductVariant`. Allowing the caller to provide an arbitrary, unvalidated SKU during intake risks SKU drift between the catalog variant and the physical stock piece.
* **Decision:** Designate `variant.sku` as the single authoritative source of truth (Option A - Derived Snapshot). When intaking an item, the SKU is authoritatively derived from the linked `ProductVariant`. If the caller optionally supplies a SKU, the service verifies that it strictly matches `variant.sku` and rejects any mismatch with `ValidationError`.

### ADR-0034: Global Marketplace Slug Uniqueness with URL-Safe Normalization
* **Status:** Accepted (Stage 7)
* **Context:** In a shared public marketplace storefront (`marketplace.v-gold.com/sellers/:slug`), seller identity routing requires unique, deterministic slugs. Tenant-scoped slugs would cause collision on public discovery URLs across distinct merchants sharing the marketplace domain.
* **Decision:** Enforce global uniqueness on `SellerSlug` across all seller marketplace presences (`UNIQUE ("slug")` in migration `0009_seller_marketplace_foundation.sql`). Validate slug format strictly with `/^[a-z0-9]+(-[a-z0-9]+)*$/` (3–64 characters), trim and normalize to lowercase, and reject reserved platform routes (`admin`, `api`, `auth`, `marketplace`, `login`, `checkout`, etc.).
* **Architectural Scope Note:** This is an explicit marketplace URL architecture decision, not a statutory or externally mandated business rule. In single-tenant white-label deployments, slugs could be scoped per tenant (`tenant_id, slug`), but for a unified precious metals marketplace, global uniqueness provides direct, collision-free vanity storefront URLs.

### ADR-0035: Decoupled Seller Listings with Cross-Tenant Catalog Ownership Invariants
* **Status:** Accepted (Stage 7)
* **Context:** A seller offering products on the marketplace should not duplicate catalog entities into `MarketplaceProduct` or duplicate inventory pieces into `MarketplaceInventory`. Conflating these leads to desynchronized specifications and orphaned stock. Furthermore, listings must never be permitted to reference products or variants belonging to a different tenant or link a variant to the wrong parent product.
* **Decision:** Introduce `SellerListing` as a commercial offer entity linking `SellerProfile` to the tenant's existing `Product` and `ProductVariant`. Enforce that `listing.tenantId === seller.tenantId === product.tenantId === variant.tenantId` and `listing.productId === variant.productId`. Enforce at the PostgreSQL schema level via composite foreign keys:
  - `FOREIGN KEY ("seller_profile_id", "tenant_id") REFERENCES "seller_profiles"("id", "tenant_id")`
  - `FOREIGN KEY ("product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")`
  - `FOREIGN KEY ("product_variant_id", "product_id", "tenant_id") REFERENCES "product_variants"("id", "product_id", "tenant_id")`
  Enforce non-archived listing uniqueness per variant (`UNIQUE ("seller_profile_id", "product_variant_id") WHERE "status" != 'ARCHIVED'` in migration `0010_seller_marketplace_integrity.sql`), allowing merchants to reissue a fresh listing if an earlier listing was archived.

### ADR-0036: Cascading Seller Suspension and Finite Listing State Machine
* **Status:** Accepted (Stage 7)
* **Context:** Sellers may face compliance review or administrative holds. Allowing active listings to remain discoverable or permitting new listings to be activated while a merchant is suspended risks regulatory and financial harm.
* **Decision:** Implement explicit state machines for `SellerProfile` (`DRAFT`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`) and `SellerListing` (`DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`). Listing activation strictly requires `seller.status === 'ACTIVE'`. Suspending a seller dynamically suppresses all of their listings from public marketplace feeds (`listPublicListings`) and returns `404 Not Found` on public storefront endpoints (`/marketplace/sellers/:slug`).

### ADR-0037: Dedicated Operational SellerWorkspace Bound to Tenant, SellerProfile, and Store
* **Status:** Accepted (Stage 8)
* **Context:** Merchant operators need an internal administrative workspace (`SellerWorkspace`) to oversee store inventory, staff, and listings. Creating independent merchant entities disconnected from the parent tenant or permitting multiple active operational workspaces per seller profile risks split-brain state and cross-tenant leakage.
* **Decision:** Establish `SellerWorkspace` aggregate root in `@v-gold/core` bound strictly to a parent `Tenant`, an existing `SellerProfile`, and an optional `Store`. Enforce single workspace per seller profile invariant at the domain layer and via a unique constraint in PostgreSQL (`UNIQUE ("seller_profile_id")` in `0011_seller_os_foundation.sql`). Enforce multi-tenant cross-integrity via composite foreign keys:
  - `FOREIGN KEY ("seller_profile_id", "tenant_id") REFERENCES "seller_profiles"("id", "tenant_id") ON DELETE CASCADE`
  - `FOREIGN KEY ("store_id", "tenant_id") REFERENCES "stores"("id", "tenant_id") ON DELETE SET NULL`
  Implement finite state machine (`ACTIVE`, `SUSPENDED`, `ARCHIVED`). Suspending a workspace prohibits operational actions such as inventory transfers.

### ADR-0038: IAM System Reuse with Granular OPERATOR Role and Seller OS Permissions
* **Status:** Accepted (Stage 8)
* **Context:** Operating a merchant store requires staff members with distinct operational privileges (e.g. counter staff, vault keepers, store managers). Creating a separate seller authentication/IAM system would duplicate authentication logic, fragment sessions, and increase security attack surface.
* **Decision:** Strictly reuse existing Stage 3 `User` and `TenantMembership` infrastructure. Add additive role `OPERATOR` to `ROLES` and introduce granular Seller OS permissions (`seller.os.read`, `seller.os.manage`, `seller.staff.read`, `seller.staff.manage`, `seller.inventory.read`, `seller.inventory.manage`, `seller.listings.read`, `seller.listings.manage`). Staff access is authenticated via existing session tokens and authorized by verifying that `TenantMembership.role` possesses the required permission.

### ADR-0039: Zero-Fake-KPI Operational Overview Architecture
* **Status:** Accepted (Stage 8)
* **Context:** Executive and merchant dashboards frequently display hardcoded, mocked, or placeholder metrics that do not reflect actual operational reality. This violates the V-GOLD core principle of authoritative data and creates untrustworthy operational systems.
* **Decision:** The Seller OS operational overview endpoint (`GET /api/v1/seller-os/overview`) aggregates real counts from authoritative repositories:
  - Real inventory count grouped by physical state (`AVAILABLE`, `RESERVED`, `IN_TRANSIT`, `DAMAGED`, `LOST`, `SOLD`) directly from `InventoryItemRepositoryPort`.
  - Real marketplace listing count grouped by state (`ACTIVE`, `PAUSED`, `DRAFT`, `ARCHIVED`) directly from `SellerListingRepositoryPort`.
  - Real staff count (`totalMembers`, `activeMembers`, `operatorsCount`) directly from `TenantMembershipRepositoryPort`.
  Strictly NO placeholder charts, mock trend percentages, synthetic forecasts, or fake analytics engines. Absent data returns zero or null.

### ADR-0040: Production HttpOnly Cookie Enforcement and Column-Specific Composite FK Invariants
* **Status:** Accepted (Stage 8 Integrity Audit)
* **Context:**
  1. Authentication: Allowing non-standard authorization headers (`x-session-id`, ad-hoc Bearer extraction) in production API handlers creates security confusion, tempts frontend clients into storing session tokens in JavaScript-accessible storage (`localStorage`), and weakens protection against XSS-driven token exfiltration.
  2. Composite Store Foreign Key: `seller_workspaces` references `stores("id", "tenant_id")` while declaring `tenant_id NOT NULL`. A generic `ON DELETE SET NULL` in PostgreSQL attempts to set all composite columns (`store_id` and `tenant_id`) to NULL, causing an immediate runtime constraint violation (`not_null_violation`).
  3. Multi-Seller Workspace Boundaries: Within a multi-seller tenant, inventory and staff must not cross workspace boundaries indiscriminately.
* **Decision:**
  1. Strictly enforce HttpOnly, SameSite `vgold_session` session cookies as the sole production authentication path in `authenticateSellerOsRequest`. Remove non-standard header workarounds (`x-session-id`, Bearer tokens).
  2. Explicitly specify column-targeted nullification in PostgreSQL DDL migration `0011_seller_os_foundation.sql`: `FOREIGN KEY ("store_id", "tenant_id") REFERENCES "stores"("id", "tenant_id") ON DELETE SET NULL ("store_id")`. When a store is deleted, `store_id` becomes NULL while `tenant_id` remains immutable and non-null.
  3. Enforce workspace store boundaries on inventory transfers (rejecting transfers if item or target location does not belong to the workspace's store) and support explicit staff assignment mapping in `workspace.settings.assignedStaffUserIds`.

### ADR-0041: Session-Derived Tenant Identity & Explicit Operation Permissions (Stage 8.1)

* **Context:**
  1. Twelve catalog/inventory/listings/pricing/sellers API routes accepted `tenantId`/`actorId` from the request (query/body/headers) with no session check — live witness: `POST /api/v1/inventory/locations` without a cookie returned **201** for an arbitrary tenant. This defeated all Stage 3+ tenant isolation work at the web boundary.
  2. Seller OS routes already authenticated correctly via `authenticateSellerOsRequest`; the protection had to be generalized to every non-public route without changing the seller-os contract.
  3. Client-supplied identity fields are a standing spoofing hazard even when a session exists: any code path that accidentally reads them re-opens the hole.
  4. Operations lacked explicit per-operation permissions: reads and writes shared coarse seller.* rights only.
* **Decision:**
  1. **Tenant/actor derive EXCLUSIVELY from the `vgold_session` cookie** via the shared helper `authenticateRequest(req, requiredPermission?)` (`apps/web/lib/auth/request-auth.ts`), generalized from `authenticateSellerOsRequest` (now deleted; its 9 routes/12 call sites use the same helper with their original `seller.*` permissions). Chain: cookie (≥32 chars) → session → **ACTIVE** user → active tenant membership (stable selection: first `isActive()` membership sorted by id) → `membership.can(permission)`. `actorId` = `identity.user.id`. Ordering is authentication-before-input: a request with no cookie AND `tenantId` in input receives **401**, not 400.
  2. **Client identity input is rejected everywhere** (ADR-0042 mapper returns `400 VALIDATION_ERROR`): query/body keys `tenantId`/`actorId` and headers `x-tenant-id`/`x-actor-id`. Body is checked after JSON parse and before schema validation. The pricing schema's `tenantId` field was removed (`storeId` remains and is validated against the session tenant by the service).
  3. **New explicit permissions** in `packages/core/src/domain/iam/permissions.ts`: `catalog.read`, `catalog.manage`, `inventory.read`, `inventory.manage`, `pricing.read`. Role mapping (additive): `OWNER`, `ADMIN`, `OPERATOR` hold all five; `MEMBER` holds none. Existing `marketplace.seller.*` / `marketplace.listing.read/manage` and `seller.*` mappings are untouched. Method→permission: GET products/[id]/variants → `catalog.read`; POST products/variants → `catalog.manage`; GET items/locations/movements → `inventory.read`; POST items/locations/transition → `inventory.manage`; POST pricing/calculate → `pricing.read`; sellers GET → `marketplace.seller.read`, POST/PATCH → `marketplace.seller.manage`; listings GET → `marketplace.listing.read`, POST/PATCH → `marketplace.listing.manage`.
  4. **Public surface stays exactly** `/api/health`, `/api/v1/market-data/*`, `/api/v1/finance/*`, `/api/v1/marketplace/*`, `/api/v1/auth/login`, `/api/v1/auth/register` (plus session-guarded `/api/v1/auth/logout` and `/api/v1/auth/me`). Public routes also reject identity-input headers/params (400) so no surface accepts spoofable identity.
  5. `/api/v1/inventory/movements` reaches data only through `InventoryService` (`listMovements` by item, new `listMovementsByTenant` for the tenant feed) with Zod-validated `itemId`/`limit`/`offset`; the route no longer touches `movementRepo` directly.
* **Consequences:** Cross-tenant access keeps its service-level contract (`403` ForbiddenError via the cross-tenant existence probe, `404` when absent). `MEMBER` retains `marketplace.seller.read`/`marketplace.listing.read` (mapping pinned by `tests/marketplace-domain.test.ts:283-284`), so the “insufficient permission” negative cell is vacuous for the four marketplace read methods — documented in `tests/api-auth-hardening.test.ts` and the stage report. 16 of the 20 protected methods are deniable via `MEMBER`.

### ADR-0042: Shared API Error Sanitization (Stage 8.1)

* **Context:** 26 of 33 routes returned raw `error.message` from unexpected catch-all errors to clients (internal paths, driver strings, future stack details). Error responses also had three inconsistent shapes across route families.
* **Decision:**
  1. Every route maps errors through the shared mapper `toErrorResponse(error, scope?, codeOverride?)` (`apps/web/lib/api/api-errors.ts`): known domain errors (`DomainError`/`PricingError` contract: `code`, `httpStatus`, optional `details`) keep their authored message and status (asserted verbatim by existing tests, e.g. `'Carats (ct) are reserved exclusively for gemstone mass'`, `'No market observation currently available'`); **unknown errors** collapse to `500 {success:false, error:{code:'INTERNAL_ERROR', message:'An unexpected error occurred.'}}`.
  2. Unexpected errors are logged server-side with `scope`, error name and stack only — never cookies, headers, bodies, or PII. Seller-os's ad-hoc `INTERNAL_SERVER_ERROR` code is unified to `INTERNAL_ERROR`.
  3. Helper family: `validationErrorResponse(message?, details?)` for Zod/JSON failures (400 `VALIDATION_ERROR`), `rejectIdentityInput(req, body?)` for ADR-0041 identity-input rejection, `identityFieldViolationResponse(field)` for the auth routes. Custom public codes (`INVALID_BASE_CURRENCY`, `INVALID_QUOTE_CURRENCY`) survive via `codeOverride`.
  4. Response-error shape is unified as `{success:false, error:{code, message, details?}}`. Auth route responses previously used `{error:{...}}` without `success`; the mapper's `success:false` is strictly additive there and no asserted contract changes.
* **Consequences:** No route returns raw `error.message`; a forced-500 matrix cell (`tests/api-auth-hardening.test.ts` scenario 7, all 20 methods) asserts the generic body contains no internal marker/path and the mapper emits the server log without secrets/PII.

### ADR-0043: UUIDv7 Entity Identifiers via a Single IdGenerator Port (Stage 8.2)

* **Context:** Every `id` fallback across 12 entity/service factories was generated ad-hoc with `Math.random()`/`Date.now()` — predictable, clock-embedded, scattered across domain files, and un-injectable for tests (integrity-audit finding). Identifier columns are `VARCHAR` and must stay so (no destructive migration).
* **Decision:**
  1. New port `IdGeneratorPort` (`packages/core/src/ports/id-generator.port.ts`) with `generate(prefix?): string`, plus default implementation `packages/core/src/common/id-generator.ts`: `uuidv7()` per RFC 9562 (48-bit millisecond timestamp + 72 bits of CSPRNG entropy from `globalThis.crypto.getRandomValues`, version nibble `7`, variant `10xx`), `UuidV7IdGenerator`, and process-wide `getDefaultIdGenerator`/`setDefaultIdGenerator` for composition-root/test injection.
  2. Generated ids keep the existing debuggability prefix convention (`prod_`, `var_`, `user_`, `mem_`, `inv_`, `loc_`, `mov_`, `list_`, `rule_`, `prc_`, `obs_`, `fx_`; the mock provider uses `mock_`) followed by the UUIDv7. Explicitly supplied ids (e.g. seeded rule ids like `rule_iran_bazaar_18k_v1`) are preserved verbatim — factories keep `props.id ?? generateId(prefix)`.
  3. All 12 fallback sites (product, product-variant, user, tenant-membership, inventory-item, inventory-location, inventory-movement, seller-listing, pricing-rule, pricing-engine, market-data-ingestion, drizzle-fx-rate) now delegate to `generateId`; the mock market-data provider's `externalId` fallback was aligned as well (13th site, done for full elimination), so no `Math.random()`/`Date.now()` identifier generation remains anywhere — the only `Date.now()` left is the mandated timestamp field inside `uuidv7` itself.
* **Consequences:** Ids become time-ordered (UUIDv7), collision-free under the CSPRNG, and deterministic under injected generators (unit-testable). `VARCHAR` columns, explicit id contracts, and seeded identifiers are unchanged.

### ADR-0044: OWASP-Grade scrypt Parameters with Transparent Hash Upgrades (Stage 8.2)

* **Context:** Password hashes used scrypt `N=2^14, r=8, p=1` — below the OWASP Password Storage Cheat Sheet minimum work factor (`N=2^17`) — and the hard-coded `maxmem` was too small to compute larger `N`. Existing hashes (N=16384) must keep verifying.
* **Decision:**
  1. `ScryptPasswordHasher` (`packages/database/src/security/scrypt-password-hasher.ts`) defaults to `N=2^17, r=8, p=1` (OWASP-aligned), 16-byte CSPRNG salt, 64-byte derived key, encoded as `scrypt$N=…,r=…,p=…$salt$key`; `maxmem` is computed as `256*N*r + 1 MiB` so any accepted configuration completes without `maxmem` errors.
  2. Environment overrides `VGOLD_SCRYPT_N/R/P` with a safe floor: `N` must be a power of two ≥ 2^14, `r ∈ [8,32]`, `p ∈ [1,16]`; violating configuration fails fast at construction (`ValidationError`). Effective parameters = override > env > default.
  3. `verify` parses `N`/`r`/`p` from the stored hash itself (bounded check `2^10 ≤ N ≤ 2^22`), so legacy N=16384 hashes remain valid indefinitely. The `PasswordHasher` port gains optional `needsRehash(hash)` — true for unparseable or weaker-than-current parameters.
  4. After a **successful** login (`AuthService.login`), when `needsRehash` is true the stored hash is transparently upgraded via `User.changePassword(newHash)` + `userRepo.save` — same password, current parameters — before the session is created. Failed logins and status-blocked accounts (suspended) never touch the hash.
* **Consequences:** New hashes carry the OWASP work factor; old hashes verify at their original cost and are upgraded on their next successful login. Test fixtures using opaque `PasswordHash.create(...)` strings are unaffected (creation does not parse the encoded form).

### ADR-0045: 22-Karat Fineness Canonicalized to 916 (Stage 8.2)

* **Context:** `STANDARD_PURITY_DEFINITIONS.K22.fineness` was `916.6` and `fromKarat('22')` derived `0.9166…`, while every other karat uses clean millesimal marks (`24K→999.9`, `21K→875`, `18K→750`, `14K→585`). ISO 9202 millesimal fineness marks for 22K are 916/917; 916 matches the rounding style already used for 14K's 585.
* **Decision:** The canonical 22K fineness is **916**: the standard-definition table, the `fromKarat('22')` canonical branch (new), and therefore `pureGoldFraction = 0.916`. Custom fineness values (e.g. a user-defined `916.6` via `fromFineness`) remain legal — only the 22K standard mark changed. The pricing-engine fixture declaring `expectedFactor: '0.9166'` for 22K now declares `'0.916'`.
* **Consequences (documented pricing effect):** A 22K piece's pure-gold content drops by ≈ **0.0655 %** (10 g of 22K = 9.160 g fine gold instead of 9.166 g). Every 22K quote decreases proportionally (−0.0655 % of the gold-content component); other karats are unaffected.

### ADR-0046: PostgreSQL Decision Record — Real Connection Deferred to Stage 8.3 (Stage 8.2)

* **Context:** The integrity audit rated the in-memory-only persistence runtime (the `pg` driver has never been installed) as a mandatory pre-Stage-9 remediation. Stage 8.2 was scoped to record the database decision only.
* **Decision:** The production persistence engine is **PostgreSQL** (matching the existing Drizzle schema definitions and the sequential SQL migrations). The real connection — driver installation, a safe additive (non-destructive) migration path against a live database, and Row-Level Security — is scheduled for **Stage 8.3 (next session)**, before Stage 9 begins. Stage 8.2 makes no schema or migration change.
* **Consequences:** The decision is recorded now; the runtime remains in-memory until Stage 8.3 attaches PostgreSQL without destructive migration.

### ADR-0047: Real PostgreSQL Connection and Opt-In Persistence Composition (Stage 8.3)

* **Context:** The `pg` driver had never been installed in the repository's history; the 20 Drizzle repositories and the Drizzle inventory unit of work were compiled against `drizzle-orm/pg-core` but had never executed against a live database. Eight composition roots (`getDefaultAuthService` + seven containers) hard-coded `new InMemory*Repository()`.
* **Decision:**
  1. `@v-gold/database` gains the `pg` driver; `pg/connection.ts` provides `createPgPool`/`createPgConnection` (Drizzle over `node-postgres`) using the existing `DATABASE_*` configuration (`createDatabaseConfigFromEnv`). The repository constructor type `PgDatabase<any>` is corrected to `PgDatabase<any, any, any>` so a schema-carrying database is assignable (the old spelling silently demanded an empty schema).
  2. A single composition factory `createPersistence(env)` (`persistence.ts`) returns every repository port + the inventory unit of work. **PostgreSQL mode is explicit opt-in: `DATABASE_ENABLED=true`** (plus `DATABASE_HOST/PORT/USER/PASSWORD/NAME/SSL/MAX_CONNECTIONS`); the default remains in-memory — byte-for-byte the behavior all 537 existing tests pin. One shared connection pool is reused across composition roots; `close()` releases it.
  3. All eight composition roots construct their repositories from `createPersistence()`. Bootstrap data (reference FX pairs, `src_unavailable`, four market instruments, three reference pricing rules) stays as it is: explicit-id seeds are upsert-idempotent; the FX reference seed (generated ids) is guarded by `findLatest` in PostgreSQL mode so durable storage is not duplicated per boot.
* **Consequences:** The web runtime connects to a real PostgreSQL database whenever `DATABASE_ENABLED=true` and behaves identically to in-memory mode otherwise. Reference/bootstrap data seeding in PostgreSQL mode is idempotent.

### ADR-0048: Sequential File-Based Migration Runner with Ledger (Stage 8.3)

* **Context:** Eleven sequential additive SQL migrations (0001–0011) existed as reviewed files but no runner existed; nothing ever applied them to a live database.
* **Decision:** `pg/migrate.ts` (`runMigrations(pool, migrationsDir?)`) applies `NNNN_*.sql` files in ascending filename order, each inside its own transaction **together with** its ledger entry in the additive `schema_migrations` table (atomic apply+record). Re-runs are idempotent (applied files are skipped). Out-of-order states — an unapplied file that sorts before an already-applied file — are refused loudly instead of guessed. Migration files ship with the build (`dist/migrations`). Only additive/forward SQL is admitted (no destructive migration, per the session constraints).
* **Consequences:** Applying 0001–0012 to a real PostgreSQL cluster is deterministic, resumable, and reviewable; the runner itself is verified against a real cluster in `tests/postgres-infrastructure.test.ts`.

### ADR-0049: Conditional Row-Level Security with Tenant Context (Stage 8.3)

* **Context:** Tenant isolation lived in service/repository WHERE clauses only. The port contracts deliberately include **un-scoped** reads on tenant-scoped tables: cross-tenant existence probes behind 403/404 (`findById(id)` without tenant), public marketplace discovery (`findBySlug`, `listPublicSellers`, `listPublicListings`), login membership discovery (`findAllByUser`), and global counts (`PricingRule/Result.count()`). A naive strict RLS policy would break all of them.
* **Decision:**
  1. Migration `0012_row_level_security.sql` enables **and forces** RLS on all 12 tenant-scoped tables (`stores`, `tenant_memberships`, `pricing_rules`, `pricing_results`, `products`, `product_variants`, `inventory_locations`, `inventory_items`, `inventory_movements`, `seller_profiles`, `seller_listings`, `seller_workspaces`) with one conditional policy each: `app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id()` for both `USING` and `WITH CHECK` (`FORCE ROW LEVEL SECURITY` binds even the table owner).
  2. The enforcement key is the transaction-local GUC `app.tenant_id`, set via `withTenantContext(db, tenantId, fn)` (`pg/tenant-context.ts`, `set_config(..., true)` — pooling-safe). **Context set** ⇒ hard isolation: unfiltered SELECTs see only the context's rows, UPDATE/DELETE cannot touch foreign rows, and INSERTs carrying a foreign `tenant_id` are refused by `WITH CHECK` (defense in depth against identity spoofing). **Context unset** ⇒ the deliberate global/probe/public branch of the port contract.
  3. In PostgreSQL mode `persistence.ts` wraps the 12 tenant-scoped repositories (and the inventory unit of work) in tenant-context decorators (`pg/tenant-scoped.ts`) that bind every call to the tenant of its argument (or of the written entity); deliberately un-scoped methods run without a context. The restricted `vgold_app` role (non-owner, plain DML grants) is the expected runtime role.
* **Consequences:** DB-enforced tenant isolation whenever a tenant context is present — independent of application WHERE clauses — while every existing cross-tenant probe, public discovery, and auth flow keeps its exact contract. The full matrix (context isolation, WITH CHECK, cross-tenant UPDATE/DELETE, global branch, decorator binding) is proven as `vgold_app` against a real cluster.

---

## 9. Security & Boundary Hardening Status

* **Credential Protection:** Provider API keys and connection credentials never enter domain entities, repository records, or API serialization DTOs.
* **IDOR Protection:** Verified in `tests/idor-security.test.ts`, `tests/pricing-tenant-isolation.test.ts`, `tests/catalog-inventory-security.test.ts`, `tests/marketplace-service-and-isolation.test.ts`, and `tests/seller-os-tenant-isolation.test.ts`. Cross-tenant queries or mutations for Products, Variants, Inventory Items, Locations, Movements, Seller Profiles, Seller Listings, and Seller Workspaces are strictly rejected.
* **Public Discovery Sanitization:** Public marketplace endpoints (`/api/v1/marketplace/...`) strictly sanitize internal tenant IDs, tax identification numbers, business registration codes, internal store links, and audit metadata.
* **User Enumeration Prevention:** Login failures return uniform `401 Unauthorized` ("Invalid email or password.") whether the email exists or not.
* **Credential Leakage Prevention:** DTOs never serialize `password_hash`. `PasswordHash.toString()` redacts hash contents.
* **Financial Rounding Attack Prevention:** Premature rounding is structurally prohibited; calculations preserve high-precision decimal representation.
* **Known Future Hardening Items (Deferred to Stage 23):** Distributed Redis rate limiter for login and market data quote endpoints; Multi-Factor Authentication (MFA); WebAuthn/Passkey integration.

### ADR-0050: AI Conversational Designer and Structured Attribute Extraction (Stage 9)

* **Context:** Stage 9 activates the conversational design intelligence layer for custom jewelry creation. It requires an interactive conversation aggregate (`DesignSession`), an AI Gateway port capable of handling natural language conversations, structured attribute extraction (metal, purity, stone, occasion, jewelry type), gateway timeouts with graceful fallback, and multi-tenant persistence protected by PostgreSQL Row-Level Security.
* **Decision:**
  1. **Domain Aggregate (`DesignSession`):** Created the `DesignSession` aggregate root managing message history (`DesignMessage`), lifecycle transitions (`ACTIVE -> COMPLETED | ABANDONED`), and progressive attribute accumulation via `ExtractedDesignAttributes`.
  2. **AI Gateway Integration (`AiGatewayPort` / `AiGatewayClient`):** Extended `AiGatewayPort` to support `extractDesignAttributes` with structured attribute parsing. `AiGatewayClient` wraps requests with explicit timeouts returning `504 AI_PROVIDER_TIMEOUT` (`AiTimeoutError`), falling back gracefully to `UnavailableAiGatewayAdapter` (503) when no live provider is present, or using `MockAiGatewayAdapter` for automated deterministic testing without hallucination.
  3. **Multi-Tenant Persistence & RLS (ADR-0049 extension):** Introduced `design_sessions` schema with DDL migration `0013_ai_conversational_designer.sql`. Enabled and forced Row-Level Security with conditional tenant policy (`design_sessions_tenant_isolation`), implemented `InMemoryDesignSessionRepository`, `DrizzleDesignSessionRepository`, and wired `TenantScopedDesignSessionRepository` in `createPersistence()`.
  4. **API Endpoints & Auth Hardening (ADR-0041):** Added Next.js App Router endpoints `/api/v1/ai/design-sessions`, `/api/v1/ai/design-sessions/[id]`, `/api/v1/ai/design-sessions/[id]/messages`, and `/api/v1/ai/design-sessions/[id]/complete`. Authentication requires valid `vgold_session` cookie with `ai.design` permission. Rejects client-supplied `tenantId`/`actorId` with 400 VALIDATION_ERROR.
* **Consequences:** End-to-end conversational design sessions are supported with domain attribute grounding, multi-tenant database isolation under RLS, and resilient fallback when AI providers are unavailable.

### ADR-0051: AI Concept Generation Pipeline and Strict Domain Attribute Grounding (Stage 10)

* **Context:** Stage 10 introduces the AI concept generation pipeline to synthesize creative jewelry proposals (`DesignConcept`) from session conversations. A core business requirement of V-GOLD is strict domain grounding: generative AI must never alter verified material specifications (metal type, karat, purity, physical invariants), must account for token consumption, and must guarantee idempotency against duplicate submissions.
* **Decision:**
  1. **Domain Aggregate (`DesignConcept`):** Implemented `DesignConcept` aggregate root linked strictly to `DesignSession` and `Tenant`. Enforces immutable domain grounding (`groundedAttributes`) — attempts to alter or violate gold karats (valid range: 9–24K) or precious metal invariants reject with `422 CONCEPT_GROUNDING_VIOLATION` (`ConceptGroundingViolationError`).
  2. **Token Accounting Value Object:** Introduced `TokenAccounting` tracking `promptTokens`, `completionTokens`, `totalTokens`, `model`, and `provider`.
  3. **Idempotency & Resilience:** `AiGatewayPort` and `AiGatewayClient` expose `generateConcept` with timeout protection (504 `AiTimeoutError`) and fallback to `UnavailableAiGatewayAdapter` (503). `DesignConceptService` checks `findByIdempotencyKey` before invoking AI generation to prevent duplicate token costs and duplicate concept creation.
  4. **Multi-Tenant Persistence & Row-Level Security:** Schema `design_concepts` and additive migration `0014_ai_concept_generation.sql` with unique composite index `(tenant_id, session_id, idempotency_key)` and conditional Row-Level Security policy (`design_concepts_tenant_isolation`). Wrapped in `TenantScopedDesignConceptRepository` in `createPersistence()`.
  5. **API Endpoints:** Added Next.js App Router endpoints `/api/v1/ai/design-sessions/[id]/concepts`, `/api/v1/ai/design-sessions/[id]/concepts/[conceptId]`, and `/api/v1/ai/design-sessions/[id]/concepts/[conceptId]/status` under HttpOnly session authentication and `ai.design` permission.
  * **Consequences:** Creative concept proposals are generated with verifiable domain material grounding, full token accounting, guaranteed idempotency, and hard multi-tenant database isolation.

## ADR-0052: Visual Search Engine, Feature Embeddings & Multitenant Vector Indexing

### Context
Stage 11 of the V-GOLD roadmap introduces image-based jewelry similarity search across catalog items. Customers or merchants can submit an image (photo, sketch, or design screenshot) to identify matching physical products or variants in the live catalog based on aesthetic, geometric, and attribute characteristics.

### Decision
1. **Domain Isolation & Value Objects**:
   - `FeatureVector`: Encapsulates high-dimensional feature embeddings with invariant bounds (8 to 2048 dimensions, finite floating-point values) and mathematical cosine similarity calculation.
   - `VisualSearchImage`: Validates image binary metadata with strict file-type whitelisting (`image/jpeg`, `image/png`, `image/webp`), size limits (up to 5MB), and path traversal protection against suspicious filenames (e.g., `..`, `/`, `\`, null bytes).
   - `VisualSearchResultItem`: Models ranked catalog matches with cosine similarity scores, ordinal ranks, and extracted domain attributes (`jewelryType`, `metalType`, `category`).

2. **AI Gateway Integration**:
   - Defined `VisualFeatureExtractorPort` in `@v-gold/core` with adapters in `@v-gold/ai-gateway`:
     - `MockVisualFeatureExtractorAdapter`: Produces deterministic embeddings for continuous testing and offline development.
     - `UnavailableVisualFeatureExtractorAdapter`: Gracefully handles provider downtime with typed `AiProviderUnavailableError`.

3. **Storage & Multi-Tenant Row Level Security**:
   - `product_feature_embeddings` table indexed by `tenant_id` and `product_id`.
   - Migration `0015_visual_search_foundation.sql` enables and forces PostgreSQL RLS with `tenant_id = app_current_tenant_id()` policy.
   - Persistence layer includes `InMemoryVectorIndexRepository` and `DrizzleProductFeatureEmbeddingRepository`, decorated with `TenantScopedVectorSearchIndexRepository` to enforce tenant boundary isolation.

4. **REST API Endpoints**:
   - `POST /api/v1/catalog/visual-search`: Accepts image payload, performs feature extraction, and returns top-K similarity-ranked items.
   - `POST /api/v1/catalog/products/[id]/features`: Indexes product feature embeddings with associated catalog metadata.

## ADR-0053: Budget-Aware Design Engine & Reverse-Pricing Solvers

### Context
Stage 12 of the V-GOLD roadmap introduces budget-aware jewelry reverse-pricing. Given a client's ceiling budget, preferred karats, and optional stone allowances, the engine computes optimal configurations (viable precious metal weights and breakdown) ensuring zero mathematical overruns against real-time gold spot rates and pricing rules.

### Decision
1. **Domain Isolation & Reverse Solver**:
   - `BudgetAwarePricingEngine`: Uses arbitrary-precision bisection search (Decimal-safe with 0.1 mg epsilon tolerance) to solve for the maximum allowable metal weight for each requested karat under the target budget ceiling.
   - Evaluates full statutory formula components via `PricingEngine` (base metal cost, ojrat/making charges, merchant margin, VAT rules, currency conversion).
   - Invariant check verifies that computed cost strictly satisfies `estimatedCost <= budgetCeiling` with zero floating-point error.
   - Rejects insufficient budgets with typed `InsufficientBudgetError` and catches ceiling overruns with `BudgetConfigurationExceededError`.

2. **Web Layer & API**:
   - `BudgetEngineService` coordinates market instrument resolution, spot observation retrieval, tenant-specific pricing rules, and reverse optimization.
   - Protected endpoint `POST /api/v1/ai/budget-engine` strictly authenticated via HttpOnly session cookies under `pricing.read` permissions.

## ADR-0054: 3D Jewelry Studio Assets, PBR Material Pipelines & Signed Previews

### Context
Stage 13 of the V-GOLD roadmap introduces the 3D Jewelry Studio foundation, enabling interactive 3D rendering and inspection of jewelry models (GLTF/GLB formats, mesh scale, and PBR material maps) within isolated tenant contexts.

### Decision
1. **Domain Isolation & Value Objects**:
   - `BoundingBox3D`: Validates bounding box dimensions along X, Y, Z axes within strict jewelry scale invariants (0.001m to 1.0m / 1mm to 1000mm) using `Invalid3DScaleError`.
   - `PbrMaterialMap`: Encapsulates physically-based rendering properties (metalness, roughness, base color hex, normal, and occlusion maps) clamped between [0.0, 1.0].
   - `Studio3DAsset`: Models 3D asset metadata, file size enforcement (up to 50MB via `Oversized3DAssetError`), and MIME validation restricted to `model/gltf-binary` (.glb) and `model/gltf+json` (.gltf) via `Invalid3DAssetTypeError`.

2. **Storage Port & Temporary Signed URLs**:
   - `Studio3DStoragePort` defines signed download and upload URL generation contracts (`MockStudio3DStorageAdapter`).
   - Previews utilize time-limited signed URLs (default 900 seconds) preventing unauthorized persistent asset exposure.

3. **Multi-Tenant Row-Level Security**:
   - Schema `studio_3d_assets` indexed by `tenant_id` and `product_id`.
   - Migration `0016_studio_3d_foundation.sql` enables and forces PostgreSQL RLS policy `studio_3d_assets_tenant_isolation`.
   - Wrapped in `TenantScopedStudio3DAssetRepository` preventing cross-tenant leakage.

4. **REST API**:
   - `POST /api/v1/studio-3d/assets`: Registers new 3D model metadata under `catalog.manage` permission.
   - `GET /api/v1/studio-3d/assets/[id]`: Generates signed preview payload under `catalog.read` permission.

## ADR-0055: Virtual Try-On Infrastructure, Biometric Anchoring & Privacy Lifecycles

### Context
Stage 14 of the V-GOLD roadmap introduces Virtual Try-On (AR) capabilities. Users can configure biometric anchoring parameters (ring finger millimeter sizing, wrist circumference, and positional offsets) to preview jewelry models on mobile and desktop web without persistent leakage of biometric or unauthorized 3D assets.

### Decision
1. **Domain Isolation & Biometric Invariants**:
   - `BodyPartAnchoring`: Validates scale factors (0.5 to 2.5), finger millimeter sizes (10mm to 30mm), and wrist circumferences (100mm to 300mm) using `InvalidAnchoringScaleError`.
   - `TryOnSession`: Manages state machine (`ACTIVE`, `EXPIRED`, `COMPLETED`) with an explicit lifespan (default 600–900 seconds) to ensure strict privacy compliance.
   - Accessing expired sessions triggers `TryOnSessionExpiredError` and forces automatic status transition to `EXPIRED`.

2. **Temporary Signed URL Pipeline**:
   - Every try-on session generates a time-bound signed URL tied to the session duration, preventing direct exposure of the underlying asset storage paths.

3. **Multi-Tenant Row-Level Security**:
   - Table `try_on_sessions` with migration `0017_virtual_try_on_foundation.sql`.
   - RLS policy `try_on_sessions_tenant_isolation` guarantees strict tenant boundaries.
   - Persistence layer uses `TenantScopedTryOnSessionRepository`.

4. **REST API**:
   - `POST /api/v1/try-on/sessions`: Initiates an ephemeral try-on session under authenticated catalog reader context.
   - `GET /api/v1/try-on/sessions/[id]`: Returns session state and verifies active status.

## ADR-0056: Custom Manufacturing & RFQ Workflows

### Context
Stage 15 of the V-GOLD roadmap introduces Custom Manufacturing and Request for Quote (RFQ) workflows, connecting customers, sellers, and certified goldsmiths. Customers require bespoke quoting, milestone-based cost breakdowns, specification revisions, and in-band messaging with strict status transitions and multi-tenant security isolation.

### Decision
1. **Domain Model & State Machine**:
   - Aggregate Root `CustomManufacturingRfq`: Tracks custom manufacturing lifecycle across seven distinct states: `DRAFT` -> `OPEN` -> `PROPOSALS_RECEIVED` -> `ACCEPTED` -> `IN_PRODUCTION` -> `COMPLETED` (or `CANCELLED`). Enforces valid transitions via `InvalidRfqStateTransitionError`.
   - `RfqProposal`: Models quotations submitted by certified goldsmiths, including delivery day estimates, notes, total quotes (`Money`), and milestone breakdowns (`MilestoneQuote`).
   - `MilestoneQuote`: Value object representing granular work stages with targeted duration and associated cost.
   - `RfqMessage`: In-band communication messages strictly attributed to authorized participants (`CUSTOMER`, `GOLDSMITH`, `SELLER`).
   - Acceptance mechanics: When a proposal is accepted, the aggregate transitions to `ACCEPTED`, sets `assignedGoldsmithId`, and marks the accepted proposal as `ACCEPTED` while invalidating or retaining competing proposals.

2. **Multi-Tenant Row-Level Security**:
   - Database table `custom_manufacturing_rfqs` tracks JSONB structures for `proposals` and `messages` alongside relational tenant, customer, and goldsmith foreign keys.
   - Migration `0018_custom_rfq_foundation.sql` creates table, indexes, enables RLS, and forces tenant isolation policy `custom_manufacturing_rfqs_tenant_isolation`.
   - Enforced in persistence via `TenantScopedRfqRepository` preventing cross-tenant leakage.

3. **REST API & DI Wiring**:
   - `POST /api/v1/rfq`: Initiates custom manufacturing RFQ under authenticated user context.
   - `GET /api/v1/rfq/[id]`: Fetches RFQ aggregate details including proposal list and messaging history.
   - `POST /api/v1/rfq/[id]/proposals`: Submits quotation proposal with milestone schedule.
   - `PATCH /api/v1/rfq/[id]/proposals`: Accepts a selected proposal and assigns goldsmith.
   - `POST /api/v1/rfq/[id]/messages`: Dispatches in-band message between participants.

## ADR-0057: AI Packaging & Box Studio

### Context
Stage 16 introduces custom luxury packaging and box specifications. Fine jewelry items require custom physical dimensions, structural constraints (dieline board thickness, creasing matrix, insert cushion styles), material cost calculations (Leather, Velvet, Solid Wood, Hardcover Paper, Lacquered Wood), and AI packaging rendering generation.

### Decision
1. **Domain Models & Cost Calculation**:
   - `BoxDimensions`: Value object enforcing bounding dimensions (Width/Length: 20mm-500mm, Height: 10mm-300mm) using `InvalidPackagingDimensionsError` and computing exterior surface area and interior volume.
   - `PackagingCostCalculator`: Computes production cost based on surface area units, material rates per 100 cm², luxury tier multipliers (`STANDARD`: 1.0, `PREMIUM`: 1.5, `BESPOKE_LUXURY`: 2.2), and fixed tooling setup additions (custom dieline plates, hot foil stamping).
   - `PackagingSpecification`: Aggregate root encapsulating physical dimensions, material, colors, dieline specs, and generated AI visual previews.

2. **Multi-Tenant Row-Level Security**:
   - Database table `packaging_specifications` with migration `0019_ai_packaging_foundation.sql`.
   - RLS policy `packaging_specifications_tenant_isolation` guarantees zero cross-tenant leakage.
   - Repository `TenantScopedPackagingRepository` enforces tenant session context.

3. **REST API**:
   - `POST /api/v1/packaging`: Creates new packaging specification under `catalog.manage` permission.
   - `GET /api/v1/packaging`: Lists packaging specifications (optionally filtered by `productId`) under `catalog.read`.
   - `GET /api/v1/packaging/[id]`: Fetches single specification.
   - `POST /api/v1/packaging/[id]/preview`: Generates AI visual preview URL.

## ADR-0058: Commerce, Orders & Atomic Inventory Reservations

### Context
Stage 17 introduces core transactional commerce: Carts, Orders, Line Items, Atomic Stock Reservations with TTL expiration, and Payment processing abstraction across multiple currencies with strict idempotency and zero client-price overrides.

### Decision
1. **Domain Models & State Machines**:
   - `Cart` & `CartItem`: Encapsulates user cart state, multi-item line totals, and dynamic quantity consolidation.
   - `StockReservation`: Implements finite-lifetime atomic inventory reservations (default 15 minutes TTL). Prevents stock overselling and double bookings during checkout.
   - `Order` & `OrderLine`: Server-authoritative aggregate calculating line subtotals, tax components, and grand totals directly from domain `Money`. Enforces strict state progression: `PENDING_PAYMENT` -> `PAID` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED` (or `CANCELLED`).
   - Idempotency Guarantee: `checkoutCart` verifies optional `idempotencyKey` preventing duplicate charges or duplicate order records.

2. **Multi-Tenant Row-Level Security**:
   - Tables `carts`, `orders`, and `stock_reservations` created with migration `0020_commerce_foundation.sql`.
   - PostgreSQL RLS policies `carts_tenant_isolation`, `orders_tenant_isolation`, and `stock_reservations_tenant_isolation` enforce tenant context.
   - Repositories wrapped in `TenantScopedOrderRepository`, `TenantScopedCartRepository`, and `TenantScopedStockReservationRepository`.

3. **REST API**:
   - `GET /api/v1/commerce/cart`: Fetches current user cart.
   - `POST /api/v1/commerce/cart`: Adds item or increments line quantity.
   - `POST /api/v1/commerce/orders`: Converts cart to authoritative order with atomic stock reservations.
   - `GET /api/v1/commerce/orders`: Lists user order history.
   - `POST /api/v1/commerce/orders/[id]/pay`: Executes payment provider verification, commits stock reservations, and transitions order status to `PAID`.

## ADR-0059: AI Content Studio & Factual Grounding Verification

### Context
Stage 18 introduces automated marketing, e-commerce, and certificate copy generation (descriptions, Instagram social captions, and certificates of authenticity). Because jewelry and gold products carry strict legal and statutory requirements, generated content must never hallucinate gold karat fineness, metal types, or gemstone classifications.

### Decision
1. **Domain Models & Factual Grounding Verification**:
   - `ContentGroundingValidator`: Validates that generated headlines and text bodies strictly match authoritative technical specifications (metal types, gold fineness/karat ratings, and gemstone classifications). Any contradiction triggers `ContentGroundingViolationError` (HTTP 422).
   - `ContentAsset`: Aggregate root representing generated copy across formats (`PRODUCT_DESCRIPTION`, `SOCIAL_CAPTION`, `CERTIFICATE_OF_AUTHENTICITY`) and supported locales (`fa-IR`, `en-US`, `ar-AE`).

2. **Multi-Tenant Row-Level Security**:
   - Schema table `content_assets` created in migration `0021_ai_content_studio_foundation.sql`.
   - Restrictive PostgreSQL RLS policy `content_assets_tenant_isolation` guarantees strict tenant boundaries.
   - Wired with `TenantScopedContentStudioRepository` in persistence.

3. **REST API**:
   - `POST /api/v1/content-studio`: Generates and verifies grounded content asset under `catalog.manage`.
   - `GET /api/v1/content-studio`: Lists tenant content assets (optionally filtered by `productId`) under `catalog.read`.
   - `GET /api/v1/content-studio/[id]`: Retrieves specific content asset.

## ADR-0060: Social Commerce & Multi-Platform Publishing

### Context
Stage 19 introduces automated social publishing across external platforms (Instagram, Telegram, WhatsApp catalogs). Storing third-party OAuth access tokens and bot credentials in plaintext creates high-severity exfiltration risks. Furthermore, post lifecycle management requires deterministic asynchronous scheduling and atomic state transitions to prevent duplicate broadcasts.

### Decision
1. **AES-256-GCM Secure Credential Vault**:
   - `SecureCredentialVault`: Encrypts access tokens and API secrets with AES-256-GCM using a 96-bit CSPRNG IV and 128-bit authentication tag. Tokens are never persisted in plaintext, nor leaked in API responses.
2. **Domain Models & Lifecycle State Machine**:
   - `PublishingChannel`: Aggregate root encapsulating platform credentials, active status, and tenant isolation.
   - `PublishingPost`: Post aggregate managing scheduled publication times, media attachments, and state machine transitions: `SCHEDULED` -> `PUBLISHING` -> `PUBLISHED` (or `FAILED`).
3. **Multi-Tenant Row-Level Security**:
   - Tables `publishing_channels` and `publishing_posts` created in migration `0022_social_commerce_foundation.sql`.
   - Restrictive policies `publishing_channels_tenant_isolation` and `publishing_posts_tenant_isolation` guarantee strict multi-tenant segregation.
4. **REST API**:
   - `GET /api/v1/social/channels` & `POST /api/v1/social/channels`: Manages connected platform accounts.
   - `GET /api/v1/social/posts` & `POST /api/v1/social/posts`: Schedules social broadcasts.
   - `GET /api/v1/social/posts/[id]`: Retrieves post status.
   - `POST /api/v1/social/posts/[id]/publish`: Triggers execution of due posts via `SocialPublishingPort`.

## ADR-0061: Trust, Safety & Verifiable Seller Integrity

### Context
Stage 20 introduces verification and trust mechanics across jewelry sellers, assay hallmarks, and consumer reviews. In the luxury and gold sectors, fake reviews, unverified hallmark claims, and arbitrary rating algorithms can facilitate consumer fraud and regulatory violations. Trust scores must be grounded exclusively in auditable, verifiable evidence.

### Decision
1. **Domain Models & Truthful Evidence Grounding**:
   - `GuildLicense`: Aggregate root for goldsmith guild registrations, enforcing valid issuance/expiry time windows and formal verification/rejection lifecycles. Expired licenses cannot be verified.
   - `HallmarkAuditRecord`: Domain model tracking verified assay hallmark codes (e.g. Tehran T750), certified laboratory authorities, and tested gold fineness (375 to 999.9).
   - `CustomerReview`: Aggregate enforcing verified order association (`orderId`) and two-phase moderation (`PENDING_REVIEW` -> `APPROVED` | `REJECTED`).
   - `TrustScoreCalculator`: Pure, deterministic calculation combining guild verification (40 pts), certified hallmark audits (up to 20 pts), and verified customer reviews (up to 40 pts). Synthetic or unsubstantiated ratings are strictly excluded.

2. **Multi-Tenant Row-Level Security**:
   - Tables `guild_licenses`, `hallmark_audit_records`, and `customer_reviews` created in migration `0023_trust_safety_foundation.sql`.
   - Restrictive policies (`guild_licenses_tenant_isolation`, `hallmark_audit_records_tenant_isolation`, `customer_reviews_tenant_isolation`) ensure absolute tenant boundary isolation.

3. **REST API**:
   - `POST /api/v1/trust/licenses`: Submits guild license for verification.
   - `POST /api/v1/trust/licenses/[id]/verify`: Platform admin verifies/rejects license.
   - `POST /api/v1/trust/hallmarks`: Records spectrometer/assay hallmark inspection.
   - `POST /api/v1/trust/reviews`: Submits verified purchase customer review.
   - `POST /api/v1/trust/reviews/[id]/moderate`: Approves/rejects customer review.
   - `GET /api/v1/trust/scores/[sellerId]`: Real-time trust breakdown and tier calculation.

## ADR-0062: Analytics & Business Intelligence Engine

### Context
Stage 21 introduces operational analytics, revenue accounting, and inventory turnover dashboards for sellers. Luxury commerce and precious metal trading require zero data fabrication: financial calculations, taxes collected, and gold mass turnover rates must be computed with mathematical precision directly from immutable orders and inventory states, with absolute tenant isolation.

### Decision
1. **Domain Models & Verifiable Aggregation**:
   - `AnalyticsAggregator`: Aggregates performance metrics directly from persisted `Order` and `InventoryItem` domain entities.
   - Financial metrics (`totalGrossRevenue`, `totalTaxCollected`, `averageOrderValue`) preserve exact monetary values via `Money` and reject currency cross-contamination.
   - Inventory turnover metrics compute available, reserved, and sold item quantities, total grams of gold held, and turnover velocity rates.
2. **Persistence Architecture & Multi-Tenant Boundaries**:
   - `PersistenceAnalyticsRepository`: Connects directly to tenant-scoped order and inventory repositories, guaranteeing that aggregation queries run exclusively within the calling tenant's RLS boundary.
3. **REST API**:
   - `GET /api/v1/analytics/performance`: Exposes seller operational dashboard with optional `from` and `to` ISO date range filtering under `tenant.read`.

## ADR-0063: Performance Optimization, Compound Indexing & Caching Architecture

### Context
Stage 22 addresses performance scaling across high-volume jewelry commerce, precious metals pricing, and inventory management. As tenant order volume and physical inventory movements expand, unindexed sequential scans and repeated real-time spot price queries introduce latency.

### Decision
1. **Compound Index Optimization**:
   - Sequential migration `0024_performance_optimization.sql` introduces compound indices on critical high-cardinality multi-tenant tables (`orders(tenant_id, created_at DESC)`, `inventory_items(tenant_id, status)`, `seller_listings(tenant_id, status, created_at DESC)`, `customer_reviews(tenant_id, seller_profile_id, moderation_status)`).
2. **Deterministic Bounded Pagination**:
   - Strict `PaginationParams` and `PaginatedResult<T>` utilities enforcing max limits (100) and keyset cursor-based progression to prevent $O(N)$ full-scan penalties.
3. **In-Memory Caching Port & Invalidation Lifecycle**:
   - `CachePort<T>` and `InMemoryCache<T>` providing deterministic TTL-based caching and explicit purge hooks.
   - `CachedMarketPriceQueryService`: Wraps market observation repositories to cache gold spot prices within freshness windows while isolating tenant cache keys.






