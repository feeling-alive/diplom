export const USE_MOCK = (import.meta.env.VITE_MOCK_MODE as string | undefined) === 'true'

// Phase 3: FINNHUB_API_KEY / FINNHUB_BASE_URL перенесены на бэкенд.
// Активный код ходит в /api/quotes/* через vite-proxy (см. vite.config.ts).
// Ссылки на ключ сохраняются ради обратной совместимости с осиротевшим
// EconomicCalendarWidget (tree-shake'нется из bundle), но новый код их не читает.
export const ENV = {
  USE_MOCK,
  OKX_WS_URL: (import.meta.env.VITE_OKX_WS_URL as string | undefined) ?? 'wss://ws.okx.com:8443/ws/v5/public',
  /** @deprecated Finnhub-ключ больше не используется активным кодом — бэкенд владеет им. */
  FINNHUB_API_KEY: (import.meta.env.VITE_FINNHUB_API_KEY as string | undefined) ?? '',
  /** @deprecated см. FINNHUB_API_KEY. */
  FINNHUB_BASE_URL: (import.meta.env.VITE_FINNHUB_BASE_URL as string | undefined) ?? 'https://finnhub.io/api/v1',
  NEWS_API_KEY: (import.meta.env.VITE_NEWS_API_KEY as string | undefined) ?? '',
  NEWS_API_BASE_URL: (import.meta.env.VITE_NEWS_API_BASE_URL as string | undefined) ?? 'https://newsapi.org/v2',
  FRANKFURTER_BASE_URL: (import.meta.env.VITE_FRANKFURTER_BASE_URL as string | undefined) ?? 'https://api.frankfurter.app',
  GROQ_API_KEY: (import.meta.env.VITE_GROQ_API_KEY as string | undefined) ?? '',
  GROQ_BASE_URL: (import.meta.env.VITE_GROQ_BASE_URL as string | undefined) ?? 'https://api.groq.com/openai/v1',
  GROQ_MODEL: (import.meta.env.VITE_GROQ_MODEL as string | undefined) ?? 'llama-3.3-70b-versatile',
}
