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
* **Strict Multi-Tenancy:** Seller data is rigorously scoped and isolated at the repository and database levels.

---

## 2. Master Operational Rule

### **ONE STAGE AT A TIME**
Development proceeds strictly sequentially through verified stages. Every stage follows this lifecycle:

```text
AUDIT → IMPLEMENT → TEST → TYPECHECK → BUILD → SELF-REVIEW → DOCUMENT → SNAPSHOT → STOP
```

No stage begins without an explicit prompt from the user following verification of the preceding stage's completion gate.

---

## 3. Technology Stack (Stage 1 Implemented)

* **Runtime:** Node.js 20+ (Target: Node.js 22 LTS compatibility)
* **Language:** TypeScript 5.7.x (Strict mode enabled)
* **Framework:** Next.js 15.5.x (App Router), React 19
* **Monorepo Engine:** npm Workspaces
* **Testing:** Vitest 3.x (Unit, Integration, Architecture Boundaries)
* **Financial Precision:** Decimal.js 10.4.x
* **Internationalization:** Persian (`fa-IR`, RTL default) & English (`en-US`, LTR)

---

## 4. Implemented Monorepo Structure

```text
├── apps/
│   └── web/                   # Next.js 15 App Router frontend & /api/health endpoint
├── packages/
│   ├── core/                  # Pure Domain primitives (Result, Entity, ValueObject, DomainError, Ports)
│   ├── database/              # DB infrastructure (Config, InMemoryRepository, InMemoryTenantScopedRepository)
│   └── ai-gateway/            # AI Gateway abstraction (AiGatewayClient, MockAdapter, UnavailableAdapter)
├── tests/                     # Architecture & boundary tests (Vitest)
├── ARCHITECTURE.md            # Comprehensive architecture documentation & ADRs
├── PROJECT_STATE.md           # Current execution status & verification gates
└── ROADMAP.md                 # 26-Stage execution roadmap
```

---

## 5. Current Status

* **Current Stage:** **Stage 1 (Architecture & Monorepo Foundation)**
* **Status:** **COMPLETE**
* **Next Stage:** **Stage 2 (Domain Models & Database Foundations)** — *Awaiting user prompt.*

---

## 6. Verified Quality Commands

```bash
# Run full Vitest test suite (16 tests passed across 3 test suites)
npm test

# Run strict TypeScript typecheck across all workspaces and tests
npm run typecheck

# Run production build for all packages and Next.js web application
npm run build
```

---

## 7. License & Compliance

Proprietary product architecture. All rights reserved.
