import type { NewsItem } from '../types/market.types'

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'n1',
    title: 'Bitcoin преодолел $94,000 на фоне институционального спроса',
    summary:
      'Крупные институциональные инвесторы продолжают накапливать BTC. ETF-продукты зафиксировали рекордный приток $1.2 млрд за неделю.',
    source: 'CoinDesk',
    url: '#',
    publishedAt: '2026-05-13T08:30:00.000Z',
    sentiment: 'positive',
    relatedAssets: ['BTC-USDT'],
  },
  {
    id: 'n2',
    title: 'Ethereum готовится к обновлению: объём DEX вырос на 23%',
    summary:
      'Предстоящий хардфорк Ethereum обещает снижение комиссий на 40%. Объём торгов на децентрализованных биржах достиг нового максимума.',
    source: 'The Block',
    url: '#',
    publishedAt: '2026-05-13T07:15:00.000Z',
    sentiment: 'positive',
    relatedAssets: ['ETH-USDT'],
  },
  {
    id: 'n3',
    title: 'Solana обрабатывает рекордные 65,000 TPS: экосистема растёт',
    summary:
      'Сеть Solana установила новый рекорд пропускной способности. Количество активных кошельков за месяц выросло на 18%.',
    source: 'Decrypt',
    url: '#',
    publishedAt: '2026-05-13T06:00:00.000Z',
    sentiment: 'positive',
    relatedAssets: ['SOL-USDT'],
  },
  {
    id: 'n4',
    title: 'Криптобиржи ужесточают KYC-проверки в ответ на требования регуляторов',
    summary:
      'Крупнейшие централизованные биржи обновляют процедуры верификации пользователей. Регуляторы США и ЕС усиливают надзор за цифровыми активами.',
    source: 'CryptoSlate',
    url: '#',
    publishedAt: '2026-05-12T20:00:00.000Z',
    sentiment: 'neutral',
    relatedAssets: ['BTC-USDT', 'ETH-USDT'],
  },
  {
    id: 'n5',
    title: 'Apple отчёт Q4: выручка превысила прогнозы аналитиков на 4%',
    summary:
      'Квартальная выручка Apple составила $124.3 млрд, превысив ожидания рынка. Продажи iPhone выросли на 7% г/г благодаря спросу на модели с ИИ.',
    source: 'Bloomberg',
    url: '#',
    publishedAt: '2026-05-12T18:45:00.000Z',
    sentiment: 'positive',
    relatedAssets: ['AAPL'],
  },
  {
    id: 'n6',
    title: 'Microsoft Azure показывает рост 29% г/г: акции обновляют максимум',
    summary:
      'Облачный сегмент Microsoft продолжает уверенный рост. Инвестиции в ИИ-инфраструктуру окупаются ускоренным ростом корпоративных подписок.',
    source: 'Reuters',
    url: '#',
    publishedAt: '2026-05-12T15:30:00.000Z',
    sentiment: 'positive',
    relatedAssets: ['MSFT'],
  },
  {
    id: 'n7',
    title: 'S&P 500 закрылся в плюсе: инвесторы ждут данных по инфляции',
    summary:
      'Индекс широкого рынка завершил торговую сессию ростом 0.8%. Участники рынка готовятся к публикации индекса потребительских цен в четверг.',
    source: 'MarketWatch',
    url: '#',
    publishedAt: '2026-05-12T22:00:00.000Z',
    sentiment: 'neutral',
    relatedAssets: ['SPX'],
  },
  {
    id: 'n8',
    title: 'Инфляция в США снизилась до 2.4%: форекс волатильность растёт',
    summary:
      'Данные CPI оказались ниже прогнозов аналитиков. Доллар ослаб к корзине основных валют, EUR/USD и GBP/USD показали значительную волатильность.',
    source: 'FXStreet',
    url: '#',
    publishedAt: '2026-05-12T14:00:00.000Z',
    sentiment: 'neutral',
    relatedAssets: ['EUR-USD', 'GBP-USD'],
  },
  {
    id: 'n9',
    title: 'Банк Англии оставляет ставку без изменений: фунт под давлением',
    summary:
      'Монетарный комитет Банка Англии сохранил базовую ставку на уровне 4.5%. Сдержанные перспективы экономики Великобритании давят на стерлинг.',
    source: 'Financial Times',
    url: '#',
    publishedAt: '2026-05-11T12:00:00.000Z',
    sentiment: 'negative',
    relatedAssets: ['GBP-USD'],
  },
  {
    id: 'n10',
    title: 'ФРС сохраняет ставку: рынки реагируют умеренным ростом',
    summary:
      'Федеральная резервная система в очередной раз оставила ключевую ставку без изменений. Рынки позитивно восприняли сигналы о возможном смягчении в конце года.',
    source: 'CNBC',
    url: '#',
    publishedAt: '2026-05-10T20:30:00.000Z',
    sentiment: 'neutral',
    relatedAssets: ['SPX', 'EUR-USD'],
  },
]
