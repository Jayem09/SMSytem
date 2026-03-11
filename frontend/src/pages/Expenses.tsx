import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  user_id: number;
  user?: { name: string };
  product_id?: number;
  quantity?: number;
  product?: { name: string };
}

interface Product {
  id: number;
  name: string;
  is_service?: boolean;
}

export default function Expenses() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    description: '', 
    amount: '' as string | number, 
    category: 'Other', 
    expense_date: new Date().toISOString().split('T')[0],
    product_id: '',
    quantity: '' as string | number
  });

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/api/expenses');
      setExpenses(res.data);
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    api.get('/api/products?all=1').then(res => setProducts(res.data.products || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/expenses', {
        ...formData,
        amount: Number(formData.amount),
        expense_date: new Date(formData.expense_date).toISOString(),
        product_id: formData.category === 'Inventory' ? Number(formData.product_id) : null,
        quantity: formData.category === 'Inventory' ? Number(formData.quantity) : 0
      });
      setIsModalOpen(false);
      fetchExpenses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      fetchExpenses();
    } catch {
      alert('Failed to delete');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">Manage your overhead costs and business spending.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer"
          >
            Add Expense
          </button>
        )}
      </div>

      <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900">Description</th>
              <th className="px-6 py-4 font-medium text-gray-900">Category</th>
              <th className="px-6 py-4 font-medium text-gray-900">Amount</th>
              <th className="px-6 py-4 font-medium text-gray-900">Date</th>
              <th className="px-6 py-4 font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {expenses.map((exp) => (
              <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-gray-900">
                  <div className="font-medium">{exp.description}</div>
                  {exp.category === 'Inventory' && exp.product && (
                    <div className="text-xs text-indigo-600 font-semibold mt-0.5">
                      Restocked: {exp.product.name} (+{exp.quantity})
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">{exp.category}</span>
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">₱{exp.amount.toLocaleString()}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(exp.expense_date).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <button onClick={() => deleteExpense(exp.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-12 text-center text-gray-500">Loading expenses...</div>}
        {!loading && expenses.length === 0 && <div className="p-12 text-center text-gray-500">No expenses recorded yet.</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Add New Expense</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option>Salary</option>
                    <option>Rent</option>
                    <option>Utilities</option>
                    <option>Supplies</option>
                    <option>Inventory</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              {formData.category === 'Inventory' && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Product to Restock</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                      value={formData.product_id}
                      onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                    >
                      <option value="">Choose a product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                      value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                  value={formData.expense_date}
                  onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
