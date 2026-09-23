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
└───────────────────────────┬────────────────────────────┘
                            │ (Defines Ports / Interfaces)
┌───────────────────────────▼────────────────────────────┐
│                   Infrastructure Layer                 │
│   Database Repositories (Drizzle ORM / PostgreSQL),    │
│   AI Gateway Adapters, External Market Provider Ports, │
│   In-Memory Test Adapters, Unit of Work                │
└────────────────────────────────────────────────────────┘
```

### Layer Responsibilities & Constraints

| Layer | Responsibility | Allowed Dependencies | Prohibited Dependencies |
| :--- | :--- | :--- | :--- |
| **Domain** | Core business rules, entities, value objects, domain logic, pure calculations | Zero external dependencies (only `decimal.js`) | Next.js, React, Drizzle, SQL, HTTP, AI SDKs |
| **Application** | Use case orchestration, transactions, workflow management, ports definition | Domain layer, utility libraries | UI frameworks, database drivers directly |
| **Infrastructure** | Database access (Drizzle/Postgres), external APIs, AI gateway adapters, in-memory mocks | Application interfaces (ports), database clients, vendor SDKs | UI components |
| **Presentation** | Next.js routes, API handlers, React components, view state | Application use cases, validation schemas (Zod) | Database repositories directly, private domain internals |

---

## 3. Monorepo Package Topology

```text
v-gold/
├── apps/
│   └── web/                   # Next.js 15+ / React 19 web application
│       ├── app/               # App Router pages and /api/v1 handlers
│       ├── components/        # UI components (RTL/LTR accessible)
│       └── lib/               # App-level utilities & session bindings
├── packages/
│   ├── core/                  # Pure Domain & Application layers
│   │   ├── src/
│   │   │   ├── domain/        # Entities, Value Objects, Domain Services
│   │   │   ├── application/   # Use cases, Commands, Queries, DTOs
│   │   │   └── ports/         # Repository & Gateway interfaces
│   ├── database/              # Persistence infrastructure
│   │   ├── src/
│   │   │   ├── schema/        # Drizzle ORM schema definitions
│   │   │   ├── migrations/    # Numbered sequential SQL migrations (0001_...)
│   │   │   ├── repositories/  # PostgreSQL repository implementations
│   │   │   └── adapters/      # In-memory test adapters
│   └── ai-gateway/            # AI Gateway & Provider infrastructure
│       ├── src/
│       │   ├── client/        # Gateway client interface
│       │   ├── providers/     # Adapters (Anthropic, OpenAI, Local, Mock)
│       │   └── schemas/       # Structured generation contracts
├── tests/                     # Integration, architecture, and E2E test suites
├── docs/                      # Technical specifications & ADR records
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
* **Repository Enforcement:** Every repository query requiring tenant context mandates `storeId` as an explicit parameter in the method signature (e.g., `findByStore(storeId: StoreId, id: EntityId)`).
* **Database Level Constraints:** Compound foreign keys and indices enforce tenant integrity:
  ```sql
  CONSTRAINT fk_inventory_store FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id)
  ```

---

## 6. AI Gateway Abstraction

The AI subsystem is strictly encapsulated behind an **AI Gateway Port**:
1. **Zero Direct SDK Usage:** Domain and UI components never import `@anthropic-ai/sdk`, `openai`, or any third-party AI package.
2. **Provider Contract:** The application interacts only with `AiGatewayClient`:
   ```typescript
   interface AiGatewayPort {
     generateJewelryConcept(prompt: ConceptPrompt, constraints: DomainConstraints): Promise<Result<ConceptOutput, AiError>>;
     generateContent(prompt: ContentPrompt): Promise<Result<ContentOutput, AiError>>;
     generatePackagingDesign(specs: PackagingSpecs): Promise<Result<PackagingOutput, AiError>>;
   }
   ```
3. **Factual Grounding Guardrails:** The gateway validates that any generated output adheres strictly to factual domain inputs. The AI is prevented from inventing karat specs, certified weights, or metal alloys.
4. **Resilience & Fallback:** When external provider keys are absent or services are degraded, the gateway returns explicit domain errors (`AiProviderUnavailableError`), triggering clean UI 503/fallback states rather than mocked or deceptive results.

---

## 7. Persistence & Migration Discipline

* **PostgreSQL as Source of Truth:** All transactions, state machines, and relational graphs reside in PostgreSQL.
* **Numbered Migrations:** DDL changes are tracked via strictly sequential SQL migrations:
  ```text
  0001_core_iam.sql
  0002_stores_and_products.sql
  ...
  ```
