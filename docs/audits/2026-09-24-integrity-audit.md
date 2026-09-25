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

- امنیت: ۱۲ route بالا بدون احراز هویت‌اند و tenantId/actorId را از درخواست می‌گیرند؛ تأیید زنده: 201 بدون cookie. endpointهای seller-os سالم‌اند (401). **رفع شد (Stage 8.1 — ADR-0041):** هویت فقط از نشست `vgold_session`؛ ورودی tenantId/actorId → 400؛ ماتریس منفی ۲۰ method × ۷ سناریو در `tests/api-auth-hardening.test.ts`؛ تأیید زنده: همه‌ی ۱۲ route بدون cookie → 401.
- ۲۶ از ۳۳ route پیام خام خطا را برمی‌گردانند. **رفع شد (Stage 8.1 — ADR-0042):** mapper مشترک `toErrorResponse`؛ خطای ناشناخته → INTERNAL_ERROR عمومی + لاگ بدون secret/PII؛ هیچ route پیام خام `error.message` برنمی‌گرداند.
- داده‌ها در حافظه (in-memory) نگه داشته می‌شوند؛ در کل تاریخچه هیچ‌وقت درایور PostgreSQL نصب نشده. **ثبت تصمیم (Stage 8.2 — ADR-0046):** موتور هدف PostgreSQL؛ اتصال واقعی، migration امن و RLS در Stage 8.3 پیش از مرحله‌ی ۹.
- شناسه‌ها با Math.random/Date.now ساخته می‌شوند. scrypt با N=2^14 است (حداقل OWASP: 2^17). fineness عیار ۲۲ = 916.6. **رفع شد (Stage 8.2 — ADR-0043/0044/0045):** شناسه‌ها UUIDv7 از پورت واحد `IdGenerator` با CSPRNG (هر ۱۲ نقطه + mock؛ حذف کامل Math.random/Date.now از تولید شناسه). scrypt پیش‌فرض N=2^17 با maxmem محاسباتی، env با کف امن، خواندن پارامتر از خود hash (سازگاری hashهای قدیمی N=16384) و ارتقای شفاف hash بعد از login موفق. fineness عیار ۲۲ = 916 (ISO 9202؛ اثر قیمتی ≈ −۰.۰۶۵۵٪).
- مستندات: وضعیت Stage 5 از Stage 1 به‌روز نشده بود؛ 175/39 شمارش قبل از audit Stage 4.1 بود؛ ادعای «bilingual layout» از ابتدا درست نبود.
- سالم: 385/385 تست، typecheck، build، مرزهای معماری، دقت مالی (decimal.js)، cookie نشست طبق مشخصات، بدون secret. restore بایت‌به‌بایت با commit اصلی ddec671 یکی است.
