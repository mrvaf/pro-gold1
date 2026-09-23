# V-GOLD Architecture Documentation

---

## 1. Architectural Philosophy & Guiding Principles

The architectural design of **V-GOLD** adheres to **Onion / Clean / Hexagonal Architecture** principles designed around the central mandate:

> **"Simple Outside. Sophisticated Inside."**

### Core Principles
1. **Domain Independence (The Dependency Rule):** Inner layers have zero knowledge of outer layers. Pure business logic in the domain layer has zero dependencies on React, Next.js, HTTP, cookies, databases (ORM), browser APIs, or third-party AI provider SDKs.
2. **Authoritative Financial Integrity:** Every monetary calculation (prices, gold valuations, making fees, stone values, discounts, taxes, shipping, payment amounts) and weight computation is executed server-side using arbitrary-precision arithmetic (`Decimal.js`). Floating-point operations (`number`) are strictly prohibited in financial paths.
3. **Truthful Data & Zero Hallucination:**
   - Gold market spot prices are never hallucinated; when live provider connections are unavailable, explicit `UNAVAILABLE` or deterministic `DEV/TEST` states are returned.
   - Market data answers: *"What is the externally observed market data?"*
   - Pricing engine (Stage 5) answers: *"How does V-GOLD calculate a product/customer price from market data?"*
   - AI systems can only perform presentation, styling, or generative suggestions grounded strictly in validated domain attributes (e.g. verified 18K purity, verified 5.2g weight).
4. **Strict Multi-Tenant Isolation:** All marketplace, catalog, inventory, order, and seller operations are tenant-scoped (`storeId`, `tenantId`). Cross-tenant access is structurally prevented at both repository, database, and IAM membership levels.
5. **Mutation Safety & Idempotency:** Sensitive write operations (order placement, payment processing, inventory reservations, market data ingestion) enforce deterministic idempotency.

---

## 2. Layered Hexagonal Blueprint

