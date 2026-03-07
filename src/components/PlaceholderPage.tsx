import { useNavigate } from 'react-router-dom'

interface PlaceholderPageProps {
  icon: string
  title: string
  description: string
  color: string
  comingSoon?: string[]
}

export default function PlaceholderPage({
  icon, title, description, color, comingSoon = []
}: PlaceholderPageProps) {
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#1a1a1a' : '#f0f2f5',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        background: isDark ? '#242424' : '#fff',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: isDark ? '#333' : '#f0f2f5',
            border: 'none',
            borderRadius: 10,
            width: 36,
            height: 36,
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </button>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: isDark ? '#fff' : '#000',
        }}>
          {icon} {title}
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{
          width: 100,
          height: 100,
          borderRadius: 28,
          background: `${color}22`,
          border: `2px solid ${color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          marginBottom: 24,
        }}>
          {icon}
        </div>

        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: isDark ? '#fff' : '#1a1a1a',
          marginBottom: 8,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 14,
          color: isDark ? '#666' : '#999',
          marginBottom: 32,
          maxWidth: 260,
        }}>
          {description}
        </div>

        {comingSoon.length > 0 && (
          <div style={{
            background: isDark ? '#242424' : '#fff',
            borderRadius: 16,
            padding: '16px 20px',
            width: '100%',
            maxWidth: 320,
            textAlign: 'left',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: isDark ? '#555' : '#bbb',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 12,
            }}>
              Будет здесь
            </div>
            {comingSoon.map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderTop: i > 0 ? `1px solid ${isDark ? '#333' : '#f0f2f5'}` : 'none',
                fontSize: 14,
                color: isDark ? '#aaa' : '#555',
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />
                {item}
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: 24,
          padding: '8px 16px',
          background: `${color}22`,
          border: `1px solid ${color}44`,
          borderRadius: 20,
          fontSize: 12,
          color: color,
          fontWeight: 600,
        }}>
          🚧 В разработке
        </div>
      </div>
    </div>
  )
}