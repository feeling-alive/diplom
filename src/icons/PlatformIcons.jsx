// SVG-логотипы платформ (упрощённые, без копирования официальных вариантов)
import { platformColors } from '../data/mock'

export const DribbbleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill={platformColors.dribbble}/>
    <path
      d="M8.2 3.4c2.6 3.3 4.6 6.9 5.9 10.6m-9 1c4.5-1.4 9.2-1.2 13.6.6m-5-12.2c-1.1 4-3.7 7.5-7.1 9.5"
      stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round"
    />
  </svg>
)

export const InstagramIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F58529"/>
        <stop offset="50%" stopColor="#DD2A7B"/>
        <stop offset="100%" stopColor="#8134AF"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-grad)"/>
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.4"/>
    <circle cx="17.4" cy="6.7" r="1.1" fill="#fff"/>
  </svg>
)

export const BehanceIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="20" height="20" rx="4" fill={platformColors.behance}/>
    <text x="12" y="16.5" textAnchor="middle" fontFamily="Inter, sans-serif"
          fontWeight="800" fontSize="12" fill="#fff">Bē</text>
  </svg>
)

export const GoogleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M21.4 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.3c-.23 1.2-.93 2.2-1.96 2.9v2.4h3.16c1.84-1.7 2.9-4.2 2.9-7.1z" fill="#4285F4"/>
    <path d="M12 21.5c2.6 0 4.8-.86 6.5-2.34l-3.16-2.4c-.88.6-2 .94-3.34.94-2.56 0-4.74-1.74-5.52-4.1H3.2v2.5C4.9 19.4 8.2 21.5 12 21.5z" fill="#34A853"/>
    <path d="M6.48 13.6c-.2-.6-.3-1.24-.3-1.9s.1-1.3.3-1.9V7.3H3.2C2.45 8.7 2 10.3 2 12s.45 3.3 1.2 4.7l3.28-2.4z" fill="#FBBC04"/>
    <path d="M12 5.9c1.42 0 2.7.5 3.7 1.45l2.78-2.78C16.78 2.96 14.6 2 12 2 8.2 2 4.9 4.1 3.2 7.3l3.28 2.5C7.26 7.64 9.44 5.9 12 5.9z" fill="#EA4335"/>
  </svg>
)

export const OtherIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#F0EEEE"/>
    <circle cx="8"  cy="12" r="1.3" fill="#9A9A9A"/>
    <circle cx="12" cy="12" r="1.3" fill="#9A9A9A"/>
    <circle cx="16" cy="12" r="1.3" fill="#9A9A9A"/>
  </svg>
)

export const PlatformIcon = ({ id, size = 16 }) => {
  const map = {
    dribbble:  DribbbleIcon,
    instagram: InstagramIcon,
    behance:   BehanceIcon,
    google:    GoogleIcon,
    other:     OtherIcon,
  }
  const I = map[id] || OtherIcon
  return <I size={size}/>
}
