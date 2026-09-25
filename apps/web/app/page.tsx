'use client';

import { useState } from 'react';

type RoleView = 'buyer' | 'seller' | 'admin' | 'all-stages';

interface Seller {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly trustScore: number;
  readonly completedOrders: number;
  readonly activityYears: number;
  readonly badge: string;
  readonly guildVerified: boolean;
  readonly baseLaborRateG: number;
}

interface RfqProposal {
  readonly sellerId: string;
  readonly sellerName: string;
  readonly estimatedCostToman: number;
  readonly leadDays: number;
  readonly warrantyMonths: number;
  readonly trustScore: number;
}

const VERIFIED_SELLERS: readonly Seller[] = [
  {
    id: 's-101',
    name: 'زرگری و گالری سلطانی (تهران)',
    city: 'تهران، بازار بزرگ',
    trustScore: 98.4,
    completedOrders: 1420,
    activityYears: 18,
    badge: 'طلاساز برتر صنفی',
    guildVerified: true,
    baseLaborRateG: 195000,
  },
  {
    id: 's-102',
    name: 'استودیو جواهرسازی درخشان',
    city: 'اصفهان، میدان نقش جهان',
    trustScore: 96.8,
    completedOrders: 980,
    activityYears: 12,
    badge: 'متخصص ریخته‌گری ۳D',
    guildVerified: true,
    baseLaborRateG: 180000,
  },
  {
    id: 's-103',
    name: 'کارگاه زرگری آریا',
    city: 'تبریز، راسته بازار',
    trustScore: 94.2,
    completedOrders: 650,
    activityYears: 9,
    badge: 'سازنده تخصصی سرویس و نگین',
    guildVerified: true,
    baseLaborRateG: 165000,
  },
  {
    id: 's-104',
    name: 'جواهرات فاخر مشهد',
    city: 'مشهد، خسروی نو',
    trustScore: 91.5,
    completedOrders: 430,
    activityYears: 6,
    badge: 'تأیید شده اتحادیه',
    guildVerified: true,
    baseLaborRateG: 155000,
  },
];

