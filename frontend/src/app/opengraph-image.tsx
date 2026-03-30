import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'サブスク払ろてる';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '52px',
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 45%, #fdba74 100%)',
          color: '#7c2d12',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            borderRadius: '40px',
            border: '2px solid rgba(124, 45, 18, 0.12)',
            background: 'rgba(255, 255, 255, 0.74)',
            boxShadow: '0 24px 60px rgba(124, 45, 18, 0.14)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              padding: '56px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '84px',
                  height: '84px',
                  borderRadius: '24px',
                  background: '#ea580c',
                  color: '#fff7ed',
                  fontSize: '44px',
                  fontWeight: 800,
                }}
              >
                ¥
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, opacity: 0.8 }}>
                サブスク管理を、ちょい気楽に。
              </div>
              <div style={{ fontSize: '64px', fontWeight: 800, lineHeight: 1.12 }}>
                サブスク払ろてる
              </div>
              <div style={{ fontSize: '28px', lineHeight: 1.5, maxWidth: '700px', color: '#9a3412' }}>
                登録なしですぐ使える、サブスクの軽量ダッシュボード。
                月額と年額の見える化、見直し管理、Google同期にも対応。
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '24px', color: '#c2410c' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '999px',
                  background: '#f97316',
                }}
              />
              haroteru.onrender.com
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              width: '340px',
              padding: '44px 36px',
              background: 'linear-gradient(180deg, rgba(251, 146, 60, 0.22) 0%, rgba(255, 247, 237, 0.4) 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                width: '100%',
              }}
            >
              {[
                { label: '月', value: '¥8,230' },
                { label: '年', value: '¥98,760' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '22px',
                    borderRadius: '24px',
                    background: 'rgba(255, 255, 255, 0.84)',
                    border: '1px solid rgba(249, 115, 22, 0.12)',
                  }}
                >
                  <div style={{ fontSize: '18px', color: '#9a3412' }}>{item.label}</div>
                  <div style={{ fontSize: '34px', fontWeight: 800 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
