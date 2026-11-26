import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Pencil, Upload } from 'lucide-react'
import { api } from '../lib/api'

function formatMoney(amount) {
  if (amount == null || amount === 0) return ''
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AccountRegister() {
  const { id } = useParams()
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferForm, setTransferForm] = useState({ to_account_id: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' })
  const [allAccounts, setAllAccounts] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    minAmount: '',
    maxAmount: '',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
  })
  const [form, setForm] = useState({
    amount: '',
    type: 'expense',
    category_id: '',
    payee_description: '',
    date: new Date().toISOString().split('T')[0],
    to_account_id: '',
    from_account_id: '',
  })
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const load = async () => {
    try {
      const [accounts, txs, cats] = await Promise.all([
        api.getAccounts(),
        api.getTransactions({ account_id: id, limit: 500 }),
        api.getCategories(),
      ])
      const acc = accounts.find((a) => a.id === id)
      setAccount(acc)
      setAllAccounts(accounts)
      setTransactions(txs)
      setCategories(cats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const resetForm = () => {
    setForm({
      amount: '',
      type: 'expense',
      category_id: '',
      payee_description: '',
      date: new Date().toISOString().split('T')[0],
      to_account_id: '',
      from_account_id: '',
    })
    setEditing(null)
    setShowForm(false)
    setShowNewCat(false)
    setNewCatName('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (form.type === 'transfer') {
        if (editing && editing.transfer_id) {
          // Update both sides of the transfer
          await api.updateTransaction(editing.id, {
            amount: parseFloat(form.amount),
            description: form.payee_description || 'Transfer',
            date: form.date,
            category_id: form.category_id || null,
          })
          // Find and update the other side
          const other = transactions.find(t => t.transfer_id === editing.transfer_id && t.id !== editing.id)
          if (other) {
            await api.updateTransaction(other.id, {
              amount: parseFloat(form.amount),
              description: form.payee_description || 'Transfer',
              date: form.date,
              category_id: form.category_id || null,
            })
          }
        } else {
          await api.transfer({
            from_account_id: form.from_account_id || id,
            to_account_id: form.to_account_id,
            amount: parseFloat(form.amount),
            date: form.date,
            description: form.payee_description || 'Transfer',
          })
        }
      } else {
        const payload = {
          account_id: id,
          amount: parseFloat(form.amount),
          type: form.type,
          category_id: form.category_id || null,
          description: form.payee_description || null,
          payee: form.payee_description || null,
          date: form.date,
        }
        if (editing) {
          await api.updateTransaction(editing.id, payload)
        } else {
          await api.createTransaction(payload)
        }
      }
      resetForm()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEdit = (tx) => {
    setEditing(tx)
    setForm({
      amount: tx.amount.toString(),
      type: tx.transfer_id ? 'transfer' : tx.type,
      category_id: tx.category_id || '',
      payee_description: tx.payee || tx.description || '',
      date: tx.date,
      to_account_id: '',
    })
    setShowForm(true)
  }

  const handleDelete = async (txId) => {
    if (!confirm('Delete this transaction?')) return
    try {
      await api.deleteTransaction(txId)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleReconciled = async (tx) => {
    try {
      await api.updateTransaction(tx.id, { reconciled: !tx.reconciled })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const createCategoryInline = async () => {
    if (!newCatName.trim()) return
    try {
      const cat = await api.createCategory({ name: newCatName.trim(), type: form.type })
      setCategories(prev => [...prev, cat])
      setForm({ ...form, category_id: cat.id })
      setNewCatName('')
      setShowNewCat(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setImportResult(null)
    try {
      const text = await file.text()
      const result = await api.importCsv(id, text)
      setImportResult(result)
      load()
    } catch (err) {
      setError(err.message)
    }
    e.target.value = ''
  }

  if (loading) {
    return <div className="text-center text-surface-400 py-12">Loading...</div>
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-400 mb-4">Account not found</p>
        <Link to="/" className="btn-primary">Back to Accounts</Link>
      </div>
    )
  }

  // Apply filters
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const filtered = transactions.filter(tx => {
    if (filters.search) {
      const s = filters.search.toLowerCase()
      const text = `${tx.payee || ''} ${tx.description || ''}`.toLowerCase()
      if (!text.includes(s)) return false
    }
    if (filters.category && tx.category_id !== filters.category) return false
    if (filters.minAmount && tx.amount < parseFloat(filters.minAmount)) return false
    if (filters.maxAmount && tx.amount > parseFloat(filters.maxAmount)) return false
    if (filters.datePreset === 'thisMonth' && (tx.date < thisMonthStart || tx.date > thisMonthEnd)) return false
    if (filters.datePreset === 'lastMonth' && (tx.date < lastMonthStart || tx.date > lastMonthEnd)) return false
    if (filters.datePreset === 'custom') {
      if (filters.dateFrom && tx.date < filters.dateFrom) return false
      if (filters.dateTo && tx.date > filters.dateTo) return false
    }
    return true
  })

  // Sort: unreconciled first, then by date descending
  const displayTxs = [...filtered].sort((a, b) => {
    if (!!a.reconciled !== !!b.reconciled) return a.reconciled ? 1 : -1;
    return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
  });

  // Running balance follows the displayed order (bottom → top)
  let running = account.starting_balance || 0;
  const balanceMap = {};
  [...displayTxs].reverse().forEach(tx => {
    running += tx.type === 'income' ? tx.amount : -tx.amount;
    balanceMap[tx.id] = running;
  });

  const filteredCategories = form.type === 'transfer'
    ? categories
    : categories.filter((c) => c.type === form.type)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link to="/" className="mt-1 p-2 -ml-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-2xl font-semibold tracking-tight">{account.name}</h2>
          <p className={`text-lg font-medium tabular-nums mt-0.5 ${
            account.current_balance < 0 ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {formatMoney(account.current_balance) || '$0.00'}
          </p>
        </div>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} />
            Import CSV
            <input type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary">
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {importResult && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 text-sm">
          Imported {importResult.imported} transactions ({importResult.skipped} skipped).
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'expense', category_id: '', to_account_id: '' })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.type === 'expense'
                  ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                  : 'bg-surface-800 text-surface-400 border border-transparent'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'income', category_id: '', to_account_id: '' })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.type === 'income'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-surface-800 text-surface-400 border border-transparent'
              }`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'transfer', category_id: '' })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.type === 'transfer'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'bg-surface-800 text-surface-400 border border-transparent'
              }`}
            >
              Transfer
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Payee/Description</label>
            <input
              className="input"
              value={form.payee_description}
              onChange={(e) => setForm({ ...form, payee_description: e.target.value })}
              placeholder="Who / what"
            />
          </div>

          {form.type === 'transfer' && (
            <>
              <div>
                <label className="label">From Account</label>
                <select
                  className="input"
                  value={form.from_account_id || id}
                  onChange={(e) => setForm({ ...form, from_account_id: e.target.value })}
                  required
                >
                  {allAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">To Account</label>
                <select
                  className="input"
                  value={form.to_account_id}
                  onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}
                  required
                >
                  <option value="">Select account</option>
                  {allAccounts.filter(a => a.id !== (form.from_account_id || id)).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="label">Category</label>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">No category</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCat(!showNewCat)}
                className="btn-secondary px-3"
                title="Add new category"
              >
                <Plus size={16} />
              </button>
            </div>
            {showNewCat && (
              <div className="flex gap-2 mt-2">
                <input
                  className="input flex-1"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={`New ${form.type} category`}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createCategoryInline())}
                />
                <button type="button" onClick={createCategoryInline} className="btn-primary px-3">
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editing ? 'Update' : 'Add Transaction'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-[140px]"
            placeholder="Search payee..."
            value={filters.search}
            onChange={e => setFilters({...filters, search: e.target.value})}
          />
          <select
            className="input w-40"
            value={filters.category}
            onChange={e => setFilters({...filters, category: e.target.value})}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="input w-36"
            value={filters.datePreset}
            onChange={e => setFilters({...filters, datePreset: e.target.value})}
          >
            <option value="all">All dates</option>
            <option value="thisMonth">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {filters.datePreset === 'custom' && (
          <div className="flex gap-2">
            <input className="input" type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
            <input className="input" type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="input w-28"
            type="number"
            step="0.01"
            placeholder="Min $"
            value={filters.minAmount}
            onChange={e => setFilters({...filters, minAmount: e.target.value})}
          />
          <input
            className="input w-28"
            type="number"
            step="0.01"
            placeholder="Max $"
            value={filters.maxAmount}
            onChange={e => setFilters({...filters, maxAmount: e.target.value})}
          />
          {(filters.search || filters.category || filters.minAmount || filters.maxAmount || filters.datePreset !== 'all') && (
            <button onClick={() => setFilters({ search: '', category: '', minAmount: '', maxAmount: '', datePreset: 'all', dateFrom: '', dateTo: '' })} className="btn-secondary text-sm">
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-surface-800">
        <table className="w-full text-sm text-slate-800 dark:text-surface-100">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600 dark:border-surface-800 dark:bg-surface-900/50 dark:text-surface-400">
              <th className="px-3 py-2 w-10 font-medium">✓</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Payee/Description</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium text-right">Income</th>
              <th className="px-3 py-2 font-medium text-right">Expense</th>
              <th className="px-3 py-2 font-medium text-right">Balance</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {displayTxs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-surface-500">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              displayTxs.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-surface-800/50 dark:hover:bg-surface-900/50 group">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!tx.reconciled}
                      onChange={() => toggleReconciled(tx)}
                      className="rounded border-surface-600 bg-surface-800 text-emerald-500 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-surface-300">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-3 py-2 max-w-[280px] truncate">
                    {tx.payee || tx.description || '—'}
                  </td>
                  <td className="px-3 py-2 text-surface-400">
                    {tx.category_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-400">
                    {tx.type === 'income' ? formatMoney(tx.amount) : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {tx.type === 'expense' ? formatMoney(tx.amount) : ''}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                    (balanceMap[tx.id] || 0) < 0 ? 'text-red-400' : 'text-surface-200'
                  }`}>
                    {formatMoney(balanceMap[tx.id])}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button
                        onClick={() => handleEdit(tx)}
                        className="p-1.5 text-surface-500 hover:text-surface-200"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 text-surface-500 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
