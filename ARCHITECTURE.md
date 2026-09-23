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
2. **Storage Precision:** Database persistence in PostgreSQL uses `NUMERIC(24, 8)` to ensure zero truncation across all currencies and micro-weights.
3. **Presentation Precision:** Final rounding occurs solely at the presentation boundary, formatted according to currency minor units (e.g. 2 decimal places for USD/EUR, 0 decimal places for IRR/TOMAN) using deterministic rounding modes.

### 5.2 Currency Semantics & The Toman/Rial Relationship
* **Statutory Currency (`IRR`):** Official legal and banking currency of Iran. 0 standard minor units.
* **Commercial Currency (`TOMAN`):** Commercial unit of account widely used in jewelry bazaars. 0 standard minor units.
* **Deterministic Conversion Ratio:**
  $$\text{1 Toman} = 10 \text{ Iranian Rials (Exact Decimal)}$$
  Codified in `IRR_PER_TOMAN = new Decimal(10)` and `TOMAN_PER_IRR = new Decimal(0.1)`. Conversions are executed via dedicated domain primitives `CurrencyConverter.tomanToIrr()` and `CurrencyConverter.irrToToman()`.
* **International Currencies (`USD`, `EUR`):** Fiat reference currencies with 2 standard minor units (cents).

### 5.3 Directional Foreign Exchange (FX) Rates
* **`FxRate`:** Directional value object representing:
  $$1 \text{ baseCurrency} = \text{rate} \times \text{quoteCurrency}$$
  Enforces `rate > 0` and `baseCurrency !== quoteCurrency`.
* **Inversion:** Deterministically generates the reciprocal rate:
  $$\text{inverseRate} = \frac{1}{\text{rate}}$$
  Calculated with high Decimal precision without IEEE-754 binary floating-point pollution.
* **`CurrencyConverter`:** Converts `Money` amounts across currencies via `Money(base) * FxRate(base -> quote) = Money(quote)`. Verifies base currency parity and preserves raw intermediate decimals.

### 5.4 Distinction between `MarketPrice` and `Money`
* **`MarketPrice`:** Represents an *external commodity quote per unit of mass* (e.g. $2650.50 \text{ USD} / \text{troy ounce}$ or $54,000,000 \text{ IRR} / \text{gram}$). It encapsulates a trading unit (`MarketUnitCode`).
* **`Money`:** Represents a *discrete monetary value or transaction balance* ($\text{amount} + \text{currency}$). It does not represent a unit price or physical mass.

---

## 6. Architectural Decision Records (ADRs)

* **ADR-0001:** Adoption of Hexagonal Architecture & Clean Separation (Stage 1)
* **ADR-0002:** Arbitrary-Precision Financial Engine with Decimal.js (Stage 1 & 2)
* **ADR-0003:** Dedicated AI Gateway with Factual Grounding (Stage 1)
* **ADR-0004:** Multi-Tenant Data Isolation Strategy (Stage 1, 2, 3)
* **ADR-0005:** Idempotency Pattern for All State Mutations (Accepted)
* **ADR-0006:** Sequential Immutable Migrations (Stage 2: `0001`, Stage 3: `0002`, Stage 4: `0003`, Stage 4.1: `0004`)
* **ADR-0007:** Bilingual Architecture with Native RTL Support (Stage 1)
* **ADR-0008:** In-Memory Repository Testing Strategy (Stage 1, 2, 3, 4, 4.1)
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

### ADR-0020: Three-Tier Financial Precision Architecture and Explicit Rounding Policy
* **Status:** Accepted (Stage 4.1)
* **Context:** Financial applications in gold and jewelry suffer from rounding errors when intermediate formulas round prematurely. Furthermore, different jurisdictions and currencies require different scale rules (e.g. cents in USD vs whole units in Tomans).
* **Decision:** Establish a strict Three-Tier Precision Architecture:
  1. *Calculation Precision:* Raw Decimal.js arithmetic with no rounding during intermediate computation chains.
  2. *Storage Precision:* PostgreSQL `NUMERIC(24, 8)` to store authoritative values up to 8 decimal places.
  3. *Presentation Precision:* Explicit rounding solely at the final boundary using `ROUND_HALF_UP` (or `ROUND_HALF_EVEN` where banking rules apply).

### ADR-0021: Directional Foreign Exchange (FX) Rate Modeling and Deterministic Inversion
* **Status:** Accepted (Stage 4.1)
* **Context:** Currency conversion requires knowing the exact direction of quotes (e.g. `USD/EUR` vs `EUR/USD`). Implicitly swapping base and quote currencies creates 100x errors.
* **Decision:** Model `FxRate` with explicit `baseCurrency` and `quoteCurrency` representing $1 \text{ base} = \text{rate} \times \text{quote}$. Inversion is explicitly handled via `invert()`, computing $\frac{1}{\text{rate}}$ using arbitrary precision Decimal arithmetic.

### ADR-0022: Statutory Iranian Toman vs Rial 1:10 Deterministic Conversion
* **Status:** Accepted (Stage 4.1)
* **Context:** In Iranian commerce, official accounting is maintained in Iranian Rials (IRR), while everyday jewelry pricing and buyer negotiations occur in Iranian Tomans (TOMAN). Hardcoding division or multiplication by 10 across scattered UI or controller files causes drift.
* **Decision:** Formally codify the 1:10 ratio as domain constants `IRR_PER_TOMAN = 10` and `TOMAN_PER_IRR = 0.1`. Provide first-class domain methods `CurrencyConverter.tomanToIrr()` and `CurrencyConverter.irrToToman()` that guarantee exact mathematical conversion without floating-point conversion.

---

## 7. Security & Boundary Hardening Status

* **Credential Protection:** Provider API keys and connection credentials never enter domain entities, repository records, or API serialization DTOs.
* **IDOR Protection:** Verified in `tests/idor-security.test.ts`. Cross-tenant resource queries or mutations are strictly rejected regardless of user-supplied tenant IDs.
* **User Enumeration Prevention:** Login failures return uniform `401 Unauthorized` ("Invalid email or password.") whether the email exists or not.
* **Credential Leakage Prevention:** DTOs never serialize `password_hash`. `PasswordHash.toString()` redacts hash contents.
* **Financial Rounding Attack Prevention:** Premature rounding is structurally prohibited; calculations preserve high-precision decimal representation.
* **Known Future Hardening Items (Deferred to Stage 23):** Distributed Redis rate limiter for login and market data quote endpoints; Multi-Factor Authentication (MFA); WebAuthn/Passkey integration.