* **No Destructive History Modification:** Existing migrations are immutable. Schema evolutions are strictly additive.
* **Unit of Work & In-Memory Adapters:** Repository interfaces are mirrored by in-memory adapters, guaranteeing fast, deterministic unit test execution without requiring a live database for pure business invariant validation.

---

## 8. Architectural Decision Records (ADRs)

### ADR-0001: Adoption of Hexagonal Architecture & Clean Separation
* **Status:** Accepted
* **Context:** The platform spans complex domains (financial pricing, custom manufacturing, AI design, multi-tenant commerce). Coupling domain logic to Next.js or Drizzle would create tight coupling and test fragility.
* **Decision:** Enforce strict onion layer boundaries. Core domain has zero dependencies on external frameworks or databases.

### ADR-0002: Arbitrary-Precision Financial Engine with Decimal.js
* **Status:** Accepted
* **Context:** Gold pricing depends on fractional milligrams and currency values that quickly encounter IEEE 754 floating-point errors (e.g., `0.1 + 0.2 !== 0.3`).
* **Decision:** All monetary and mass calculations must use `Decimal.js`. Native JavaScript `number` is restricted to non-authoritative metrics and UI display after formatting.

### ADR-0003: Dedicated AI Gateway with Factual Grounding
* **Status:** Accepted
* **Context:** AI generation must not hallucinate jewelry hallmarks, weights, or pricing.
* **Decision:** Introduce an isolated AI Gateway package with strong typing, schema validation, and fallback mechanisms. Domain invariants are checked before and after all AI interactions.

### ADR-0004: Multi-Tenant Data Isolation Strategy
* **Status:** Accepted
* **Context:** V-GOLD supports independent jewelry sellers and manufacturers sharing a unified platform.
* **Decision:** Enforce tenant isolation via required `storeId` boundaries across all repositories, route handlers, and database constraints.

### ADR-0005: Idempotency Pattern for All State Mutations
* **Status:** Accepted
* **Context:** Network latency or client retries during order placement, reservations, or payments could cause duplicate orders or payments.
* **Decision:** Mandate client-supplied or system-generated idempotency keys for all mutating commerce and financial API endpoints.

### ADR-0006: Sequential Immutable Migrations
* **Status:** Accepted
* **Context:** Database schema drift and destructive migration rewrites cause production corruption.
* **Decision:** Enforce sequentially numbered SQL migrations (`0001_...sql`) managed via Drizzle ORM, validated by schema registry tests.

### ADR-0007: Bilingual Architecture with Native RTL Support
* **Status:** Accepted
* **Context:** The primary market operates in Persian (`fa-IR`, RTL), with international expansion in English (`en-US`, LTR).
* **Decision:** Native RTL/LTR support built into layout and typography systems, maintaining factual data parity across translations.

### ADR-0008: In-Memory Repository Testing Strategy
* **Status:** Accepted
* **Context:** Database-dependent unit tests are slow, flaky, and hard to run in lightweight CI/CD sandboxes.
* **Decision:** Implement pure in-memory adapters for all repository ports, enabling high-speed, 100% deterministic domain test suites.

### ADR-0009: Separation of Custom Manufacturing (RFQ) from Standard Commerce
* **Status:** Accepted
* **Context:** Bespoke jewelry manufacturing involves multi-step quoting, 3D asset reviews, and milestone payments that differ from off-the-shelf catalog carts.
* **Decision:** Separate the Custom Manufacturing RFQ aggregate and workflows from the standard catalog cart/order aggregate.

### ADR-0010: Digital Jewelry Passport & Style DNA Extensibility
* **Status:** Accepted
* **Context:** Future capabilities require modeled user preferences (Style DNA) and product provenance (Digital Passport).
* **Decision:** Model foundational domain entities with extensible metadata interfaces today, without faking or prematurely claiming live implementation.

---

## 9. Security & Trust Architecture

1. **Session & Cookie Security:** HttpOnly, Secure, SameSite cookies. No authentication tokens in `localStorage`.
2. **Access Control (RBAC & ABAC):** Granular permissions for Customers, Sellers, Goldsmiths/Manufacturers, and Platform Admins.
3. **Input Sanitization & Validation:** All incoming requests are validated at API boundaries via Zod schemas before reaching application use cases.
4. **Data Protection:** Financial histories and audit logs are append-only. Passwords and credentials use industry-standard hashing (Argon2id/Bcrypt). Secrets are never checked into version control or logged.
