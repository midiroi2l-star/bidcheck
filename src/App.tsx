import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { IndustrialMap } from './pages/IndustrialMap'
import { Monitoring } from './pages/Monitoring'
import { Alarms } from './pages/Alarms'
import { Tenants } from './pages/Tenants'
import { Equipment } from './pages/Equipment'
import { PublicData } from './pages/PublicData'
import { Reports } from './pages/Reports'
import { UsersPage } from './pages/Users'
import { Logs } from './pages/Logs'

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}

export default App
