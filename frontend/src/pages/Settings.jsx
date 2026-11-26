import { useState, useEffect } from 'react'
import { Plus, Trash2, Download, Upload, Pencil } from 'lucide-react'
import { api } from '../lib/api'
import pkg from '../../package.json'

export default function Settings() {
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [editBalance, setEditBalance] = useState('')
  const [showCatForm, setShowCatForm] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' })

  const load = async () => {
    try {
      const [accs, cats] = await Promise.all([api.getAccounts(), api.getCategories()])
      setAccounts(accs)
      setCategories(cats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createAccount = async (e) => {
    e.preventDefault()
    try {
      await api.createAccount({
        name: accountForm.name,
        type: accountForm.type,
        starting_balance: parseFloat(accountForm.starting_balance) || 0,
      })
      setAccountForm({ name: '', type: 'checking', starting_balance: '' })
      setShowAccountForm(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveStartingBalance = async (id) => {
    try {
      await api.updateAccount(id, { starting_balance: parseFloat(editBalance) || 0 })
      setEditingAccount(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteAccount = async (id, name) => {
    if (!confirm(`Delete account "${name}" and all its transactions?`)) return
    try {
      await api.deleteAccount(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const createCategory = async (e) => {
    e.preventDefault()
    try {
      await api.createCategory(catForm)
      setCatForm({ name: '', type: 'expense' })
      setShowCatForm(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteCategory = async (id, name) => {
    if (!confirm(`Delete category "${name}"?`)) return
    try {
      await api.deleteCategory(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const downloadBackup = async () => {
    try {
      const res = await fetch('/api/backup')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.db`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Backup failed')
    }
  }

  const restoreBackup = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('This will replace all current data. Continue?')) {
      e.target.value = ''
      return
    }
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/restore', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Restore failed')
      alert('Restored. Reloading...')
      window.location.reload()
    } catch (err) {
      setError(err.message)
    }
    e.target.value = ''
  }

  if (loading) return <div className="text-center text-surface-400 py-12">Loading...</div>

  const incomeCats = categories.filter(c => c.type === 'income')
  const expenseCats = categories.filter(c => c.type === 'expense')

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <span className="text-sm text-surface-500">v{pkg.version}</span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Accounts */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Accounts</h3>
          <button onClick={() => setShowAccountForm(!showAccountForm)} className="btn-primary text-sm py-1.5">
            <Plus size={14} /> Add
          </button>
        </div>
        {showAccountForm && (
          <form onSubmit={createAccount} className="space-y-3 pb-4 border-b border-surface-800">
            <input className="input" placeholder="Account name" value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={accountForm.type} onChange={e => setAccountForm({...accountForm, type: e.target.value})}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit Card</option>
                <option value="other">Other</option>
              </select>
              <input className="input" type="number" step="0.01" placeholder="Starting balance" value={accountForm.starting_balance} onChange={e => setAccountForm({...accountForm, starting_balance: e.target.value})} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAccountForm(false)} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" className="btn-primary text-sm">Create</button>
            </div>
          </form>
        )}
        <div className="space-y-1">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center justify-between py-2 group">
              <span>{a.name} <span className="text-surface-500 text-xs capitalize">({a.type})</span></span>
              {editingAccount === a.id ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input w-28 text-sm py-1"
                    type="number"
                    step="0.01"
                    value={editBalance}
                    onChange={e => setEditBalance(e.target.value)}
                    autoFocus
                  />
                  <button onClick={() => saveStartingBalance(a.id)} className="btn-primary text-xs py-1 px-2">Save</button>
                  <button onClick={() => setEditingAccount(null)} className="btn-secondary text-xs py-1 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-surface-400 tabular-nums">{a.starting_balance != null ? a.starting_balance.toFixed(2) : '0.00'}</span>
                  <button onClick={() => { setEditingAccount(a.id); setEditBalance(a.starting_balance || '') }} className="p-1.5 text-surface-600 hover:text-surface-200 opacity-0 group-hover:opacity-100">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteAccount(a.id, a.name)} className="p-1.5 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Categories</h3>
          <button onClick={() => setShowCatForm(!showCatForm)} className="btn-primary text-sm py-1.5">
            <Plus size={14} /> Add
          </button>
        </div>
        {showCatForm && (
          <form onSubmit={createCategory} className="space-y-3 pb-4 border-b border-surface-800">
            <input className="input" placeholder="Category name" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} required />
            <div className="flex gap-2">
              <button type="button" onClick={() => setCatForm({...catForm, type: 'expense'})} className={`flex-1 py-2 rounded-lg text-sm ${catForm.type === 'expense' ? 'bg-red-600/20 text-red-400' : 'bg-surface-800'}`}>Expense</button>
              <button type="button" onClick={() => setCatForm({...catForm, type: 'income'})} className={`flex-1 py-2 rounded-lg text-sm ${catForm.type === 'income' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-surface-800'}`}>Income</button>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCatForm(false)} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" className="btn-primary text-sm">Create</button>
            </div>
          </form>
        )}
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-surface-500 mb-2">Expenses</div>
            {expenseCats.map(c => (
              <div key={c.id} className="flex items-center justify-between py-1.5 group">
                <span>{c.name}</span>
                <button onClick={() => deleteCategory(c.id, c.name)} className="p-1 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-surface-500 mb-2">Income</div>
            {incomeCats.map(c => (
              <div key={c.id} className="flex items-center justify-between py-1.5 group">
                <span>{c.name}</span>
                <button onClick={() => deleteCategory(c.id, c.name)} className="p-1 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Backup / Restore */}
      <section className="card space-y-3">
        <h3 className="font-medium">Data</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={downloadBackup} className="btn-secondary">
            <Download size={16} /> Backup
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} /> Restore
            <input type="file" accept=".db" onChange={restoreBackup} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-surface-500">Backup downloads your database. Restore replaces all current data.</p>
      </section>
    </div>
  )
}
