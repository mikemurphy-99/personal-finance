import { useState, useEffect } from 'react'
import { api } from '../lib/api'

function formatMoney(amount) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount || 0)
}

export default function Reports() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    Promise.all([
      api.getTransactions({ limit: 1000 }),
      api.getCategories(),
    ]).then(([txs, cats]) => {
      setTransactions(txs)
      setCategories(cats)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center text-surface-400 py-12">Loading...</div>

  const filtered = transactions.filter(tx => tx.date >= dateFrom && tx.date <= dateTo)

  const byCategory = {}
  filtered.forEach(tx => {
    const key = tx.category_name || 'Uncategorized'
    if (!byCategory[key]) byCategory[key] = { income: 0, expense: 0 }
    if (tx.type === 'income') byCategory[key].income += tx.amount
    else byCategory[key].expense += tx.amount
  })

  const rows = Object.entries(byCategory)
    .map(([name, vals]) => ({ name, ...vals, net: vals.income - vals.expense }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  const totals = rows.reduce((acc, r) => ({
    income: acc.income + r.income,
    expense: acc.expense + r.expense,
  }), { income: 0, expense: 0 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
        <p className="text-surface-400 text-sm mt-0.5">Income vs expense by category</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="label">From</label>
          <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-800 bg-surface-900/50 text-left text-surface-400">
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium text-right">Income</th>
              <th className="px-3 py-2 font-medium text-right">Expense</th>
              <th className="px-3 py-2 font-medium text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-surface-500">No transactions in this range</td></tr>
            ) : (
              rows.map(r => (
                <tr key={r.name} className="border-b border-surface-800/50">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{r.income ? formatMoney(r.income) : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.expense ? formatMoney(r.expense) : ''}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(r.net)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-surface-700 font-medium">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{formatMoney(totals.income)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.expense)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${totals.income - totals.expense >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatMoney(totals.income - totals.expense)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
