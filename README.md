# V-GOLD — Gold & Jewelry Digital Platform

> **A real, production-ready, testable, and domain-driven platform for the jewelry and gold ecosystem.**

---

## 1. Project Overview

**V-GOLD** is an enterprise-grade platform uniting physical gold craftsmanship with cutting-edge digital infrastructure. The platform spans 22 functional pillars ranging from authoritative gold pricing and inventory management to AI-driven jewelry design, 3D visualization, custom manufacturing workflows (RFQ), packaging studios, and multi-tenant marketplace commerce.

### Core Architecture Philosophy
* **Simple Outside. Sophisticated Inside.** A streamlined, elegant consumer/seller interface backed by a decoupled, strongly typed domain model.
* **Domain Independence:** The core business domain is completely isolated from HTTP frameworks, UI libraries, database ORMs, and AI provider SDKs.
* **Strict Financial Precision:** All authoritative monetary and mass calculations strictly utilize `Decimal.js`. JavaScript native floating-point math is strictly prohibited in financial paths.
* **Truthful Data & Zero Hallucination:** Gold market rates, product specifications, and AI outputs are never invented. If external providers are offline, the system reports explicit fallback/unavailable states.
* **Strict Multi-Tenancy:** Seller data is rigorously scoped and isolated at the repository, database, and IAM membership levels.

---

## 2. Master Operational Rule

### **ONE STAGE AT A TIME**
Development proceeds strictly sequentially through verified stages. Every stage follows this lifecycle:

```text
AUDIT → IMPLEMENT → TEST → TYPECHECK → BUILD → SELF-REVIEW → DOCUMENT → SNAPSHOT → STOP
```

No stage begins without an explicit prompt from the user following verification of the preceding stage's completion gate.

---

## 3. Technology Stack (Stage 3 Implemented)

* **Runtime:** Node.js 20+ (Target: Node.js 22 LTS compatibility)
* **Language:** TypeScript 5.7.x (Strict mode enabled)
* **Framework:** Next.js 15.5.x (App Router), React 19
* **Monorepo Engine:** npm Workspaces
* **Persistence:** PostgreSQL DDL Migrations & Drizzle ORM 0.39.x (Database infrastructure decoupled from domain)
* **Password Security:** Scrypt KDF with 16-byte cryptographically secure salt & constant-time verification
* **Session Security:** Server-side sessions with HttpOnly, SameSite, Secure cookies (Zero client-side token storage)
* **Testing:** Vitest 3.x (Unit, Integration, Architecture Boundaries, Security, IAM, Schema & Migrations)
* **Validation:** Zod
* **Financial & Mass Precision:** Decimal.js 10.4.x
* **Internationalization:** Persian (`fa-IR`, RTL default) & English (`en-US`, LTR)

---

## 4. Implemented Monorepo Structure

```text
├── apps/
│   └── web/                   # Next.js 15 App Router frontend & API v1 route handlers
│       ├── app/api/v1/auth/   # IAM endpoints: /register, /login, /logout, /me
│       └── lib/auth/          # AuthService & secure cookie configuration
├── packages/
│   ├── core/                  # Pure Domain foundation (no framework, DB, or HTTP dependencies)
│   │   ├── src/common/        # Result, Entity, ValueObject, EntityId, DomainError
│   │   ├── src/domain/
│   │   │   ├── finance/       # Currency, Money (Decimal.js, strict arithmetic, currency parity)
│   │   │   ├── material/      # GoldPurity (Karat/Fineness), Weight (canonical grams, mesghal, carats)
│   │   │   ├── tenant/        # Tenant, Store entities
│   │   │   ├── identity/      # ActorReference
│   │   │   ├── audit/         # AuditMetadata
│   │   │   ├── product/       # JewelryIdentity
│   │   │   └── iam/           # User, Email, PasswordHash, TenantMembership, Session, AuthorizationService
│   │   └── src/ports/         # Repository & Hasher ports (User, TenantMembership, Session, PasswordHasher)
│   ├── database/              # DB infrastructure & Drizzle ORM
│   │   ├── src/schema/        # Drizzle tables (tenants, stores, users, tenant_memberships, sessions)
│   │   ├── src/migrations/    # Numbered DDL migrations (0001_core, 0002_iam)
│   │   ├── src/repositories/  # Drizzle repositories with record-to-entity mappers
│   │   ├── src/adapters/      # In-memory test adapters enforcing tenant isolation
│   │   └── src/security/      # ScryptPasswordHasher (crypto.timingSafeEqual)
│   └── ai-gateway/            # AI Gateway abstraction (AiGatewayClient, MockAdapter, UnavailableAdapter)
├── tests/                     # 20 Vitest test suites (90 tests passed)
├── ARCHITECTURE.md            # Comprehensive architecture documentation & ADRs
├── PROJECT_STATE.md           # Current execution status & verification gates
└── ROADMAP.md                 # 26-Stage execution roadmap
```

---

## 5. Current Status

* **Current Stage:** **Stage 3 (IAM & Multi-Tenancy)**
* **Status:** **COMPLETE**
* **Next Stage:** **Stage 4 (Market Data Infrastructure)** — *Awaiting user prompt.*

---

## 6. Verified Quality Commands

```bash
# Run full Vitest test suite (90 tests passed across 20 test suites)
npm test

# Run strict TypeScript typecheck across all workspaces and tests
npm run typecheck

# Run production build for all packages and Next.js web application
npm run build
```

---

## 7. License & Compliance

Proprietary product architecture. All rights reserved.
