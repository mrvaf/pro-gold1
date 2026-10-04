'use client';

import { useState } from 'react';

type MainTab = 'showcase' | 'ai-studio' | 'sellers' | 'seller-dashboard' | 'admin-governance';

interface GoldProduct {
  readonly id: string;
  readonly title: string;
  readonly category: 'انگشتر' | 'دستبند' | 'گردنبند' | 'سرویس' | 'گوشواره' | 'شمش';
  readonly weightG: number;
  readonly karat: number;
  readonly wagePercent: number; // درصد اجرت
  readonly sellerName: string;
  readonly sellerCity: string;
  readonly guildCode: string;
  readonly imageUrl: string;
  readonly inStock: boolean;
  readonly isSpecialOffer?: boolean;
}

interface SellerProfile {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly address: string;
  readonly phone: string;
  readonly licenseNumber: string;
  readonly trustScore: number;
  readonly completedOrders: number;
  readonly activityYears: number;
  readonly specialities: readonly string[];
  readonly guildVerified: boolean;
  readonly canTakeCustomOrders: boolean;
}

const LIVE_GOLD_18K_PRICE = 4385000; // تومان به ازای هر گرم طلای ۱۸ عیار

const INITIAL_PRODUCTS: readonly GoldProduct[] = [
  {
    id: 'GP-101',
    title: 'دستبند النگویی طرح کارتیر لاو (Cartier Love)',
    category: 'دستبند',
    weightG: 14.2,
    karat: 18,
    wagePercent: 12,
    sellerName: 'گالری و زرگری سلطانی',
    sellerCity: 'تهران',
    guildCode: 'T-98214',
    imageUrl: 'https://images.unsplash.com/photo-1611591475870-6577573d8272?auto=format&fit=crop&w=600&q=80',
    inStock: true,
    isSpecialOffer: true,
  },
  {
    id: 'GP-102',
    title: 'انگشتر تک نگین سولیتر برلیان پاک شناسنامه‌دار',
    category: 'انگشتر',
    weightG: 4.8,
    karat: 18,
    wagePercent: 16,
    sellerName: 'جواهرسازی درخشان اصفهان',
    sellerCity: 'اصفهان',
    guildCode: 'ESF-4412',
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
    inStock: true,
  },
  {
    id: 'GP-103',
    title: 'گردنبند زنانه طلا زرد طرح ون‌کلیف با صدف طبیعی',
    category: 'گردنبند',
    weightG: 8.5,
    karat: 18,
    wagePercent: 14,
    sellerName: 'زرگری آریا تبریز',
    sellerCity: 'تبریز',
    guildCode: 'TBZ-7731',
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
    inStock: true,
    isSpecialOffer: true,
  },
  {
    id: 'GP-104',
    title: 'سرویس طلا عروس طرح اسلیمی فیوژن بدون نگین',
    category: 'سرویس',
    weightG: 28.6,
    karat: 18,
    wagePercent: 10,
    sellerName: 'گالری فاخر مشهد',
    sellerCity: 'مشهد',
    guildCode: 'MSH-1290',
    imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80',
    inStock: true,
  },
  {
    id: 'GP-105',
    title: 'گوشواره آویز طرح اشک با طلای سفید و تراش لیزری',
    category: 'گوشواره',
    weightG: 5.3,
    karat: 18,
    wagePercent: 15,
    sellerName: 'گالری و زرگری سلطانی',
    sellerCity: 'تهران',
    guildCode: 'T-98214',
    imageUrl: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=600&q=80',
    inStock: true,
  },
  {
    id: 'GP-106',
    title: 'پلاک شمش طلای سوئیسی استاندارد عیار ۲۴ (PAMP)',
    category: 'شمش',
    weightG: 10.0,
    karat: 24,
    wagePercent: 4,
    sellerName: 'صرافی و سکه طلای امین',
    sellerCity: 'تهران',
    guildCode: 'T-11029',
    imageUrl: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=600&q=80',
    inStock: true,
  },
];

