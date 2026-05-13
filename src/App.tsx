import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MarketOverview from './pages/MarketOverview'

export default function App() {
  console.debug('[App] rendering routes')
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/market" element={<MarketOverview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
