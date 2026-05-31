export const env = {
  okx: {
    apiKey: import.meta.env.VITE_OKX_API_KEY ?? '',
    secretKey: import.meta.env.VITE_OKX_SECRET_KEY ?? '',
    passphrase: import.meta.env.VITE_OKX_PASSPHRASE ?? '',
    baseUrl: import.meta.env.VITE_OKX_BASE_URL ?? 'https://www.okx.com',
    wsUrl: import.meta.env.VITE_OKX_WS_URL ?? 'wss://ws.okx.com:8443/ws/v5/public',
  },
  finnhub: {
    apiKey: import.meta.env.VITE_FINNHUB_API_KEY ?? '',
    baseUrl: import.meta.env.VITE_FINNHUB_BASE_URL ?? 'https://finnhub.io/api/v1',
  },
  frankfurter: {
    baseUrl: import.meta.env.VITE_FRANKFURTER_BASE_URL ?? 'https://api.frankfurter.app',
  },
  worldBank: {
    baseUrl: import.meta.env.VITE_WORLD_BANK_BASE_URL ?? 'https://api.worldbank.org/v2',
  },
  alphaVantage: {
    apiKey: import.meta.env.VITE_ALPHA_VANTAGE_KEY ?? '',
    baseUrl: import.meta.env.VITE_ALPHA_VANTAGE_BASE_URL ?? 'https://www.alphavantage.co/query',
  },
  newsApi: {
    apiKey: import.meta.env.VITE_NEWS_API_KEY ?? '',
    baseUrl: import.meta.env.VITE_NEWS_API_BASE_URL ?? 'https://newsapi.org/v2',
  },
  groq: {
    apiKey: import.meta.env.VITE_GROQ_API_KEY ?? '',
    baseUrl: import.meta.env.VITE_GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
    model: import.meta.env.VITE_GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  },
  app: {
    name: import.meta.env.VITE_APP_NAME ?? '',
    mockMode: import.meta.env.VITE_MOCK_MODE === 'true',
  },
} as const;