const VERIFIED_SELLERS: readonly SellerProfile[] = [
  {
    id: 's-101',
    name: 'زرگری و گالری سلطانی',
    city: 'تهران',
    address: 'تهران، بازار بزرگ، سرای خرد، پلاک ۲۴',
    phone: '۰۲۱-۵۵۶۲۳۴۸۹',
    licenseNumber: 'اتحادیه تهران: ۹۸۲۱۴-T',
    trustScore: 98.7,
    completedOrders: 1840,
    activityYears: 22,
    specialities: ['طلا دست‌ساز', 'النگو و دستبند', 'فیوژن بدون نگین'],
    guildVerified: true,
    canTakeCustomOrders: true,
  },
  {
    id: 's-102',
    name: 'استودیو جواهرسازی درخشان اصفهان',
    city: 'اصفهان',
    address: 'اصفهان، میدان نقش جهان، بازار قیصریه، پاساژ عتیق',
    phone: '۰۳۱-۳۲۲۱۸۷۶۵',
    licenseNumber: 'اتحادیه اصفهان: ۴۴۱۲-ESF',
    trustScore: 97.4,
    completedOrders: 1120,
    activityYears: 14,
    specialities: ['مخراج‌کاری برلیان', 'ریخته‌گری ۳D', 'سنگ‌های قیمتی شناسنامه‌دار'],
    guildVerified: true,
    canTakeCustomOrders: true,
  },
  {
    id: 's-103',
    name: 'زرگری آریا تبریز',
    city: 'تبریز',
    address: 'تبریز، راسته بازار امیر، کوچه زرگران، پلاک ۸',
    phone: '۰۴۱-۳۵۲۶۱۹۴۰',
    licenseNumber: 'اتحادیه تبریز: ۷۷۳۱-TBZ',
    trustScore: 95.1,
    completedOrders: 780,
    activityYears: 11,
    specialities: ['سرویس عروس', 'تراش لیزری دقیق', 'طراحی مینیمال'],
    guildVerified: true,
    canTakeCustomOrders: true,
  },
  {
    id: 's-104',
    name: 'جواهرات فاخر مشهد',
    city: 'مشهد',
    address: 'مشهد، خیابان خسروی نو، مجتمع طلای کوثر، واحد ۱۲',
    phone: '۰۵۱-۳۲۲۴۹۸۰۱',
    licenseNumber: 'اتحادیه مشهد: ۱۲۹۰-MSH',
    trustScore: 93.8,
    completedOrders: 590,
    activityYears: 8,
    specialities: ['انگشترهای فاخر', 'نگین عقیق و فیروزه نیشابور'],
    guildVerified: true,
    canTakeCustomOrders: false,
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTab>('showcase');
  const [selectedCity, setSelectedCity] = useState<string>('همه شهرها');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [reservationModalItem, setReservationModalItem] = useState<GoldProduct | null>(null);
  const [reservedSuccessCode, setReservedSuccessCode] = useState<string | null>(null);

  // AI RFQ Studio State
  const [aiDesignStyle, setAiDesignStyle] = useState('انگشتر سولیتر نامزدی مدرن با پایه رزگلد و تراش زمرد با ۴ چنگک نگهدارنده');
  const [aiUserCity, setAiUserCity] = useState('تهران');
  const [aiEstimatedWeight, setAiEstimatedWeight] = useState(5.5);
  const [rfqSubmitted, setRfqSubmitted] = useState(false);
  const [selectedWorkshopQuote, setSelectedWorkshopQuote] = useState<string | null>(null);

  // Calculate official gold price according to legal guidelines
  // Price = (Weight * RawGoldPrice) * (1 + Wage% + 7% Profit) + 10% VAT on (Wage+Profit)
  const calculateExactGoldPrice = (weightG: number, wagePercent: number, karat = 18): number => {
    const rawPrice = (weightG * LIVE_GOLD_18K_PRICE) * (karat / 18);
    const wageAmount = rawPrice * (wagePercent / 100);
    const profitAmount = (rawPrice + wageAmount) * 0.07;
    const vatAmount = (wageAmount + profitAmount) * 0.10; // مالیات فقط بر اجرت و سود
    return Math.round(rawPrice + wageAmount + profitAmount + vatAmount);
  };

  const filteredProducts = INITIAL_PRODUCTS.filter((p) => {
    if (selectedCity !== 'همه شهرها' && p.sellerCity !== selectedCity) return false;
    if (selectedCategory !== 'همه' && p.category !== selectedCategory) return false;
    return true;
  });

  const handleMakeReservation = (product: GoldProduct) => {
    const randomCode = 'VG-' + Math.floor(100000 + Math.random() * 900000);
    setReservedSuccessCode(randomCode);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#070a11',
        color: '#f8fafc',
        direction: 'rtl',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 1. TOP LIVE TICKER & TRUST BAR */}
      <div
        style={{
          background: 'linear-gradient(90deg, #131a29 0%, #0d131f 100%)',
          borderBottom: '1px solid #1f2a3f',
          padding: '0.6rem 1.5rem',
          fontSize: '0.85rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            مظنه زنده طلای ۱۸ عیار: {LIVE_GOLD_18K_PRICE.toLocaleString('fa-IR')} تومان/گرم
          </span>
          <span style={{ color: '#94a3b8' }}>| انس جهانی: ۲,۶۵۴ دلار</span>
          <span style={{ color: '#94a3b8' }}>| سکه امامی طرح جدید: ۵۳,۴۵۰,۰۰۰ تومان</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
          <span style={{ color: '#10b981' }}>🛡 ضمانت اصالت فیزیکی و فاکتور رسمی اتحادیه</span>
          <span>پشتیبانی مرکزی: ۰۲۱-۹۱۰۰۸۸۷۷</span>
        </div>
      </div>

      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '1.5rem' }}>
        
        {/* 2. MAIN BRAND HEADER & NAVIGATION */}
        <header
          style={{
            background: 'linear-gradient(135deg, #121929 0%, #172238 100%)',
            border: '1px solid #23314d',
            borderRadius: '1.25rem',
            padding: '1.25rem 2rem',
            marginBottom: '2rem',
            boxShadow: '0 20px 35px -10px rgba(0,0,0,0.5)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '3.2rem',
                height: '3.2rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: '1.6rem',
              }}
            >
              V
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#f8fafc', letterSpacing: '-0.5px' }}>
                  اکوسیستم معاملات و طراحی طلا V-GOLD
                </h1>
                <span style={{ background: '#f59e0b', color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                  نسخه تجاری رسمی
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                سامانه هوشمند معرفی ویترین طلافروشان دارای جواز کسب + استودیو سفارش ساخت با هوش مصنوعی
              </p>
            </div>
          </div>

          {/* MAIN TABS NAVIGATION */}
          <nav style={{ display: 'flex', gap: '0.4rem', background: '#090d16', padding: '0.35rem', borderRadius: '0.85rem', border: '1px solid #23314d' }}>
            <button
              onClick={() => setActiveTab('showcase')}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '0.6rem',
                border: 'none',
                background: activeTab === 'showcase' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'transparent',
                color: activeTab === 'showcase' ? '#000' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              💎 ویترین طلاهای آماده خرید
            </button>
            <button
              onClick={() => setActiveTab('ai-studio')}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '0.6rem',
                border: 'none',
                background: activeTab === 'ai-studio' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'transparent',
                color: activeTab === 'ai-studio' ? '#000' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              ✨ استودیو طراحی AI و ساخت سفارشی
            </button>
            <button
              onClick={() => setActiveTab('sellers')}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '0.6rem',
                border: 'none',
                background: activeTab === 'sellers' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'transparent',
                color: activeTab === 'sellers' ? '#000' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              🏛 طلافروشان و کارگاه‌های تاییدشده
            </button>
            <button
              onClick={() => setActiveTab('seller-dashboard')}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '0.6rem',
                border: 'none',
                background: activeTab === 'seller-dashboard' ? '#1e293b' : 'transparent',
                color: activeTab === 'seller-dashboard' ? '#38bdf8' : '#94a3b8',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
            >
              📦 پنل طلافروش (Seller OS)
            </button>
            <button
              onClick={() => setActiveTab('admin-governance')}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '0.6rem',
                border: 'none',
                background: activeTab === 'admin-governance' ? '#1e293b' : 'transparent',
                color: activeTab === 'admin-governance' ? '#a855f7' : '#94a3b8',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
            >
              ⚖️ نظارت اتحادیه و احراز
            </button>
          </nav>
        </header>

        {/* ============================================================== */}
        {/* TAB 1: LUXURY JEWELRY SHOWCASE (READY-TO-BUY IN SHOPS)        */}
        {/* ============================================================== */}
        {activeTab === 'showcase' && (
          <div>
            {/* Filter Bar */}
            <div
              style={{
                background: '#101624',
                border: '1px solid #1f2a3f',
                borderRadius: '1rem',
                padding: '1.25rem 1.75rem',
                marginBottom: '2rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>انتخاب شهر شما:</span>
                {['همه شهرها', 'تهران', 'اصفهان', 'مشهد', 'تبریز'].map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '0.5rem',
                      border: '1px solid',
                      borderColor: selectedCity === city ? '#f59e0b' : '#23314d',
                      background: selectedCity === city ? 'rgba(245, 158, 11, 0.15)' : '#161f31',
                      color: selectedCity === city ? '#fbbf24' : '#cbd5e1',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      fontWeight: selectedCity === city ? 700 : 500,
                    }}
                  >
                    📍 {city}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>دسته‌بندی:</span>
                {['همه', 'دستبند', 'انگشتر', 'گردنبند', 'سرویس', 'گوشواره', 'شمش'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '0.5rem',
                      border: '1px solid',
                      borderColor: selectedCategory === cat ? '#38bdf8' : '#23314d',
                      background: selectedCategory === cat ? 'rgba(56, 189, 248, 0.15)' : '#161f31',
                      color: selectedCategory === cat ? '#38bdf8' : '#cbd5e1',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      fontWeight: selectedCategory === cat ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.75rem' }}>
              {filteredProducts.map((p) => {
                const totalPrice = calculateExactGoldPrice(p.weightG, p.wagePercent, p.karat);
                return (
                  <div
                    key={p.id}
                    style={{
                      background: '#121827',
                      border: '1px solid #1f2b40',
                      borderRadius: '1.15rem',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                      transition: 'transform 0.2s, border-color 0.2s',
                    }}
                  >
                    {/* Image and Badges */}
                    <div style={{ position: 'relative', height: '240px', background: '#0a0e17' }}>
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '0.4rem' }}>
                        <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fbbf24', padding: '0.25rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 700, backdropFilter: 'blur(6px)' }}>
                          عیار {p.karat}
                        </span>
                        {p.isSpecialOffer && (
                          <span style={{ background: '#ef4444', color: '#fff', padding: '0.25rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            اجرت استثنایی
                          </span>
                        )}
                      </div>
                      <div style={{ position: 'absolute', bottom: '12px', right: '12px' }}>
                        <span style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#cbd5e1', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.75rem' }}>
                          موجود در: {p.sellerCity}
                        </span>
                      </div>
                    </div>

                    {/* Content Details */}
                    <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            فروشگاه: <strong style={{ color: '#fff' }}>{p.sellerName}</strong>
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>جواز: {p.guildCode} ✓</span>
                        </div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f8fafc', lineHeight: '1.5' }}>
                          {p.title}
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#090d16', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid #1a2336', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ color: '#64748b' }}>وزن دقیق:</span> <strong>{p.weightG} گرم</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>اجرت ساخت:</span> <strong style={{ color: '#fbbf24' }}>{p.wagePercent}٪</strong>
                          </div>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>قیمت محاسبه‌شده با نرخ لحظه‌ای:</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.2rem' }}>
                            {totalPrice.toLocaleString('fa-IR')} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>تومان</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            (شامل طلای خام + اجرت + ۷٪ سود صنفی + مالیات قانونی بر اجرت)
                          </span>
                        </div>
                      </div>

                      {/* Action Button: Reserve & Visit */}
                      <button
                        onClick={() => {
                          setReservationModalItem(p);
                          handleMakeReservation(p);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '0.6rem',
                          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                          color: '#000',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        🔖 دریافت کد رزرو و خرید حضوری در مغازه
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: AI JEWELRY STUDIO & SMART RFQ MANUFACTURING             */}
        {/* ============================================================== */}
        {activeTab === 'ai-studio' && (
          <div>
            <div
              style={{
                background: 'linear-gradient(135deg, #131a2c 0%, #19253d 100%)',
                border: '1px solid #233352',
                borderRadius: '1.25rem',
                padding: '2.5rem',
                marginBottom: '2.5rem',
              }}
            >
              <div style={{ display: 'inline-block', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 800, marginBottom: '1rem' }}>
                طراحی شخصی‌سازی شده با هوش مصنوعی + استعلام هوشمند قیمت ساخت
              </div>

              <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 1rem 0', color: '#f8fafc' }}>
                جواهر اختصاصی خود را بسازید؛ استعلام قیمت از نزدیک‌ترین و متخصص‌ترین کارگاه‌ها
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.8', maxWidth: '850px', margin: '0 0 2rem 0' }}>
                مدل رویایی طلای خود را بنویسید؛ هوش مصنوعی جزئیات ۳ بعدی آن را استخراج کرده و به کارگاه‌های طلاسازی شهر شما ارسال می‌کند.
                اگر طرح فوق‌تخصصی باشد و کارگاه شهر شما تجهیزاتش را نداشته باشد، به کارگاه‌های تخصصی تهران و اصفهان ارجاع داده شده و برای تحویل به نزدیک‌ترین طلافروشی شهر شما ارسال می‌شود!
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 200px auto', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    شرح سلیقه، مدل و جزئیات طراحی شما:
                  </label>
                  <input
                    type="text"
                    value={aiDesignStyle}
                    onChange={(e) => setAiDesignStyle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.6rem',
                      background: '#090d16',
                      border: '1px solid #293956',
                      color: '#f8fafc',
                      outline: 'none',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    شهر محل سکونت شما:
                  </label>
                  <select
                    value={aiUserCity}
                    onChange={(e) => setAiUserCity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.6rem',
                      background: '#090d16',
                      border: '1px solid #293956',
                      color: '#f8fafc',
                      outline: 'none',
                      fontSize: '0.95rem',
                    }}
                  >
                    <option value="تهران">تهران</option>
                    <option value="اصفهان">اصفهان</option>
                    <option value="مشهد">مشهد</option>
                    <option value="تبریز">تبریز</option>
                    <option value="شیراز">شیراز</option>
                    <option value="سایر شهرها">سایر شهرها</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    وزن تخمینی مورد نظر (گرم):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={aiEstimatedWeight}
                    onChange={(e) => setAiEstimatedWeight(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.6rem',
                      background: '#090d16',
                      border: '1px solid #293956',
                      color: '#f8fafc',
                      outline: 'none',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>

                <button
                  onClick={() => setRfqSubmitted(true)}
                  style={{
                    padding: '0.85rem 1.75rem',
                    borderRadius: '0.6rem',
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    color: '#000',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🚀 استعلام و ساخت کانسپت
                </button>
              </div>
            </div>

            {/* AI Generated Concept & Multi-Workshop Quotes */}
            {rfqSubmitted && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                  {/* Concept Preview */}
                  <div style={{ background: '#121827', border: '1px solid #1f2b40', borderRadius: '1rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#fbbf24' }}>
                      کانسپت هوش مصنوعی استخراج‌شده:
                    </h3>
                    <img
                      src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80"
                      alt="AI Jewelry Concept"
                      style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '0.6rem', marginBottom: '1rem' }}
                    />
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.7' }}>
                      <div>• <strong>سبک:</strong> سولیتر ۴ چنگک کلاسیک</div>
                      <div>• <strong>آلیاژ:</strong> طلای ۱۸ عیار رزگلد (۷۵۰)</div>
                      <div>• <strong>تراش نگین:</strong> امرالد کات (تراش زمردی)</div>
                      <div>• <strong>تطابق با عیار استاندارد:</strong> ۱۰۰٪ منطبق با کد اتحادیه</div>
                    </div>
                  </div>

                  {/* Workshop Quotes */}
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#f8fafc' }}>
                      پیشنهادهای قیمت ساخت از کارگاه‌های سازنده:
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Quote 1: Local Workshop */}
                      <div
                        style={{
                          background: selectedWorkshopQuote === 'q1' ? 'rgba(16, 185, 129, 0.1)' : '#121827',
                          border: `2px solid ${selectedWorkshopQuote === 'q1' ? '#10b981' : '#1f2b40'}`,
                          borderRadius: '1rem',
                          padding: '1.25rem 1.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                            <span style={{ background: '#10b981', color: '#000', fontSize: '0.75rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                              کارگاه محلی شهر شما ({aiUserCity})
                            </span>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>زرگری و گالری سلطانی (اعتبار ۹۸.۷٪)</span>
                          </div>
                          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>ساخت کامل با ریخته‌گری دقیق و تحویل حضوری در مغازه</h4>
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                            مدت ساخت: ۴ روز کاری | گارانتی تعویض و ری‌گیری رسمی
                          </span>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fbbf24' }}>
                            {calculateExactGoldPrice(aiEstimatedWeight, 13).toLocaleString('fa-IR')} تومان
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>اجرت ۱۳٪</span>
                          <div style={{ marginTop: '0.5rem' }}>
                            <button
                              onClick={() => setSelectedWorkshopQuote('q1')}
                              style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                background: selectedWorkshopQuote === 'q1' ? '#10b981' : '#23314d',
                                color: '#fff',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {selectedWorkshopQuote === 'q1' ? '✓ انتخاب شد' : 'انتخاب این کارگاه'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quote 2: Specialized Hub (Tehran / Isfahan) */}
                      <div
                        style={{
                          background: selectedWorkshopQuote === 'q2' ? 'rgba(16, 185, 129, 0.1)' : '#121827',
                          border: `2px solid ${selectedWorkshopQuote === 'q2' ? '#10b981' : '#1f2b40'}`,
                          borderRadius: '1rem',
                          padding: '1.25rem 1.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                            <span style={{ background: '#38bdf8', color: '#000', fontSize: '0.75rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                              قطب تخصصی ریخته‌گری ۳D (اصفهان)
                            </span>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>استودیو جواهر درخشان (اعتبار ۹۷.۴٪)</span>
                          </div>
                          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>ساخت با دستگاه پرینتر رزینی سه‌بعدی و تراش میکرو</h4>
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                            تحویل در نزدیک‌ترین طلافروشی معتمد شهر شما ({aiUserCity}) جهت وزن‌کشی حضوری
                          </span>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fbbf24' }}>
                            {calculateExactGoldPrice(aiEstimatedWeight, 11).toLocaleString('fa-IR')} تومان
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>اجرت رقابتی ۱۱٪</span>
                          <div style={{ marginTop: '0.5rem' }}>
                            <button
                              onClick={() => setSelectedWorkshopQuote('q2')}
                              style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                background: selectedWorkshopQuote === 'q2' ? '#10b981' : '#23314d',
                                color: '#fff',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {selectedWorkshopQuote === 'q2' ? '✓ انتخاب شد' : 'انتخاب این کارگاه'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedWorkshopQuote && (
                      <div style={{ marginTop: '1.5rem', background: '#0e231b', border: '1px solid #10b981', padding: '1.25rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#10b981', fontWeight: 800 }}>سفارش ساخت به کارگاه منتخب ابلاغ شد!</div>
                          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                            کد رزرو اختصاصی برای شما پیامک شد. بدون نیاز به پرداخت آنلاین کل مبلغ طلا؛ تسویه حساب نهایی روی کارتخوان طلافروشی در لحظه تحویل انجام می‌گیرد.
                          </div>
                        </div>
                        <span style={{ background: '#10b981', color: '#000', padding: '0.5rem 1.25rem', fontWeight: 800, borderRadius: '0.5rem' }}>
                          ثبت سفارش بدون ریسک ✓
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: VERIFIED SELLERS DIRECTORY                             */}
        {/* ============================================================== */}
        {activeTab === 'sellers' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                شبکه سراسری طلافروشان و سازندگان تاییدشده اتحادیه
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                تمام واحدهای صنفی حاضر در V-GOLD دارای پروانه کسب فعال، کد استاندارد ری‌گیری و امتیاز مانیتورینگ صنفی می‌باشند.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
              {VERIFIED_SELLERS.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: '#121827',
                    border: '1px solid #1f2b40',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.25rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 800 }}>
                        ★ رتبه اعتبار: {s.trustScore} از ۱۰۰
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{s.city}</span>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                      {s.name}
                    </h3>

                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                      📍 {s.address}
                    </div>

                    <div style={{ background: '#090d16', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1a2336', marginBottom: '1rem', fontSize: '0.8rem' }}>
                      <div style={{ color: '#64748b' }}>شماره جواز صنفی: <strong style={{ color: '#cbd5e1' }}>{s.licenseNumber}</strong></div>
                      <div style={{ color: '#64748b', marginTop: '0.2rem' }}>تلفن تماس: <strong style={{ color: '#cbd5e1' }}>{s.phone}</strong></div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>تخصص‌های کارگاه:</span>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                        {s.specialities.map((spec) => (
                          <span key={spec} style={{ background: '#1e293b', color: '#94a3b8', padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.75rem' }}>
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #1c273e', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <span>سفارشات موفق: <b>{s.completedOrders}</b></span>
                    <span>سابقه: <b>{s.activityYears} سال</b></span>
                    <span style={{ color: s.canTakeCustomOrders ? '#10b981' : '#f59e0b' }}>
                      {s.canTakeCustomOrders ? 'پذیرش ساخت سفارشی ✓' : 'فقط فروش ویترین'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: SELLER OS (JEWELER MANAGEMENT DASHBOARD)               */}
        {/* ============================================================== */}
        {activeTab === 'seller-dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                  سیستم‌عامل فروشندگان و سازندگان طلا (Seller OS)
                </h2>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
                  مدیریت موجودی ویترین، رزروهای مشتریان و استعلام‌های سفارش ساخت هوش مصنوعی
                </p>
              </div>
              <button
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  color: '#000',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                + افزودن طلای جدید به ویترین فروشگاه
              </button>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div style={{ background: '#121827', border: '1px solid #1f2b40', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>موجودی طلای بارگذاری‌شده در ویترین:</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.25rem' }}>۳,۴۸۰ گرم</div>
              </div>
              <div style={{ background: '#121827', border: '1px solid #1f2b40', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>رزروهای حضوری امروز مشتریان:</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginTop: '0.25rem' }}>۷ فاکتور</div>
              </div>
              <div style={{ background: '#121827', border: '1px solid #1f2b40', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>استعلام‌های ساخت باز (RFQ):</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.25rem' }}>۱۲ استعلام</div>
              </div>
              <div style={{ background: '#121827', border: '1px solid #1f2b40', padding: '1.25rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>شناسنامه‌های دیجیتال QR صادرشده:</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a855f7', marginTop: '0.25rem' }}>۴۵۰ شناسنامه</div>
              </div>
            </div>

            {/* Recent In-store Reservations */}
            <div style={{ background: '#121827', border: '1px solid #1f2b40', borderRadius: '1rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#f8fafc' }}>
                فهرست مشتریان در انتظار مراجعه به مغازه (با کد رزرو)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: '#090d16', border: '1px solid #1c273e', borderRadius: '0.5rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.9rem' }}>کد رزرو: VG-849201</span>
                    <div style={{ color: '#fff', fontSize: '0.95rem', marginTop: '0.2rem' }}>دستبند النگویی طرح کارتیر لاو (۱۴.۲ گرم)</div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>مشتری: علیرضا محمدی | مهلت مراجعه: تا فردا ساعت ۲۰:۰۰</span>
                  </div>
                  <button style={{ background: '#10b981', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 800, cursor: 'pointer' }}>
                    تایید تحویل حضوری و صدور شناسنامه QR
                  </button>
                </div>

                <div style={{ background: '#090d16', border: '1px solid #1c273e', borderRadius: '0.5rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.9rem' }}>کد رزرو: VG-773190</span>
                    <div style={{ color: '#fff', fontSize: '0.95rem', marginTop: '0.2rem' }}>انگشتر سولیتر برلیان پاک شناسنامه‌دار (۴.۸ گرم)</div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>مشتری: سارا کاظمی | مهلت مراجعه: تا پایان امروز</span>
                  </div>
                  <button style={{ background: '#10b981', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 800, cursor: 'pointer' }}>
                    تایید تحویل حضوری و صدور شناسنامه QR
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: ADMIN & UNION GOVERNANCE (RISK-FREE COMPLIANCE)         */}
        {/* ============================================================== */}
        {activeTab === 'admin-governance' && (
          <div style={{ background: '#121827', border: '1px solid #1f2b40', borderRadius: '1.25rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
              میز نظارت عالیه، احراز هویت طلافروشان و تطابق با ضوابط قانونی
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '2rem' }}>
              معماری تجاری بدون تصدی‌گری مالی (Non-Custodial Architecture) جهت سلب هرگونه مسئولیت سرقت، هک کیف پول و مالیات مستقیم
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ background: '#090d16', border: '1px solid #1c273e', padding: '1.5rem', borderRadius: '0.75rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '1.1rem' }}>عدم تصدی وجوه (Zero Financial Liability)</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.7', margin: 0 }}>
                  پلتفرم V-GOLD هیچ‌گونه درگاه دریافت مستقیم میلیاردی یا کیف پول ذخیره طلا ندارد. کلیه تسویه‌ها به صورت حضوری روی کارتخوان‌های رسمی ثبت‌شده در سازمان امور مالیاتی متعلق به واحد صنفی انجام می‌گیرد.
                </p>
              </div>

              <div style={{ background: '#090d16', border: '1px solid #1c273e', padding: '1.5rem', borderRadius: '0.75rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#10b981', fontSize: '1.1rem' }}>کدهای استاندارد عیار ۷۵۰ (T-Mark)</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.7', margin: 0 }}>
                  فروشندگان بدون ارائه شماره ثبت ری‌گیری و تاییدیه سالانه اتحادیه طلا و جواهر، اجازه نمایش در ویترین را نخواهند داشت.
                </p>
              </div>

              <div style={{ background: '#090d16', border: '1px solid #1c273e', padding: '1.5rem', borderRadius: '0.75rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#a855f7', fontSize: '1.1rem' }}>شناسنامه دیجیتال رمزنگاری‌شده (Digital Passport)</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.7', margin: 0 }}>
                  هر طلای تحویل‌شده دارای یک برچسب QR یکتا با امضای دیجیتال است که وزن دقیق، درصد اجرت، نام کارگاه و تاریخ صدور را بدون امکان جعل ثبت می‌کند.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* RESERVATION SUCCESS MODAL */}
      {reservationModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#131a29',
              border: '1px solid #23314d',
              borderRadius: '1.25rem',
              maxWidth: '540px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                  fontSize: '2rem',
                }}
              >
                ✓
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                کد رزرو خرید حضوری در طلافروشی صادر شد
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                این طلا به مدت ۲۴ ساعت برای شما در گالری رزرو شد تا شخصاً آن را بررسی و وزن‌کشی کنید.
              </p>
            </div>

            <div style={{ background: '#090d16', border: '1px dashed #f59e0b', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>کد رهگیری اختصاصی رزرو شما:</span>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fbbf24', letterSpacing: '2px', marginTop: '0.25rem' }}>
                {reservedSuccessCode}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
                این کد را به همراه کارت شناسایی به طلافروش نشان دهید
              </span>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.8', marginBottom: '1.75rem', background: '#0e1422', padding: '1rem', borderRadius: '0.5rem' }}>
              <div>• <strong>کالا:</strong> {reservationModalItem.title}</div>
              <div>• <strong>فروشگاه:</strong> {reservationModalItem.sellerName} ({reservationModalItem.sellerCity})</div>
              <div>• <strong>وزن:</strong> {reservationModalItem.weightG} گرم طلا ۱۸ عیار</div>
              <div>• <strong>نحوه تسویه:</strong> پرداخت ۱۰۰٪ امن روی کارتخوان مغازه در لحظه تحویل فیزیکی کالا</div>
            </div>

            <button
              onClick={() => setReservationModalItem(null)}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '0.6rem',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                color: '#000',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              متوجه شدم و بستن پنجره
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid #1a2336',
          marginTop: '4rem',
          padding: '2.5rem 1.5rem',
          background: '#0a0d16',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <strong>پلتفرم تجاری طلا و جواهر V-GOLD</strong> — سامانه رسمی معرفی و استعلام ساخت طلا
          </div>
          <div>
            کلیه معاملات به صورت حضوری و در چارچوب ضوابط اتحادیه طلا و جواهر کشور انجام می‌گیرد.
          </div>
        </div>
      </footer>
    </main>
  );
}
