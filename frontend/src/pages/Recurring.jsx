import { useState, useEffect } from 'react'
import { Plus, Trash2, Send, Pencil, Download } from 'lucide-react'
import { api } from '../lib/api'

function formatMoney(amount) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount || 0)
}

export default function Recurring() {
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(null)
  const [form, setForm] = useState({
    name: '',
    amount: '',
    type: 'expense',
    category_id: '',
    account_id: '',
    to_account_id: '',
    due_date: '',
    end_date: '',
    one_time: false,
    freq_count: '1',
    freq_unit: 'month',
  })
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const load = async () => {
    try {
      const [recs, accs, cats] = await Promise.all([
        api.getRecurring(),
        api.getAccounts(),
        api.getCategories(),
      ])
      setItems(recs)
      setAccounts(accs)
      setCategories(cats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({
      name: '',
      amount: '',
      type: 'expense',
      category_id: '',
      account_id: '',
      to_account_id: '',
      due_date: '',
      end_date: '',
      one_time: false,
      freq_count: '1',
      freq_unit: 'month',
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
      const payload = {
        name: form.name,
        amount: parseFloat(form.amount),
        type: form.type,
        category_id: form.category_id || null,
        account_id: form.account_id || null,
        to_account_id: form.to_account_id || null,
        due_date: form.due_date || null,
        end_date: form.end_date || null,
        one_time: form.one_time || false,
        freq_count: parseInt(form.freq_count) || 1,
        freq_unit: form.freq_unit || 'month',
      }

      if (editing) {
        await api.updateRecurring(editing.id, payload)
      } else {
        await api.createRecurring(payload)
      }
      resetForm()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEdit = (item) => {
    setEditing(item)
    setForm({
      name: item.name,
      amount: item.amount.toString(),
      type: item.type,
      category_id: item.category_id || '',
      account_id: item.account_id || '',
      to_account_id: item.to_account_id || '',
      due_date: item.due_date || '',
      end_date: item.end_date || '',
      one_time: !!item.one_time,
      freq_count: (item.freq_count || 1).toString(),
      freq_unit: item.freq_unit || 'month',
    })
    setShowForm(true)
  }

  const exportCsv = () => {
    const headers = ['Payee/Description', 'Type', 'Amount', 'Category', 'Account', 'To Account', 'Frequency', 'Due Date']
    const rows = items.map(item => [
      `"${(item.name || '').replace(/"/g, '""')}"`,
      item.type || '',
      item.amount || '',
      `"${(item.category_name || '').replace(/"/g, '""')}"`,
      `"${(item.account_name || '').replace(/"/g, '""')}"`,
      `"${(item.to_account_name || '').replace(/"/g, '""')}"`,
      item.freq_count && item.freq_unit ? `${item.freq_count} ${item.freq_unit}` : '',
      item.due_date || '',
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recurring-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove "${name}" from recurring?`)) return
    try {
      await api.deleteRecurring(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handlePost = async (item) => {
    setPosting(item.id)
    setError('')
    try {
      // If no default account, we need one
      if (!item.account_id && accounts.length > 0) {
        // Use first account as fallback, or could prompt
      }
      await api.postRecurring(item.id, {
        account_id: item.account_id || (accounts[0] && accounts[0].id),
        date: new Date().toISOString().split('T')[0],
      })
      // Brief success feedback could go here
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(null)
    }
  }

  if (loading) {
    return <div className="text-center text-surface-400 py-12">Loading...</div>
  }

  const sortedItems = [...items].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  const filteredCategories = form.type === 'transfer'
    ? categories
    : categories.filter((c) => c.type === form.type)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Recurring</h2>
          <p className="text-surface-400 text-sm mt-0.5">
            Monthly bills & regular transactions
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-secondary" title="Export to CSV">
            <Download size={16} />
            Export
          </button>
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

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Payee/Description</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Internet, Netflix, Rent"
              required
              autoFocus
            />
          </div>

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
              />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                className="input"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">End Date</label>
              <input
                className="input"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                disabled={form.one_time}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-surface-300">
                <input
                  type="checkbox"
                  checked={form.one_time}
                  onChange={(e) => setForm({ ...form, one_time: e.target.checked, end_date: e.target.checked ? '' : form.end_date })}
                  className="rounded border-surface-600 bg-surface-800"
                />
                One Time
              </label>
            </div>
          </div>
          <div>
            <label className="label">Frequency</label>
            <div className="flex gap-2">
              <input
                className="input w-20"
                type="number"
                min="1"
                value={form.freq_count}
                onChange={(e) => setForm({ ...form, freq_count: e.target.value })}
              />
              <select
                className="input flex-1"
                value={form.freq_unit}
                onChange={(e) => setForm({ ...form, freq_unit: e.target.value })}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">{form.type === 'income' ? 'To Account' : 'From Account'}</label>
            <select
              className="input"
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            >
              <option value="">Select</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {form.type === 'transfer' && (
            <div>
              <label className="label">To Account</label>
              <select
                className="input"
                value={form.to_account_id}
                onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}
                required
              >
                <option value="">Select</option>
                {accounts.filter(a => a.id !== form.account_id).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
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
              {editing ? 'Update' : 'Add Recurring'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-12 text-surface-500">
            <p>No recurring items yet.</p>
            <p className="text-sm mt-1">Add your monthly bills here, then post them to an account when due.</p>
          </div>
        ) : (
          sortedItems.map((item) => (
            <div key={item.id} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.name}</div>
                <div className="text-xs text-surface-500 mt-0.5">
                  {item.category_name || (item.type === 'transfer' ? 'Transfer' : 'No category')}
                  {item.account_name && ` · ${item.account_name}`}
                  {item.freq_count && item.freq_unit && !item.one_time && (
                    ` · every ${item.freq_count} ${item.freq_unit}${Number(item.freq_count) > 1 ? 's' : ''}`
                  )}
                  {!!item.one_time && ' · One Time'}
                  {item.due_date && ` · Due ${item.due_date}`}
                  {item.end_date && ` · Ends ${item.end_date}`}
                </div>
              </div>
              <div className={`font-semibold tabular-nums ${
                item.type === 'income' ? 'text-emerald-400' : 'text-surface-200'
              }`}>
                {formatMoney(item.amount)}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePost(item)}
                  disabled={posting === item.id}
                  className="btn-primary py-1.5 px-3 text-xs"
                  title="Post to account register"
                >
                  <Send size={14} />
                  {posting === item.id ? '...' : 'Post'}
                </button>
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 text-surface-500 hover:text-surface-200"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(item.id, item.name)}
                  className="p-2 text-surface-500 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
