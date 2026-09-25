# V-GOLD — 2026-09-24 Integrity Audit

* **Audit date:** 2026-09-24
* **Scope:** Full repository against the 385-test baseline — API route handlers, authentication & tenancy boundaries, persistence, ID generation, password KDF, gold purity semantics, and documentation accuracy.
* **Baseline:** tree `a075b8c3d798d24732883eed596917b68a6987b6` (restored workspace — byte-identical to original head `ddec6719edb54c8a584adf486cbf6b383c21c220` plus the workspace backup zip).
* **Status:** Findings recorded below. The API authentication issue is scheduled for remediation in Stage 8.1.

## Routes without authentication (12)

The following routes take `tenantId` (and `actorId` on write operations) from the query/body and do not check the session:

- `/api/v1/catalog/products`
- `/api/v1/catalog/products/[id]`
- `/api/v1/catalog/variants`
- `/api/v1/inventory/items`
- `/api/v1/inventory/items/[id]/transition`
- `/api/v1/inventory/locations`
- `/api/v1/inventory/movements`
- `/api/v1/listings/[id]`
- `/api/v1/pricing/calculate`
- `/api/v1/sellers`
- `/api/v1/sellers/[id]`
- `/api/v1/sellers/[id]/listings`

Live witness: `POST /api/v1/inventory/locations` without a cookie for an arbitrary tenant → **201**. (The seller-os endpoints are healthy — they correctly return **401**.)

## خلاصه‌ی audit

- امنیت: ۱۲ route بالا بدون احراز هویت‌اند و tenantId/actorId را از درخواست می‌گیرند؛ تأیید زنده: 201 بدون cookie. endpointهای seller-os سالم‌اند (401).
- ۲۶ از ۳۳ route پیام خام خطا را برمی‌گردانند.
- داده‌ها در حافظه (in-memory) نگه داشته می‌شوند؛ در کل تاریخچه هیچ‌وقت درایور PostgreSQL نصب نشده.
- شناسه‌ها با Math.random/Date.now ساخته می‌شوند. scrypt با N=2^14 است (حداقل OWASP: 2^17). fineness عیار ۲۲ = 916.6.
- مستندات: وضعیت Stage 5 از Stage 1 به‌روز نشده بود؛ 175/39 شمارش قبل از audit Stage 4.1 بود؛ ادعای «bilingual layout» از ابتدا درست نبود.
- سالم: 385/385 تست، typecheck، build، مرزهای معماری، دقت مالی (decimal.js)، cookie نشست طبق مشخصات، بدون secret. restore بایت‌به‌بایت با commit اصلی ddec671 یکی است.