export default function HomePage() {
  const [role, setRole] = useState<RoleView>('buyer');

  // AI RFQ Studio State
  const [aiPrompt, setAiPrompt] = useState('انگشتر طلای ۱۸ عیار زنانه، طرح اسلیمی ترنج، مزین به زمرد طبیعی و تراش برلیان');
  const [targetWeightG, setTargetWeightG] = useState(6.5);
  const [rfqCreated, setRfqCreated] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<RfqProposal | null>(null);

  // Market live price simulation
  const goldPrice18kGram = 4385000; // تومان به ازای هر گرم ۱۸ عیار

  const proposals: readonly RfqProposal[] = VERIFIED_SELLERS.map((s) => ({
    sellerId: s.id,
    sellerName: s.name,
    estimatedCostToman: Math.round((targetWeightG * goldPrice18kGram) + (targetWeightG * s.baseLaborRateG * 1.09)),
    leadDays: s.activityYears > 10 ? 5 : 8,
    warrantyMonths: 24,
    trustScore: s.trustScore,
  }));

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#090d16',
        color: '#f8fafc',
        padding: '2rem 1.5rem',
        direction: 'rtl',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        {/* Navigation Bar & Role Switcher */}
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem 1.75rem',
            background: '#131b2e',
            borderRadius: '1rem',
            border: '1px solid #23304b',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
                fontWeight: 900,
                fontSize: '1.2rem',
              }}
            >
              V
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
                پلتفرم معاملات و ساخت سفارشی V-GOLD
              </h1>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                نرخ طلا ۱۸ عیار بازار: ۴,۳۸۵,۰۰۰ تومان | ۲۶ ماژول فعال
              </span>
            </div>
          </div>

          {/* Role Switcher Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', background: '#090d16', padding: '0.3rem', borderRadius: '0.75rem', border: '1px solid #23304b' }}>
            <button
              onClick={() => setRole('buyer')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: role === 'buyer' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'transparent',
                color: role === 'buyer' ? '#000' : '#94a3b8',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              داشبورد خریدار و استودیو AI
            </button>
            <button
              onClick={() => setRole('seller')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: role === 'seller' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'transparent',
                color: role === 'seller' ? '#000' : '#94a3b8',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              داشبورد طلافروشان و سازندگان
            </button>
            <button
              onClick={() => setRole('admin')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: role === 'admin' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'transparent',
                color: role === 'admin' ? '#000' : '#94a3b8',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              پنل مدیریت کل و نظارت اتحادیه
            </button>
            <button
              onClick={() => setRole('all-stages')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: role === 'all-stages' ? '#334155' : 'transparent',
                color: role === 'all-stages' ? '#fff' : '#94a3b8',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              معماری کل (۲۶ استیج)
            </button>
          </div>
        </header>

        {/* 1. BUYER DASHBOARD & AI RFQ QUOTATION */}
        {role === 'buyer' && (
          <div>
            <div
              style={{
                background: 'linear-gradient(135deg, #131b2e 0%, #172138 100%)',
                border: '1px solid #23304b',
                borderRadius: '1.25rem',
                padding: '2rem',
                marginBottom: '2rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.3rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>
                  استودیو ساخت سفارشی طلا با هوش مصنوعی (AI RFQ Studio)
                </span>
                <span style={{ color: '#10b981', fontSize: '0.85rem' }}>● متصل به موتور استعلام قیمت زنده طلاسازان</span>
              </div>

              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#f8fafc' }}>
                طراحی جواهر با AI و استعلام قیمت همزمان از بهترین کارگاه‌ها
              </h2>
              <p style={{ color: '#94a3b8', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                طرح رویایی طلای خود را به زبان ساده بنویسید یا مشخصات را وارد کنید؛ هوش مصنوعی جزئیات ساخت را تحلیل کرده و به طلاسازان دارای مجوز اعلام می‌کند تا پیشنهاد قیمت و زمان تحویل بدهند.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    شرح طراحی و سلیقه ساخت طلا:
                  </label>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: '#090d16',
                      border: '1px solid #293552',
                      color: '#f8fafc',
                      outline: 'none',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    وزن تخمینی طلا (گرم):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={targetWeightG}
                    onChange={(e) => setTargetWeightG(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: '#090d16',
                      border: '1px solid #293552',
                      color: '#f8fafc',
                      outline: 'none',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>
                <button
                  onClick={() => setRfqCreated(true)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    color: '#000',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    height: '45px',
                  }}
                >
                  استعلام قیمت لحظه‌ای
                </button>
              </div>
            </div>

            {/* RFQ Quotations from Sellers */}
            <div style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
                  پیشنهاد قیمت کارگاه‌ها و طلافروشان تاییدشده برای این سفارش ({proposals.length} پیشنهاد)
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  مرتب‌سازی هوشمند بر اساس امتیاز اعتبار اتحادیه و کمترین اجرت
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                {proposals.map((prop) => {
                  const isSelected = selectedProposal?.sellerId === prop.sellerId;
                  return (
                    <div
                      key={prop.sellerId}
                      style={{
                        background: '#131b2e',
                        border: `2px solid ${isSelected ? '#fbbf24' : '#23304b'}`,
                        borderRadius: '1rem',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem', fontWeight: 700 }}>
                            ★ امتیاز اعتبار: {prop.trustScore} از ۱۰۰
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                            تحویل {prop.leadDays} روزه
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#fff' }}>
                          {prop.sellerName}
                        </h4>
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                          گارانتی رسمی اصالت: {prop.warrantyMonths} ماه | صدور شناسنامه دیجیتال QR
                        </div>
                        <div style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1f293d', marginBottom: '1rem' }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>قیمت تمام‌شده (طلا خام + اجرت + مالیات):</span>
                          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
                            {prop.estimatedCostToman.toLocaleString('fa-IR')} تومان
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedProposal(prop)}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          background: isSelected ? '#10b981' : '#23304b',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✓ انتخاب شده جهت صدور فاکتور' : 'انتخاب این طلاساز و ثبت سفارش'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {selectedProposal && (
                <div
                  style={{
                    marginTop: '1.5rem',
                    background: '#102a20',
                    border: '1px solid #10b981',
                    borderRadius: '0.75rem',
                    padding: '1.25rem 1.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: '#10b981', fontSize: '1.1rem' }}>
                      سفارش به {selectedProposal.sellerName} متصل شد
                    </h4>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      مبلغ نهایی: {selectedProposal.estimatedCostToman.toLocaleString('fa-IR')} تومان | همراه با قفل قیمت طلا برای ۳ دقیقه جهت واریز امن
                    </span>
                  </div>
                  <button
                    style={{
                      background: '#10b981',
                      color: '#000',
                      padding: '0.6rem 1.5rem',
                      fontWeight: 800,
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    انتقال به درگاه پرداخت و تسویه امن
                  </button>
                </div>
              )}
            </div>

            {/* Verified Sellers Directory */}
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#f1f5f9' }}>
                فهرست طلافروشان و سازندگان دارای پروانه کسب و رتبه مانیتورینگ
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
                {VERIFIED_SELLERS.map((s) => (
                  <div key={s.id} style={{ background: '#131b2e', border: '1px solid #23304b', borderRadius: '0.75rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>{s.badge}</span>
                      <span style={{ fontSize: '0.75rem', color: '#10b981' }}>تاییدیه اتحادیه ✓</span>
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#fff' }}>{s.name}</h4>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.75rem 0' }}>{s.city}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1f293d', paddingTop: '0.75rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <span>سفارش موفق: <b>{s.completedOrders}</b></span>
                      <span>سابقه: <b>{s.activityYears} سال</b></span>
                      <span>امتیاز: <b>{s.trustScore}٪</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. SELLER & GOLDSMITH DASHBOARD (Seller OS) */}
        {role === 'seller' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
              <div style={{ background: '#131b2e', border: '1px solid #23304b', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>موجودی طلای شمش و خام:</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>۴,۲۵۰ گرم</div>
              </div>
              <div style={{ background: '#131b2e', border: '1px solid #23304b', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>سفارشات در حال ساخت کارگاه:</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>۱۴ سفارش</div>
              </div>
              <div style={{ background: '#131b2e', border: '1px solid #23304b', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>استعلام‌های جدید هوش مصنوعی:</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>۸ درخواست</div>
              </div>
              <div style={{ background: '#131b2e', border: '1px solid #23304b', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>امتیاز اعتماد کارگاه (Guild):</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7', marginTop: '0.25rem' }}>۹۸.۴٪ (عالی)</div>
              </div>
            </div>

            <div style={{ background: '#131b2e', border: '1px solid #23304b', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
                مدیریت استعلام‌های ساخت جواهر ورودی (RFQ Inbox)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: '#090d16', border: '1px solid #1f293d', borderRadius: '0.5rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem' }}>#RFQ-8902:</span>
                    <span style={{ marginRight: '0.5rem', color: '#fff' }}>نیم‌ست گل رز با طلای رزگلد ۱۸ عیار و برلیان</span>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>وزن تخمینی: ۱۲.۴ گرم | خریدار: احراز هویت شده (تهران)</div>
                  </div>
                  <button style={{ background: '#fbbf24', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>
                    ارسال پیشنهاد قیمت
                  </button>
                </div>
                <div style={{ background: '#090d16', border: '1px solid #1f293d', borderRadius: '0.5rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem' }}>#RFQ-8901:</span>
                    <span style={{ marginRight: '0.5rem', color: '#fff' }}>دستبند مردانه کارتیر با طلای زرد و چرم طبیعی</span>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>وزن تخمینی: ۱۸.۲ گرم | خریدار: احراز هویت شده (اصفهان)</div>
                  </div>
                  <button style={{ background: '#23304b', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>
                    پیشنهاد ارسال شده
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. ADMIN & GOVERNANCE DASHBOARD */}
        {role === 'admin' && (
          <div style={{ background: '#131b2e', border: '1px solid #23304b', borderRadius: '1rem', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f1f5f9' }}>
              میز نظارت عالیه، احراز هویت کارگاه‌ها و پشتیبانی کل پلتفرم
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              پایش بلادرنگ عیارسنجی، بازرسی‌های صنفی، شکایات مشتریان و انطباق با قوانین پولشویی طلا
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1f293d' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8' }}>پایش عیارسنجی و ری‌گیری</h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                  تمام کد رهگیری‌های عیار ۷۵۰ به سامانه‌های استاندارد ملی متصل بوده و بدون مغایرت تایید شده‌اند.
                </p>
              </div>

              <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1f293d' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981' }}>تراکنش‌های امانی (Escrow)</h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                  وجوه خریدار در حساب امانی تا زمان تحویل فیزیکی طلا، وزن‌کشی دقیق و تایید خریدار مسدود می‌ماند.
                </p>
              </div>

              <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1f293d' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#a855f7' }}>پشتیبانی حل اختلاف ۲۴/۷</h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                  داوری آنلاین مابین طلاساز و خریدار با استناد به مدل ۳D و شناسنامه تغییرناپذیر دیجیتال محصول.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. ALL 26 STAGES OVERVIEW */}
        {role === 'all-stages' && (
          <div style={{ background: '#131b2e', border: '1px solid #23304b', borderRadius: '1rem', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
              معماری عمیق ۲۶ مرحله‌ای V-GOLD (تست‌شده و کامل)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1f293d' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>Stage 1 - 5</span>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>معماری پیازی، هسته دامنه، Drizzle ORM و چندمستأجری RLS</p>
              </div>
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1f293d' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>Stage 6 - 10</span>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>کاتالوگ سنگ و طلا، انبارداری شمش، سیستم عامل فروشنده (Seller OS)</p>
              </div>
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1f293d' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>Stage 11 - 15</span>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>مارکت‌پلیس، طراح چت AI، کانسپت ژنراتور و جستجوی بصری برداری</p>
              </div>
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1f293d' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>Stage 16 - 20</span>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>استودیو ۳D، پرو مجازی (Try-on)، استعلام RFQ و تجارت قفل قیمت</p>
              </div>
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1f293d' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>Stage 21 - 26</span>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>استودیو محتوا، اعتماد و مجوزها، پروداکشن، Style DNA و پاسپورت دیجیتال</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          پلتفرم مهندسی و جامع طلا و جواهر V-GOLD — تمام حقوق محفوظ است © ۲۰۲۶
        </footer>
      </div>
    </main>
  );
}
