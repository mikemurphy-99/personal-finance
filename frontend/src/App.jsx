import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Repeat, Settings, PieChart } from 'lucide-react'
import Accounts from './pages/Accounts'
import AccountRegister from './pages/AccountRegister'
import Recurring from './pages/Recurring'
import SettingsPage from './pages/Settings'
import Reports from './pages/Reports'

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors
         ${isActive 
           ? 'text-emerald-400 bg-emerald-500/10' 
           : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'}`
      }
    >
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-surface-800 dark:bg-surface-950/90">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              $
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-surface-100">Finance</h1>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-200 text-slate-900 dark:bg-surface-800 dark:text-surface-100' : 'text-slate-600 hover:text-slate-900 dark:text-surface-400 dark:hover:text-surface-200'
                }`
              }
            >
              Accounts
            </NavLink>
            <NavLink
              to="/recurring"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-200 text-slate-900 dark:bg-surface-800 dark:text-surface-100' : 'text-slate-600 hover:text-slate-900 dark:text-surface-400 dark:hover:text-surface-200'
                }`
              }
            >
              Recurring
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-200 text-slate-900 dark:bg-surface-800 dark:text-surface-100' : 'text-slate-600 hover:text-slate-900 dark:text-surface-400 dark:hover:text-surface-200'
                }`
              }
            >
              Reports
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-200 text-slate-900 dark:bg-surface-800 dark:text-surface-100' : 'text-slate-600 hover:text-slate-900 dark:text-surface-400 dark:hover:text-surface-200'
                }`
              }
            >
              Settings
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24 sm:pb-6">
        <Routes>
          <Route path="/" element={<Accounts />} />
          <Route path="/account/:id" element={<AccountRegister />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-surface-800 bg-surface-950/95 backdrop-blur-md">
        <div className="flex justify-around py-2">
          <NavItem to="/" icon={LayoutDashboard} label="Accounts" />
          <NavItem to="/recurring" icon={Repeat} label="Recurring" />
          <NavItem to="/reports" icon={PieChart} label="Reports" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </nav>
    </div>
  )
}
