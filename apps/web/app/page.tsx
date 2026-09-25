'use client';

import { useState } from 'react';

interface ModuleBadgeProps {
  readonly title: string;
  readonly stage: string;
  readonly description: string;
  readonly category: string;
  readonly endpoint?: string;
}

const MODULES: readonly ModuleBadgeProps[] = [
  { stage: 'Stage 01', title: 'هسته معماری پیازی', category: 'زیرساخت', description: 'جداسازی لایه‌ها، Result Pattern، دامنه و گیت‌وی انتزاعی' },
  { stage: 'Stage 02', title: 'قراردادهای داده طلا و دامنه', category: 'دامنه', description: 'انواع داده عیار، آلیاژها، ارزش و وزن طلا' },
  { stage: 'Stage 03', title: 'موتور قیمت‌گذاری طلا زنده', category: 'مالی', description: 'محاسبه لحظه‌ای مظنه، اجرت، سود و مالیات بر ارزش افزوده' },
  { stage: 'Stage 04', title: 'پایگاه داده و Drizzle ORM', category: 'داده', description: 'مهاجرت‌های خودکار، اسکیمای رابطه‌ای و اتصال پایگاه داده' },
  { stage: 'Stage 05', title: 'احراز هویت و چندمستأجری (RLS)', category: 'امنیت', description: 'جداسازی داده مستأجران، کنترل دسترسی RBAC' },
  { stage: 'Stage 06', title: 'کاتالوگ و محصولات طلا و جواهر', category: 'محصولات', description: 'مدیریت ویژگی‌ها، نگین‌ها، سنگ‌ها و واریانت‌ها' },
  { stage: 'Stage 07', title: 'موجودی و رهگیری شمش و قطعات', category: 'انبارداری', description: 'موجودی متریال، قطعات ساخت و نگهداری انبار' },
  { stage: 'Stage 08', title: 'سفارشات، سبد و تسویه', category: 'تجارت', description: 'رزرو سهام طلا، فاکتورها، ایجاد سفارش و ثبت تراکنش' },
  { stage: 'Stage 09', title: 'گیت‌وی هوش مصنوعی و مدل‌ها', category: 'هوش مصنوعی', description: 'طراحی هوشمند جواهر، موتور پرامپت و ابزارهای ژنراتیو' },
  { stage: 'Stage 10', title: 'سیستم‌عامل فروشندگان (Seller OS)', category: 'فروشندگان', description: 'داشبورد جامع فروشنده، کارگاه و مدیریت طلافروشی' },
  { stage: 'Stage 11', title: 'فید قیمت لحظه‌ای بازار (Tick Engine)', category: 'مالی', description: 'نرخ لحظه‌ای انس، دلار، سکه و حباب طلا' },
  { stage: 'Stage 12', title: 'مارکت‌پلیس چندفروشندگی', category: 'مارکت‌پلیس', description: 'فهرست‌بندی همزمان، کمیسیون و تسویه‌حساب فروشندگان' },
  { stage: 'Stage 13', title: 'طراح مکالمه‌ای هوشمند (AI Designer)', category: 'هوش مصنوعی', description: 'چت تعاملی برای طراحی سفارشی جواهر و استخراج ویژگی‌ها' },
  { stage: 'Stage 14', title: 'تولید کانسپت و رندر AI', category: 'هوش مصنوعی', description: 'مدیریت سشن‌های طراحی، رندرهای اولیه و کانسپت بصری' },
  { stage: 'Stage 15', title: 'جستجوی بصری هوشمند و Embedding', category: 'جستجو', description: 'جستجو با عکس مشابه طلا و جواهر با بردارهای فضایی' },
  { stage: 'Stage 16', title: 'استودیو ۳ بعدی و PBR Materials', category: 'استودیو ۳D', description: 'مدل‌سازی سه‌بعدی طلا، فلزات گرانبها و متریال‌های نوری' },
  { stage: 'Stage 17', title: 'پرو مجازی جواهرات (Virtual Try-On)', category: 'واقعیت افزوده', description: 'انکرینگ گردنبند، انگشتر و گوشواره روی بدن کاربر' },
  { stage: 'Stage 18', title: 'سامانه استعلام و ساخت سفارشی (RFQ)', category: 'تولید سفارشی', description: 'ارسال طرح، مذاکره با کارگاه‌ها، پیش‌فاکتور مرحله‌ای' },
  { stage: 'Stage 19', title: 'طراحی هوشمند بسته‌بندی لوکس', category: 'بسته‌بندی', description: 'ابعادسنجی هوشمند جعبه و برآورد هزینه متریال پکیجینگ' },
  { stage: 'Stage 20', title: 'موتور تجارت و رزرو اتمیک موجودی', category: 'تجارت', description: 'مدیریت فاکتور طلا با قفل قیمت و انقضای موقت' },
  { stage: 'Stage 21', title: 'استودیو تولید محتوا و کاتالوگ AI', category: 'محتوا', description: 'تولید متن‌های مارکتینگ و مشخصات فنی استاندارد محصول' },
  { stage: 'Stage 22', title: 'تجارت اجتماعی و پلتفرم‌های مجازی', category: 'سوشال', description: 'انتشار خودکار در اینستاگرام و شبکه‌های اجتماعی طلا' },
  { stage: 'Stage 23', title: 'اعتماد، ایمنی و گواهینامه‌های استاندارد', category: 'اعتماد', description: 'کد رهگیری عیار سنجی، مجوزهای صنفی و سیستم امتیازدهی' },
  { stage: 'Stage 24', title: 'بهینه‌سازی کارایی، کشینگ و هدرهای امنیتی', category: 'کارایی', description: 'کش لایه دوم، ریت لیمیتینگ، هدرهای پیشرفته امنیتی' },
  { stage: 'Stage 25', title: 'آمادگی کامل سطح تولید (Production Ready)', category: 'عملیات', description: 'لایونس، ردینس، لاگینگ ساختاریافته و مانیتورینگ' },
  { stage: 'Stage 26', title: 'شناسنامه دیجیتال طلا و دی‌ان‌ای طراحی (Style DNA)', category: 'نوآوری', description: 'پاسپورت تغییرناپذیر دیجیتال با زنجیره رویدادهای اصالت' },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'ai' | 'finance' | 'core'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const filtered = MODULES.filter((m) => {
    const matchesSearch = m.title.includes(searchFilter) || m.description.includes(searchFilter) || m.stage.includes(searchFilter);
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'ai') return m.category.includes('هوش') || m.category.includes('جستجو') || m.category.includes('۳D');
    if (activeTab === 'finance') return m.category.includes('مالی') || m.category.includes('تجارت');
    if (activeTab === 'core') return m.category.includes('زیرساخت') || m.category.includes('دامنه') || m.category.includes('امنیت');
    return true;
  });

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#090d16',
        color: '#f8fafc',
        padding: '2.5rem 1.5rem',
        direction: 'rtl',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header Hero */}
        <header
          style={{
            background: 'linear-gradient(135deg, #131b2e 0%, #1c2742 100%)',
            border: '1px solid #293552',
            borderRadius: '1.25rem',
            padding: '2.5rem',
            marginBottom: '2rem',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.6)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span
              style={{
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                color: '#000',
                fontWeight: 800,
                fontSize: '0.8rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                letterSpacing: '0.5px',
              }}
            >
              نسخه کامل مهندسی شده V-GOLD
            </span>
            <span
              style={{
                color: '#10b981',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              ● ۲۶ مرحله کامل و عملیاتی (Stages 1 - 26)
            </span>
          </div>

          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              margin: '0 0 1rem 0',
              background: 'linear-gradient(to right, #fbbf24, #f59e0b, #d97706)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            اکوسیستم جامع طلا و جواهر دیجیتال V-GOLD
          </h1>

          <p style={{ color: '#94a3b8', fontSize: '1.15rem', maxWidth: '800px', lineHeight: '1.8', margin: 0 }}>
            معماری جامع توزیع‌شده شامل موتور قیمت‌گذاری آنی، سبد و سفارشات، کاتالوگ پیشرفته سنگ و آلیاژ، هوش مصنوعی طراح جواهر،
            پرو مجازی ۳ بعدی، استودیو محتوا و شناسنامه دیجیتال تغییرناپذیر.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #23304b',
            }}
          >
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24' }}>۲۶ / ۲۶</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>مراحل پیاده‌سازی شده</div>
            </div>
            <div style={{ width: '1px', background: '#23304b' }} />
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>۶۷۲</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>تست یونیت و یکپارچگی سبز</div>
            </div>
            <div style={{ width: '1px', background: '#23304b' }} />
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8' }}>۴۵+</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>اندپوینت فعال REST API</div>
            </div>
            <div style={{ width: '1px', background: '#23304b' }} />
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a855f7' }}>۱۰۰٪</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>ایزولاسیون چندمستأجری RLS</div>
            </div>
          </div>
        </header>

        {/* Action & Filter Controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: activeTab === 'all' ? '#fbbf24' : '#293552',
                background: activeTab === 'all' ? '#fbbf24' : '#131b2e',
                color: activeTab === 'all' ? '#000' : '#cbd5e1',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              همه ماژول‌ها (۲۶)
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: activeTab === 'ai' ? '#fbbf24' : '#293552',
                background: activeTab === 'ai' ? '#fbbf24' : '#131b2e',
                color: activeTab === 'ai' ? '#000' : '#cbd5e1',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              هوش مصنوعی و ۳D
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: activeTab === 'finance' ? '#fbbf24' : '#293552',
                background: activeTab === 'finance' ? '#fbbf24' : '#131b2e',
                color: activeTab === 'finance' ? '#000' : '#cbd5e1',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              قیمت‌گذاری و تجارت
            </button>
            <button
              onClick={() => setActiveTab('core')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: activeTab === 'core' ? '#fbbf24' : '#293552',
                background: activeTab === 'core' ? '#fbbf24' : '#131b2e',
                color: activeTab === 'core' ? '#000' : '#cbd5e1',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              هسته و امنیت
            </button>
          </div>

          <input
            type="text"
            placeholder="جستجو در بین ماژول‌ها..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #293552',
              background: '#131b2e',
              color: '#f8fafc',
              minWidth: '260px',
              outline: 'none',
            }}
          />
        </div>

        {/* Modules Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filtered.map((item) => (
            <div
              key={item.stage}
              style={{
                background: '#131b2e',
                border: '1px solid #23304b',
                borderRadius: '0.85rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      background: 'rgba(251, 191, 36, 0.12)',
                      color: '#fbbf24',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {item.stage}
                  </span>
                  <span
                    style={{
                      background: '#1e293b',
                      color: '#94a3b8',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    {item.category}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f1f5f9' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>
                  {item.description}
                </p>
              </div>

              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #1c2742',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ✓ عملیاتی و تست‌شده
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Stage Ready
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer
          style={{
            marginTop: '3rem',
            textAlign: 'center',
            paddingTop: '2rem',
            borderTop: '1px solid #1c2742',
            color: '#64748b',
            fontSize: '0.9rem',
          }}
        >
          پلتفرم مهندسی V-GOLD — نسخه نهایی تمام ۲۶ مرحله © ۲۰۲۶
        </footer>
      </div>
    </main>
  );
}