```text
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│          Next.js App Router (React 19, Server/         │
│          Client Components, Persian RTL / En LTR)      │
│          apps/web (api/v1/auth/..., api/v1/market-data)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Application Layer                    │
│      AuthService, MarketDataQueryService,              │
│      MarketDataIngestionService, FreshnessPolicy       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                      Domain Layer                      │
│        Entities (User, TenantMembership, Session,      │
│        MarketDataSource, MarketInstrument,             │
│        MarketObservation),                             │
│        Value Objects (Email, PasswordHash, MarketPrice)│
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

### 4.3 Provider Port & Adapter Isolation
* **Port (`MarketDataProviderPort`):** Neutral contract specifying provider capabilities (`supportedSymbols`, `supportedUnits`, `qualitiesProvided`, `isRealTime`). External SDKs, HTTP clients, and credentials never leak into core.
* **Production Default (`UnavailableMarketDataProvider`):** When no API credentials exist in the environment, returns explicit `PROVIDER_UNAVAILABLE` status (HTTP 503). Never fabricates market rates.
* **Test Adapter (`MockMarketDataProvider`):** Deterministic mock adapter strictly for automated tests, explicitly flagged `isTestOnly = true`.

### 4.4 Ingestion & Idempotency
* `MarketDataIngestionService` validates provider capabilities, checks instrument/source registration, verifies currency and unit parity, and enforces uniqueness across `(sourceId, instrumentId, observedAt)`. Duplicate ingestion returns `isDuplicate: true` without creating redundant database records.

### 4.5 Scope & Platform Nature
Precious metal market rates represent platform-global reference realities rather than tenant-specific data. Market data is stored globally and made available via `/api/v1/market-data/` endpoints, avoiding redundant per-tenant duplication while respecting authentication and rate-limiting boundaries.

---

## 5. Architectural Decision Records (ADRs)

* **ADR-0001:** Adoption of Hexagonal Architecture & Clean Separation (Stage 1)
* **ADR-0002:** Arbitrary-Precision Financial Engine with Decimal.js (Stage 1 & 2)
* **ADR-0003:** Dedicated AI Gateway with Factual Grounding (Stage 1)
* **ADR-0004:** Multi-Tenant Data Isolation Strategy (Stage 1, 2, 3)
* **ADR-0005:** Idempotency Pattern for All State Mutations (Accepted)
* **ADR-0006:** Sequential Immutable Migrations (Stage 2: `0001`, Stage 3: `0002`, Stage 4: `0003`)
* **ADR-0007:** Bilingual Architecture with Native RTL Support (Stage 1)
* **ADR-0008:** In-Memory Repository Testing Strategy (Stage 1, 2, 3, 4)
* **ADR-0009:** Separation of Custom Manufacturing (RFQ) from Standard Commerce (Accepted)
* **ADR-0010:** Digital Jewelry Passport & Style DNA Extensibility (Accepted)
* **ADR-0011:** Canonical Grams and Millesimal Fineness for Precious Metal Primitives (Stage 2)
* **ADR-0012:** Drizzle ORM Schema Separation and Record-to-Entity Mappers (Stage 2)
* **ADR-0013:** Scrypt Key Derivation Function for Password Security (Stage 3)
* **ADR-0014:** Server-Side State-Backed Sessions with HttpOnly SameSite Cookies (Stage 3)
* **ADR-0015:** Tenant-Scoped Role Assignment and Centralized Domain Authorization (Stage 3)

### ADR-0016: Market Data Provider Abstraction & Capability Model
* **Status:** Accepted (Stage 4)
* **Context:** Market data for precious metals and foreign exchange is sourced from varied international and regional providers (e.g. LBMA, CME, TGJU, central banks). Each provider has distinct capabilities, supported symbols, rate limits, and latency profiles.
* **Decision:** Decouple all external providers behind `MarketDataProviderPort`. Providers explicitly declare capabilities (`ProviderCapabilities`). External SDKs and HTTP clients remain strictly in outer adapters. When external provider credentials are not supplied, the platform falls back to `UnavailableMarketDataProvider` returning truthful unavailable states without hallucinating data.

### ADR-0017: Append-Only Immutable Market Observation History & Idempotency
* **Status:** Accepted (Stage 4)
* **Context:** External market rates fluctuate constantly. Financial auditability requires preserving exact historical tick records rather than overwriting existing records when newer rates arrive.
* **Decision:** Observations in `market_observations` are strictly append-only. Each record captures distinct `observedAt` and `ingestedAt` timestamps. Idempotency is enforced by a composite unique constraint on `(source_id, instrument_id, observed_at)`. Foreign keys referencing instruments and sources enforce `ON DELETE RESTRICT` to protect audit trails.

### ADR-0018: Strict Freshness Policy and Truthful Unavailable States
* **Status:** Accepted (Stage 4)
* **Context:** Returning the newest database row without verifying its age risks treating yesterday's market close as live pricing during high-volatility events. Silently inventing fallback prices violates V-GOLD's foundational integrity mandate.
* **Decision:** Implement `MarketDataFreshnessPolicy` with explicit maximum-age thresholds by quote quality (`REAL_TIME`: 5 mins, `DELAYED`: 30 mins, `CLOSE`: 24 hrs). Queries evaluate age and return explicit `FRESH`, `STALE`, or `UNAVAILABLE` states. UI and pricing layers must never receive stale data masquerading as fresh.

### ADR-0019: Arbitrary Decimal Precision and Unit Semantics for Precious Metals
* **Status:** Accepted (Stage 4)
* **Context:** Commodity prices span wide magnitudes—from fractional USD cents per gram to tens of millions of Iranian Rials per gram. JavaScript IEEE-754 binary floating-point numbers introduce fatal truncation and rounding drift.
* **Decision:** All market rates utilize `Decimal.js` internally, `NUMERIC(24, 8)` in PostgreSQL DDL migrations, and exact decimal strings in serialization DTOs. Storage and aggregation prohibit silent rounding. Display rounding occurs only at the final presentation boundary using explicit `ROUND_HALF_UP`.

---

## 6. Security & Boundary Hardening Status

* **Credential Protection:** Provider API keys and connection credentials never enter domain entities, repository records, or API serialization DTOs.
* **IDOR Protection:** Verified in `tests/idor-security.test.ts`. Cross-tenant resource queries or mutations are strictly rejected regardless of user-supplied tenant IDs.
* **User Enumeration Prevention:** Login failures return uniform `401 Unauthorized` ("Invalid email or password.") whether the email exists or not.
* **Credential Leakage Prevention:** DTOs never serialize `password_hash`. `PasswordHash.toString()` redacts hash contents.
* **Known Future Hardening Items (Deferred to Stage 23):** Distributed Redis rate limiter for login and market data quote endpoints; Multi-Factor Authentication (MFA); WebAuthn/Passkey integration.
