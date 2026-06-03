import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MarketOverview from './pages/MarketOverview'
import AssetPage from './pages/AssetPage'
import NewsPage from './pages/NewsPage'
import NewsArticlePage from './pages/NewsArticlePage'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import SubscriptionPage from './pages/SubscriptionPage'
import AdminPanelPage from './pages/AdminPanelPage'
import AppSidebar from './components/layout/AppSidebar'
import CurrencySwitcher from './components/layout/CurrencySwitcher'
import PrivateRoute from './components/layout/RoutesGuard'
import { useCurrency } from './context/CurrencyContext'

function ProtectedLayout() {
  // Subscribe to the active currency here so the entire <Outlet> subtree re-renders
  // when the user switches — every formatPrice() reflects the new currency at once.
  useCurrency()
  return (
    <PrivateRoute>
      <div className="app-page">
        <div className="app-layout">
          <AppSidebar />
          <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Floating Liquid-Glass currency switcher, top-right of the content area. */}
            <div style={{ position: 'absolute', top: 14, right: 18, zIndex: 50 }}>
              <CurrencySwitcher />
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    </PrivateRoute>
  )
}

export default function App() {
  console.debug('[App] rendering routes')
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/market" element={<MarketOverview />} />
        <Route path="/asset/:symbol" element={<AssetPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:id" element={<NewsArticlePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/admin" element={<AdminPanelPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
