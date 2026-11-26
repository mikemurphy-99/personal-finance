import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', type: 'expense' })

  const load = async () => {
    try {
      const data = await api.getCategories()
      setCategories(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.createCategory(form)
      setForm({ name: '', type: 'expense' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete category "${name}"? Existing transactions will keep the amount but lose the category.`)) return
    try {
      await api.deleteCategory(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div className="text-center text-surface-400 py-12">Loading...</div>
  }

  const income = categories.filter((c) => c.type === 'income')
  const expense = categories.filter((c) => c.type === 'expense')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Categories</h2>
          <p className="text-surface-400 text-sm mt-0.5">
            Organize your income and expenses
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} />
          Add
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Groceries"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'expense' })}
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
                onClick={() => setForm({ ...form, type: 'income' })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.type === 'income'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-surface-800 text-surface-400 border border-transparent'
                }`}
              >
                Income
              </button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create
            </button>
          </div>
        </form>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3">
            Expenses ({expense.length})
          </h3>
          <div className="space-y-1">
            {expense.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-900 group"
              >
                <span className="text-surface-200">{cat.name}</span>
                <button
                  onClick={() => handleDelete(cat.id, cat.name)}
                  className="p-1.5 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {expense.length === 0 && (
              <p className="text-sm text-surface-600 px-3 py-2">No expense categories</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3">
            Income ({income.length})
          </h3>
          <div className="space-y-1">
            {income.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-900 group"
              >
                <span className="text-surface-200">{cat.name}</span>
                <button
                  onClick={() => handleDelete(cat.id, cat.name)}
                  className="p-1.5 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {income.length === 0 && (
              <p className="text-sm text-surface-600 px-3 py-2">No income categories</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
