import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { getCountyStats } from './api/client'
import type { CountyStats } from './api/types'
import CatalogPage from './pages/CatalogPage'
import EntryDetailPage from './pages/EntryDetailPage'
import EntryFormPage from './pages/EntryFormPage'
import MapPage from './pages/MapPage'
import StatsPage from './pages/StatsPage'

function CountyCounter() {
  const [stats, setStats] = useState<CountyStats | null>(null)

  useEffect(() => {
    getCountyStats().then(setStats).catch(() => {})
  }, [])

  if (!stats) return null
  return (
    <div className="county-counter">
      <strong>{stats.visited.toLocaleString()}</strong>
      of {stats.total.toLocaleString()} counties visited
      <strong>{stats.percent}%</strong>
    </div>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">Travel Logger</div>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Catalog
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => (isActive ? 'active' : '')}>
            Map
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : '')}>
            Stats
          </NavLink>
        </nav>
        <CountyCounter />
      </header>

      <div className="route-area">
        <Routes>
          <Route
            path="/"
            element={
              <div className="main">
                <CatalogPage />
              </div>
            }
          />
          <Route
            path="/entries/new"
            element={
              <div className="main">
                <EntryFormPage />
              </div>
            }
          />
          <Route
            path="/entries/:id"
            element={
              <div className="main">
                <EntryDetailPage />
              </div>
            }
          />
          <Route
            path="/entries/:id/edit"
            element={
              <div className="main">
                <EntryFormPage />
              </div>
            }
          />
          <Route
            path="/stats"
            element={
              <div className="main">
                <StatsPage />
              </div>
            }
          />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </div>
    </div>
  )
}
