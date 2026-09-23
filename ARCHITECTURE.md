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
* **Decision:** Introduce dedicated `GemstoneCaratWeight` distinct from precious metal `Weight`. Enforce physical validation: $\text{grossWeight} \ge \text{netGoldWeight} + \sum \text{gemstoneWeight}$. Prohibit accepting carats as precious metal weight.

---

## 9. Security & Boundary Hardening Status

* **Credential Protection:** Provider API keys and connection credentials never enter domain entities, repository records, or API serialization DTOs.
* **IDOR Protection:** Verified in `tests/idor-security.test.ts`, `tests/pricing-tenant-isolation.test.ts`, and `tests/catalog-inventory-security.test.ts`. Cross-tenant queries or mutations for Products, Variants, Inventory Items, Locations, and Movements are strictly rejected.
* **User Enumeration Prevention:** Login failures return uniform `401 Unauthorized` ("Invalid email or password.") whether the email exists or not.
* **Credential Leakage Prevention:** DTOs never serialize `password_hash`. `PasswordHash.toString()` redacts hash contents.
* **Financial Rounding Attack Prevention:** Premature rounding is structurally prohibited; calculations preserve high-precision decimal representation.
* **Known Future Hardening Items (Deferred to Stage 23):** Distributed Redis rate limiter for login and market data quote endpoints; Multi-Factor Authentication (MFA); WebAuthn/Passkey integration.
