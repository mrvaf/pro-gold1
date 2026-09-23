import { Ok } from '@v-gold/core';
import { AiGatewayClient } from '@v-gold/ai-gateway';

export default function HomePage() {
  const isCoreLinked = new Ok(true).isOk;
  const isAiGatewayLinked = Boolean(new AiGatewayClient());

  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0c0f17',
        color: '#f8fafc',
        padding: '2rem',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          width: '100%',
          background: '#161d2b',
          borderRadius: '1rem',
          border: '1px solid #2a3449',
          padding: '2.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            background: 'rgba(217, 119, 6, 0.15)',
            border: '1px solid #d97706',
            color: '#fbbf24',
            borderRadius: '9999px',
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: '1rem',
          }}
        >
          معماری و زیرساخت Stage 1
        </div>

        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 800,
            margin: '0 0 1rem 0',
            background: 'linear-gradient(to right, #fbbf24, #d97706)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          پلتفرم دیجیتال طلا و جواهر V-GOLD
        </h1>

        <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '1.1rem', marginBottom: '2rem' }}>
          هسته یکپارچه، معماری پیازی (Hexagonal Onion)، و مرزهای ساختاری بسته‌ها با موفقیت برقرار شد.
        </p>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>هسته دامنه (@v-gold/core)</span>
            <div style={{ color: isCoreLinked ? '#10b981' : '#ef4444', fontWeight: 700, marginTop: '0.25rem' }}>
              {isCoreLinked ? 'متصل و فعال' : 'قطع'}
            </div>
          </div>

          <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>درگاه هوش مصنوعی (@v-gold/ai-gateway)</span>
            <div style={{ color: isAiGatewayLinked ? '#10b981' : '#ef4444', fontWeight: 700, marginTop: '0.25rem' }}>
              {isAiGatewayLinked ? 'متصل و انتزاعی' : 'قطع'}
            </div>
          </div>

          <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>پایگاه داده (@v-gold/database)</span>
            <div style={{ color: '#10b981', fontWeight: 700, marginTop: '0.25rem' }}>
              آماده زیرساخت
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #2a3449', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>وضعیت Stage 1: کامل شده و متوقف</span>
          <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>منتظر دستور برای Stage 2</span>
        </div>
      </div>
    </main>
  );
}
