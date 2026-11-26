import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, CreditCard, PiggyBank } from 'lucide-react'
import { api } from '../lib/api'

const typeIcons = {
  checking: Wallet,
  credit: CreditCard,
  savings: PiggyBank,
  other: Wallet,
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount || 0)
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAccounts()
      .then(setAccounts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-center text-surface-400 py-12">Loading...</div>
  }

  const total = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Accounts</h2>
        <p className="text-surface-400 text-sm mt-0.5">
          Total: <span className="text-surface-200 font-medium">{formatMoney(total)}</span>
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {accounts.map((account) => {
          const Icon = typeIcons[account.type] || Wallet
          const isNegative = account.current_balance < 0
          return (
            <Link
              key={account.id}
              to={`/account/${account.id}`}
              className="card flex items-center gap-4 hover:border-surface-700 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-surface-800 flex items-center justify-center text-surface-300">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{account.name}</div>
                <div className="text-xs text-surface-500 capitalize">{account.type}</div>
              </div>
              <div className={`text-right font-semibold tabular-nums ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatMoney(account.current_balance)}
              </div>
            </Link>
          )
        })}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12 text-surface-500">
          <Wallet size={40} className="mx-auto mb-3 opacity-40" />
          <p>No accounts yet. Add one in Settings.</p>
        </div>
      )}
    </div>
  )
}
