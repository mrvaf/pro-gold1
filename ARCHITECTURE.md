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
   - AI systems can only perform presentation, styling, or generative suggestions grounded strictly in validated domain attributes (e.g. verified 18K purity, verified 5.2g weight).
4. **Strict Multi-Tenant Isolation:** All marketplace, catalog, inventory, order, and seller operations are tenant-scoped (`storeId`, `tenantId`). Cross-tenant access is structurally prevented at both repository, database, and IAM membership levels.
5. **Mutation Safety & Idempotency:** Sensitive write operations (order placement, payment processing, inventory reservations, AI token consumption) enforce deterministic idempotency keys.

---

## 2. Layered Hexagonal Blueprint

```text
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│          Next.js App Router (React 19, Server/         │
│          Client Components, Persian RTL / En LTR)      │
│          apps/web (app/api/v1/auth/...)                │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Application Layer                    │
│      AuthService, Zod Validation, Route Handlers,      │
│      Session Cookie Configuration                      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                      Domain Layer                      │
│        Entities (User, TenantMembership, Session),     │
│        Value Objects (Email, PasswordHash, Role),      │
│        AuthorizationService, Pure Pricing Formulas     │
│        packages/core                                   │
└───────────────────────────┬────────────────────────────┘
                            │ (Defines Ports / Interfaces)
┌───────────────────────────▼────────────────────────────┐
│                   Infrastructure Layer                 │
│   PostgreSQL Drizzle Repositories & In-Memory Adapters │
│   packages/database (ScryptPasswordHasher)             │
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

### 3.3 Database Schema & Migrations
* **Migration `0002_iam_foundation.sql`:**
  - `users`: `id`, `email` (unique), `display_name`, `password_hash`, `status`, `created_at`, `updated_at`.
  - `tenant_memberships`: `id`, `tenant_id` (FK to `tenants`), `user_id` (FK to `users`), `role`, `status`, `created_at`, `updated_at`. Unique composite index on `(user_id, tenant_id)`.
  - `sessions`: `id`, `user_id` (FK to `users`), `expires_at`, `revoked_at`, `last_activity_at`, `user_agent`, `ip_address`, `created_at`. Indexes on `user_id` and `expires_at`.
* **Deletion Semantics:**
  - Deleting a tenant cascades to its memberships.
  - Deleting a user cascades to memberships and sessions (preventing orphan active sessions).

---

## 4. Architectural Decision Records (ADRs)

* **ADR-0001:** Adoption of Hexagonal Architecture & Clean Separation (Stage 1)
* **ADR-0002:** Arbitrary-Precision Financial Engine with Decimal.js (Stage 1 & 2)
* **ADR-0003:** Dedicated AI Gateway with Factual Grounding (Stage 1)
* **ADR-0004:** Multi-Tenant Data Isolation Strategy (Stage 1, 2, 3)
* **ADR-0005:** Idempotency Pattern for All State Mutations (Accepted)
* **ADR-0006:** Sequential Immutable Migrations (Stage 2: `0001`, Stage 3: `0002`)
* **ADR-0007:** Bilingual Architecture with Native RTL Support (Stage 1)
* **ADR-0008:** In-Memory Repository Testing Strategy (Stage 1, 2, 3)
* **ADR-0009:** Separation of Custom Manufacturing (RFQ) from Standard Commerce (Accepted)
* **ADR-0010:** Digital Jewelry Passport & Style DNA Extensibility (Accepted)
* **ADR-0011:** Canonical Grams and Millesimal Fineness for Precious Metal Primitives (Stage 2)
* **ADR-0012:** Drizzle ORM Schema Separation and Record-to-Entity Mappers (Stage 2)

### ADR-0013: Scrypt Key Derivation Function for Password Security
* **Status:** Accepted (Stage 3)
* **Context:** Password hashing must be memory-hard and secure against brute-force attacks. While Argon2id is standard, native C++ node-gyp bindings frequently break across diverse runtime containers.
* **Decision:** Implement `ScryptPasswordHasher` using Node.js built-in `node:crypto.scrypt` with a 16-byte random salt and `crypto.timingSafeEqual`. This provides robust memory-hard security without binary compilation failure risks.

### ADR-0014: Server-Side State-Backed Sessions with HttpOnly SameSite Cookies
* **Status:** Accepted (Stage 3)
* **Context:** Storing JWTs or authentication tokens in `localStorage` or `sessionStorage` exposes credentials to Cross-Site Scripting (XSS) extraction. Stateless JWTs also prevent immediate server-side revocation on logout.
* **Decision:** Use stateful server-side sessions backed by the database. The browser holds only an opaque, cryptographically random session token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie. Immediate revocation on logout or account suspension is enforced.

### ADR-0015: Tenant-Scoped Role Assignment and Centralized Domain Authorization
* **Status:** Accepted (Stage 3)
* **Context:** Users may belong to multiple jewelry guilds or stores with different privileges (e.g. OWNER in store A, but MEMBER in store B). Arbitrary role checks scattered across UI components cause security drift and IDOR vulnerabilities.
* **Decision:** Roles and permissions are strictly tenant-scoped via `TenantMembership`. Authorization decisions are evaluated centrally via `AuthorizationService.can(userId, tenantId, permission)`. All tenant-scoped operations must derive and verify tenant membership.

---

## 5. Security & Boundary Hardening Status

* **IDOR Protection:** Verified in `tests/idor-security.test.ts`. Cross-tenant resource queries or mutations are strictly rejected regardless of user-supplied tenant IDs.
* **User Enumeration Prevention:** Login failures return uniform `401 Unauthorized` ("Invalid email or password.") whether the email exists or not.
* **Credential Leakage Prevention:** DTOs never serialize `password_hash`. `PasswordHash.toString()` redacts hash contents.
* **Known Future Hardening Items (Deferred to Stage 23):** Distributed Redis rate limiter for login attempts; Multi-Factor Authentication (MFA); WebAuthn/Passkey integration.
