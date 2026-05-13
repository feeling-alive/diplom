// Мок-данные дашборда
import { t } from '../i18n'

export const users = {
  armin:  { name: 'Армин А.',  short: 'Армин А.',  color: '#FFC23C', initials: 'АA' },
  eren:   { name: 'Эрен Й.',   short: 'Эрен Й.',   color: '#3B82F6', initials: 'ЭЙ' },
  mikasa: { name: 'Микаса А.', short: 'Микаса А.', color: '#E8284C', initials: 'МА' },
  current:{ name: 'Я',         short: 'Я',         color: '#1A1A1A', initials: 'Я'  },
}

// Левый сайдбар
export const sidebarFolders = [
  { name: 'Cargo2go', badge: null },
  { name: 'Cloudz3r', badge: 2 },
  { name: 'Idioma',   badge: null },
  { name: 'Syllables',badge: null },
  { name: 'x-0b',     badge: null },
]

// KPI-карточки в Revenue ряду
export const kpiCards = [
  { id: 'topSales', kind: 'topSales', label: t.topSales, value: '72', userId: 'mikasa' },
  { id: 'bestDeal', kind: 'bestDeal', label: t.bestDeal, value: '$42,300', subtitle: 'Rolf Inc.' },
  { id: 'deals',    kind: 'metric',   label: t.deals,    value: '258', trend: { v: '↓5', positive: false } },
  { id: 'value',    kind: 'highlight',label: t.value,    value: '528k', trend: { v: '↑7.9%', positive: true } },
  { id: 'winRate',  kind: 'metric',   label: t.winRate,  value: '43%', trend: { v: '↑1.2%', positive: true } },
]

// Stacked manager bar
export const managerShares = [
  { userId: 'mikasa', amount: '$209,633', percent: 39.63 },
  { userId: 'armin',  amount: '$156,841', percent: 29.65 },
  { userId: 'eren',   amount: '$117,115', percent: 22.14 },
  { userId: 'current',amount: '$45,396',  percent: 8.58  },
]

// Список платформ (нижний левый блок)
export const platformList = [
  { id: 'dribbble',  name: 'Dribbble',  amount: '$227,459', percent: 43 },
  { id: 'instagram', name: 'Instagram', amount: '$142,823', percent: 27 },
  { id: 'behance',   name: 'Behance',   amount: '$89,935',  percent: 17 },
  { id: 'google',    name: 'Google',    amount: '$37,028',  percent: 7  },
]

// Bar chart по месяцам — данные для трёх вкладок
export const monthlyBarData = {
  revenue: [
    { month: 'Сен', a: 6800, b: 4200, c: 3100, d: 2400, label: '$6,901' },
    { month: 'Окт', a: 9500, b: 7300, c: 4800, d: 3600, label: '$11,035' },
    { month: 'Ноя', a: 7900, b: 5400, c: 4100, d: 2900, label: '$9,288' },
  ],
  leads: [
    { month: 'Сен', a: 4200, b: 3100, c: 2400, d: 1500, label: '142' },
    { month: 'Окт', a: 5400, b: 4200, c: 3100, d: 2200, label: '178' },
    { month: 'Ноя', a: 6100, b: 4800, c: 3600, d: 2700, label: '203' },
  ],
  winLoss: [
    { month: 'Сен', a: 3100, b: 2400, c: 1800, d: 1200, label: '12/8' },
    { month: 'Окт', a: 4200, b: 3300, c: 2400, d: 1800, label: '18/5' },
    { month: 'Ноя', a: 5600, b: 4500, c: 3300, d: 2400, label: '21/4' },
  ],
}

// Sales dynamic - line chart по неделям
export const salesDynamicData = [
  { week: 'Н 1',  armin: 120, mikasa: 95,  base: 80 },
  { week: 'Н 2',  armin: 145, mikasa: 100, base: 81 },
  { week: 'Н 3',  armin: 180, mikasa: 110, base: 82 },
  { week: 'Н 4',  armin: 165, mikasa: 125, base: 80 },
  { week: 'Н 5',  armin: 150, mikasa: 130, base: 83 },
  { week: 'Н 6',  armin: 175, mikasa: 140, base: 81 },
  { week: 'Н 7',  armin: 200, mikasa: 145, base: 79 },
  { week: 'Н 8',  armin: 185, mikasa: 155, base: 82 },
  { week: 'Н 9',  armin: 170, mikasa: 160, base: 83 },
  { week: 'Н 10', armin: 195, mikasa: 168, base: 81 },
  { week: 'Н 11', armin: 230, mikasa: 175, base: 81 },
  { week: 'Н 12', armin: 240, mikasa: 178, base: 82 },
]

// Менеджеры в правой таблице
export const managers = [
  {
    userId: 'armin',
    revenue: '$209,633',
    leads:   { value: 41, color: '#E8284C' },
    kpi:     '0.84',
    winRate: '31%',
    wl:      { value: 12, color: '#FFC23C' },
    other:   '29',
    badges: ['topSales', 'salesStreak', 'topReview'],
  },
  {
    userId: 'mikasa',
    revenue: '$156,841',
    leads:   { value: 54, color: '#3B82F6' },
    kpi:     '0.89',
    winRate: '39%',
    wl:      { value: 21, color: '#E8284C' },
    other:   '33',
    workPlatforms: {
      total: '$156,841',
      new: 3,
      items: [
        { id: 'dribbble',  amount: '$44,072', percent: 28.1 },
        { id: 'instagram', amount: '$54,400', percent: 14.1 },
        { id: 'google',    amount: '$8,400',  percent: 5.4  },
        { id: 'other',     amount: '$11,330', percent: 7.1  },
      ],
      overall: { percent: 45.3, amount: '$71,048' },
    },
  },
  {
    userId: 'eren',
    revenue: '$117,115',
    leads:   { value: 22, color: '#1A1A1A' },
    kpi:     '0.79',
    winRate: '32%',
    wl:      { value: 7, color: '#FFC23C' },
    other:   '15',
  },
]

// Bubble chart bubbles
export const referrerBubbles = [
  { id: 'dribbble',  size: 56, top: '20%', left: '18%' },
  { id: 'behance',   size: 40, top: '15%', left: '52%' },
  { id: 'google',    size: 46, top: '52%', left: '42%' },
  { id: 'instagram', size: 34, top: '58%', left: '72%' },
]

// Цвета платформ
export const platformColors = {
  dribbble:  '#EA4C89',
  instagram: '#E1306C',
  behance:   '#053EFF',
  google:    '#4285F4',
  other:     '#9A9A9A',
}
