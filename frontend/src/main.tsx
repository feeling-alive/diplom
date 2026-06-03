import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CurrencyProvider } from './context/CurrencyContext'

// Задача 2: котировки кэшируются в QueryClient, который переживает размонтирование
// компонентов. staleTime 30s → возврат со страницы актива в течение 30с берёт данные
// из кэша (без флэша isLoading и повторной загрузки с нуля); gcTime 5мин держит кэш
// живым после ухода со страницы. refetchOnWindowFocus off — котировки и так тикают по
// refetchInterval, лишние всплески при переключении вкладок не нужны.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)