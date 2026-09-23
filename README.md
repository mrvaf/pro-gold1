# V-GOLD — Gold & Jewelry Digital Platform

> **A real, production-ready, testable, and domain-driven platform for the jewelry and gold ecosystem.**

---

## 1. Project Overview

**V-GOLD** is an enterprise-grade platform uniting physical gold craftsmanship with cutting-edge digital infrastructure. The platform spans 22 functional pillars ranging from authoritative gold pricing and inventory management to AI-driven jewelry design, 3D visualization, custom manufacturing workflows (RFQ), packaging studios, and multi-tenant marketplace commerce.

### Core Architecture Philosophy
* **Simple Outside. Sophisticated Inside.** A streamlined, elegant consumer/seller interface backed by a decoupled, strongly typed domain model.
* **Domain Independence:** The core business domain is completely isolated from HTTP frameworks, UI libraries, database ORMs, and AI provider SDKs.
* **Strict Financial Precision:** All authoritative monetary and mass calculations strictly utilize `Decimal.js`. JavaScript native floating-point math is strictly forbidden in financial paths.
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

## 3. Technology Stack

* **Runtime:** Node.js 20+ (Target: Node.js 22 LTS)
* **Language:** TypeScript 5.x (Strict mode enabled)
* **Framework:** Next.js (App Router), React 19
* **Database & ORM:** PostgreSQL, Drizzle ORM (Pure DDL migrations, strict constraints)
* **Testing:** Vitest (Unit, Integration, Architecture, Contract)
* **Validation:** Zod
* **Financial Precision:** Decimal.js
* **Internationalization:** Persian (`fa-IR`, RTL default) & English (`en-US`, LTR)

---

## 4. Repository Structure (Planned Monorepo)

```text
├── apps/
│   └── web/                   # Next.js App Router frontend & API route handlers
├── packages/
│   ├── core/                  # Pure Domain logic, Entities, Value Objects, Ports, Use Cases
│   ├── database/              # Drizzle ORM schemas, migrations, PostgreSQL repositories
│   └── ai-gateway/            # AI Provider abstractions, rate-limiters, mock/real adapters
├── docs/                      # Architectural decisions, specifications, audit logs
├── tests/                     # Monorepo integration and end-to-end test suites
├── ARCHITECTURE.md            # Comprehensive architecture documentation & ADRs
├── PROJECT_STATE.md           # Current execution status & verification gates
└── ROADMAP.md                 # 26-Stage execution roadmap
```

---

## 5. Current Status

* **Current Stage:** **Stage 0 (Discovery & Foundational Architecture)**
* **Status:** **COMPLETE**
* **Next Stage:** **Stage 1 (Architecture & Monorepo Foundation)** — *Awaiting user prompt.*

---

## 6. Standard Quality Commands

Once Stage 1 initializes the package toolchain:

```bash
# Run test suite
npm test

# Run strict type checking
npm run typecheck

# Run production build
npm run build
```

---

## 7. License & Compliance

Proprietary product architecture. All rights reserved.
