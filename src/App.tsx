import { lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const IndustrialMap = lazy(() => import('./pages/IndustrialMap').then((m) => ({ default: m.IndustrialMap })))
const Monitoring = lazy(() => import('./pages/Monitoring').then((m) => ({ default: m.Monitoring })))
const Alarms = lazy(() => import('./pages/Alarms').then((m) => ({ default: m.Alarms })))
const Tenants = lazy(() => import('./pages/Tenants').then((m) => ({ default: m.Tenants })))
const Equipment = lazy(() => import('./pages/Equipment').then((m) => ({ default: m.Equipment })))
const PublicData = lazy(() => import('./pages/PublicData').then((m) => ({ default: m.PublicData })))
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })))
const UsersPage = lazy(() => import('./pages/Users').then((m) => ({ default: m.UsersPage })))
const Logs = lazy(() => import('./pages/Logs').then((m) => ({ default: m.Logs })))

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<IndustrialMap />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/alarms" element={<Alarms />} />
          <Route path="/public-data" element={<PublicData />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
