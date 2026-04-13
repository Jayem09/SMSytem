import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import { Mail, Send, Users, Truck, CheckCircle, XCircle, Loader2, Search } from 'lucide-react';

interface Customer {
  id: number;
  name: string;
  email: string;
}

interface Supplier {
  id: number;
  name: string;
  email: string;
}

interface Recipient {
  email: string;
  name: string;
}

const TEMPLATES = [
  { id: 'buy4get1', name: 'Buy X Get Y Free', defaultDiscount: 'Buy 4 Get 1 Free' },
  { id: 'discount', name: 'Discount Sale', defaultDiscount: '20% OFF' },
  { id: 'seasonal', name: 'Seasonal Promo', defaultDiscount: 'Special Offer' },
];

export default function PromoEmail() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(TEMPLATES[0].defaultDiscount);
  const [validUntil, setValidUntil] = useState('');
  const [details, setDetails] = useState('');

  // Selection state
  const [recipientType, setRecipientType] = useState<'customers' | 'suppliers'>('customers');
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [search, setSearch] = useState('');

  // Result state
  const [result, setResult] = useState<{ success: number; failed: number; failed_emails: string[] } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, suppliersRes] = await Promise.all([
        api.get('/api/customers'),
        api.get('/api/suppliers'),
      ]);

      const customersData = ((customersRes.data as any).customers || customersRes.data || []) as Customer[];
      const suppliersData = ((suppliersRes.data as any).suppliers || suppliersRes.data || []) as Supplier[];

      setCustomers(customersData.filter(c => c.email?.trim()));
      setSuppliers(suppliersData.filter(s => s.email?.trim()));
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentRecipientsList = useMemo(() => {
    const list = recipientType === 'customers' ? customers : suppliers;
    if (!search) return list;
    return list.filter(r => 
      r.name.toLowerCase().includes(search.toLowerCase()) || 
      r.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [recipientType, customers, suppliers, search]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(
        currentRecipientsList.map((r) => ({
          email: r.email,
          name: r.name,
        }))
      );
    }
    setSelectAll(!selectAll);
  };

  const handleToggleRecipient = (r: Customer | Supplier) => {
    const exists = selectedRecipients.find((rec) => rec.email === r.email);
    if (exists) {
      setSelectedRecipients(selectedRecipients.filter((rec) => rec.email !== r.email));
    } else {
      setSelectedRecipients([
        ...selectedRecipients,
        { email: r.email, name: r.name },
      ]);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setDiscount(template.defaultDiscount);
    }
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }
    if (!promoCode.trim()) {
      alert('Please enter a promo code');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await api.post('/api/promo/send', {
        recipients: selectedRecipients,
        template: selectedTemplate,
        promo_code: promoCode,
        discount,
        valid_until: validUntil,
        details,
      });

      setResult(res.data as any);
    } catch (err: unknown) {
      console.error('Send error:', err);
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = axiosErr.response?.data?.error || axiosErr.message || 'Failed to send emails';
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Mail className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Promo Emails</h1>
            <p className="text-sm text-gray-500">Send promotional emails to customers & suppliers</p>
          </div>
        </div>
      </div>

      {/* Result Alert */}
      {result && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          result.failed === 0
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {result.failed === 0 ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <div>
            <p className="font-medium">Sent {result.success} emails successfully</p>
            {result.failed > 0 && (
              <p className="text-sm">Failed: {result.failed}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-900">Email Template</h3>
            </div>
            <div className="p-4 space-y-2">
              {TEMPLATES.map((template) => (
                <label
                  key={template.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedTemplate === template.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={selectedTemplate === template.id}
                    onChange={() => handleTemplateChange(template.id)}
                    className="sr-only"
                  />
                  <span className={selectedTemplate === template.id ? 'text-indigo-700 font-medium' : 'text-gray-700'}>
                    {template.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Promo Details */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-900">Promo Details</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promo Code *
                </label>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BUY4GET1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Offer / Discount
                </label>
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="e.g. Buy 4 Get 1 Free"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extra Details
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="e.g. Valid on all Michelin & Goodyear tires"
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Recipients */}
        <div className="space-y-6">
          {/* Recipient Selection */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recipients</h3>
              <span className="text-sm text-gray-500">
                {selectedRecipients.length} selected
              </span>
            </div>

            {/* Type Tabs */}
            <div className="p-4 border-b">
              <div className="flex gap-2">
                <button
                  onClick={() => { setRecipientType('customers'); setSelectAll(false); setSelectedRecipients([]); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    recipientType === 'customers'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Customers ({customers.length})
                </button>
                <button
                  onClick={() => { setRecipientType('suppliers'); setSelectAll(false); setSelectedRecipients([]); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    recipientType === 'suppliers'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  Suppliers ({suppliers.length})
                </button>
              </div>
            </div>

            {/* Search & Select All */}
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button 
                onClick={handleSelectAll}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {selectAll ? 'Clear Selection' : `Select All (${currentRecipientsList.length})`}
              </button>
            </div>

            {/* Recipient List */}
            <div className="px-4 pb-4 max-h-80 overflow-y-auto space-y-1">
              {currentRecipientsList.length === 0 ? (
                <p className="py-4 text-center text-gray-500">No {recipientType} with email found</p>
              ) : (
                currentRecipientsList.map((r) => {
                  const isSelected = selectedRecipients.some((rec) => rec.email === r.email);
                  return (
                    <label
                      key={r.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRecipient(r)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                        <p className="text-xs text-gray-500 truncate">{r.email}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || selectedRecipients.length === 0 || !promoCode.trim()}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
              sending || selectedRecipients.length === 0 || !promoCode.trim()
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm hover:shadow-md active:scale-95'
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
              <Send className="w-5 h-5" />
              Send to {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''}
            </>
          )}
          </button>

          {/* Info */}
          <p className="text-xs text-gray-400 text-center">
            Powered by Brevo • Free 300 emails/day
          </p>
        </div>
      </div>
    </div>
  );
}