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
│   Database Repositories & In-Memory Adapters           │
│   packages/database                                    │
│   AI Gateway Adapters & Client                         │
│   packages/ai-gateway                                  │
└────────────────────────────────────────────────────────┘
```

### Layer Responsibilities & Constraints (Enforced by Automated Tests)

| Layer | Package | Implemented Foundation | Boundary Invariant |
| :--- | :--- | :--- | :--- |
| **Domain** | `@v-gold/core` | `Result<T,E>`, `Entity`, `ValueObject`, `EntityId`, `DomainError`, `RepositoryPort`, `TenantScopedRepositoryPort`, `AiGatewayPort` | **Zero imports of React, Next.js, database drivers, ORMs, or AI provider SDKs.** Verified by AST scan in `tests/architecture.test.ts`. |
| **AI Gateway** | `@v-gold/ai-gateway` | `AiGatewayClient`, `UnavailableAiGatewayAdapter` (truthful 503 fallback), `MockAiGatewayAdapter` | Depends strictly on `@v-gold/core`. No dependence on database or presentation apps. |
| **Database** | `@v-gold/database` | `DatabaseConfig`, `InMemoryRepository`, `InMemoryTenantScopedRepository` | Depends strictly on `@v-gold/core`. No dependence on AI gateway or presentation apps. |
| **Presentation** | `@v-gold/web` | Next.js 15 App Router, React 19, RTL root layout, `/api/health` handler | Entrypoint orchestrating packages. Never bypasses repository or domain boundaries. |

---

## 3. Monorepo Package Topology (Stage 1 Implemented)

```text
v-gold/
├── apps/
│   └── web/                   # Next.js 15+ / React 19 web application
│       ├── app/               # App Router pages and /api/health handler
│       ├── next.config.ts     # Package transpilation configuration
│       └── tsconfig.json      # Bundler module resolution configuration
├── packages/
│   ├── core/                  # Pure Domain foundation
│   │   ├── src/common/        # Result, Entity, ValueObject, EntityId, Errors
│   │   ├── src/ports/         # RepositoryPort, TenantScopedRepositoryPort, AiGatewayPort
│   │   ├── dist/              # Compiled ESM modules and TypeScript declarations
│   │   └── package.json       # Pure dependencies (decimal.js only)
│   ├── database/              # Persistence foundation
│   │   ├── src/config.ts      # Database configuration & environment parser
│   │   ├── src/in-memory-store.ts # In-memory repository adapters (single-tenant & tenant-scoped)
│   │   └── dist/              # Compiled ESM modules and TypeScript declarations
│   └── ai-gateway/            # AI Gateway abstraction
│       ├── src/client.ts      # AiGatewayClient router
│       ├── src/adapters/      # UnavailableAiGatewayAdapter (503) & MockAiGatewayAdapter
│       └── dist/              # Compiled ESM modules and TypeScript declarations
├── tests/                     # Architecture & boundary verification suites
├── ARCHITECTURE.md            # Master architecture manual
├── PROJECT_STATE.md           # Live progress tracker
└── ROADMAP.md                 # 26-Stage execution roadmap
```

---

## 4. Domain Modeling & Financial Precision

### 4.1 Monetary & Mass Value Objects
Authoritative financial values must never be stored or manipulated as standard IEEE 754 floating-point numbers (`number`).
* `Money`: Encapsulates an arbitrary-precision `Decimal` value and an ISO-4217 / domestic currency code (e.g. `IRR`, `USD`, `EUR`).
* `Weight`: Encapsulates an arbitrary-precision `Decimal` gram weight, constrained by positive minimum bounds (e.g. 3 decimal places precision for milligrams: `0.001g`).
* `Purity`: Encapsulates gold karat/fineness (e.g., `750` for 18K, `875` for 21K, `999.9` for 24K).

### 4.2 Gold Pricing Formula Specification
The pricing engine evaluates product and order item prices using strictly server-side authoritative formulas:

$$\text{Base Gold Value} = \text{Weight (grams)} \times \frac{\text{Fineness}}{750} \times \text{Spot Price of 18K (per gram)}$$

$$\text{Making Fee} = \begin{cases} 
\text{Base Gold Value} \times \frac{\text{Fee Percentage}}{100} & \text{(Percentage Mode)} \\
\text{Weight (grams)} \times \text{Fee Per Gram} & \text{(Fixed Per Gram Mode)}
\end{cases}$$

$$\text{Subtotal} = \text{Base Gold Value} + \text{Making Fee} + \text{Stone Value} + \text{Seller Margin}$$

$$\text{Tax (VAT)} = (\text{Making Fee} + \text{Seller Margin}) \times \text{Tax Rate}$$
*(Note: Iranian tax law exempts the raw gold value from VAT, taxing only making fees and margins).*

$$\text{Final Price} = \text{Subtotal} + \text{Tax} + \text{Packaging Fee} - \text{Discounts} + \text{Shipping Fee}$$

Every sub-operation is calculated via `Decimal.js` with deterministic rounding modes (`ROUND_HALF_UP`).

---

## 5. Multi-Tenancy & Data Isolation

* **Tenant Isolation Invariant:** Every seller entity (products, inventory, orders, RFQs, packaging profiles) belongs to a distinct `storeId`.
* **Repository Enforcement:** Verified in Stage 1 tests (`tests/foundation-boundaries.test.ts`), `TenantScopedRepositoryPort` mandates `storeId` in all operations. Store A cannot read, query, or mutate Store B's data.

---

## 6. AI Gateway Abstraction

The AI subsystem is strictly encapsulated behind an **AI Gateway Port**:
1. **Zero Direct SDK Usage:** Domain and UI components never import `@anthropic-ai/sdk`, `openai`, or any third-party AI package.
2. **Provider Contract:** The application interacts only with `AiGatewayClient`:
   ```typescript
   export interface AiGatewayPort {
     executePrompt(
       request: AiPromptRequest
     ): Promise<Result<AiPromptResponse, AiProviderUnavailableError | DomainError>>;
   }
   ```
3. **Resilience & Truthful Fallback:** When external provider credentials are absent, `AiGatewayClient` routes to `UnavailableAiGatewayAdapter`, returning an explicit domain error (`AiProviderUnavailableError`, HTTP 503) rather than fabricating responses.

---

## 7. Persistence & Migration Discipline

* **PostgreSQL as Source of Truth:** Scheduled for Stage 2.
* **In-Memory Adapters for Tests:** `InMemoryRepository` and `InMemoryTenantScopedRepository` implemented in `@v-gold/database` allow comprehensive unit and domain testing without external database dependencies.

---

## 8. Architectural Decision Records (ADRs)

* **ADR-0001:** Adoption of Hexagonal Architecture & Clean Separation (Implemented in Stage 1)
* **ADR-0002:** Arbitrary-Precision Financial Engine with Decimal.js (Integrated in Stage 1)
* **ADR-0003:** Dedicated AI Gateway with Factual Grounding (Implemented in Stage 1)
* **ADR-0004:** Multi-Tenant Data Isolation Strategy (Implemented in Stage 1)
* **ADR-0005:** Idempotency Pattern for All State Mutations (Accepted)
* **ADR-0006:** Sequential Immutable Migrations (Accepted, begins Stage 2)
* **ADR-0007:** Bilingual Architecture with Native RTL Support (Implemented in Stage 1 layout)
* **ADR-0008:** In-Memory Repository Testing Strategy (Implemented in Stage 1)
* **ADR-0009:** Separation of Custom Manufacturing (RFQ) from Standard Commerce (Accepted)
* **ADR-0010:** Digital Jewelry Passport & Style DNA Extensibility (Accepted)

---

## 9. Security & Boundary Verification

Automated boundary test suite in `tests/architecture.test.ts` asserts:
1. No UI/framework dependencies in `@v-gold/core`.
2. No database drivers or ORMs in `@v-gold/core`.
3. No AI vendor SDKs in `@v-gold/core`.
4. Monorepo dependency topology validity.
