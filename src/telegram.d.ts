// Глобальные типы для Telegram WebApp
// Этот файл автоматически подхватывается TypeScript во всём проекте

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  colorScheme: 'light' | 'dark'
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
  }
  platform: string
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export {}