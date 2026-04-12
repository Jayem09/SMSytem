import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Mail, Send, Users, Truck, CheckCircle, XCircle, Loader2 } from 'lucide-react';

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
  { id: 'buy4get1', name: '🛞 Buy X Get Y Free', defaultDiscount: 'Buy 4 Get 1 Free' },
  { id: 'discount', name: '💰 Discount Sale', defaultDiscount: '20% OFF' },
  { id: 'seasonal', name: '🎉 Seasonal Promo', defaultDiscount: 'Special Offer' },
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

      // Filter only those with emails
      const customersData = (customersRes.data.customers || []) as Customer[];
      const suppliersData = (suppliersRes.data.suppliers || []) as Supplier[];

      setCustomers(customersData.filter(c => c.email?.trim()));
      setSuppliers(suppliersData.filter(s => s.email?.trim()));
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentRecipients = recipientType === 'customers' ? customers : suppliers;

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(
        currentRecipients.map((r) => ({
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
      console.log('Sending promo email request:', {
        recipients: selectedRecipients,
        template: selectedTemplate,
        promo_code: promoCode,
        discount,
        valid_until: validUntil,
        details,
      });
      
      const res = await api.post('/api/promo/send', {
        recipients: selectedRecipients,
        template: selectedTemplate,
        promo_code: promoCode,
        discount,
        valid_until: validUntil,
        details,
      });
      
      console.log('Response:', res);
      setResult(res.data);
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
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promo Emails</h1>
          <p className="text-gray-500 dark:text-gray-400">Send promotional emails to customers & suppliers</p>
        </div>
      </div>

      {/* Result Alert */}
      {result && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          result.failed === 0
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        }`}>
          {result.failed === 0 ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <div>
            <p className="font-medium">Sent {result.success} emails successfully</p>
            {result.failed > 0 && (
              <p className="text-sm">Failed: {result.failed} ({result.failed_emails.join(', ')})</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📧 Email Template</h3>
            <div className="space-y-2">
              {TEMPLATES.map((template) => (
                <label
                  key={template.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedTemplate === template.id
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
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
                  <span className={selectedTemplate === template.id ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}>
                    {template.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Promo Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">🏷️ Promo Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Promo Code *
                </label>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BUY4GET1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Offer / Discount
                </label>
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="e.g. Buy 4 Get 1 Free"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Extra Details
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="e.g. Valid on all Michelin & Goodyear tires"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Recipients */}
        <div className="space-y-6">
          {/* Recipient Type */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">👥 Recipients</h3>
              <span className="text-sm text-gray-500">
                {selectedRecipients.length} selected
              </span>
            </div>

            {/* Type Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setRecipientType('customers'); setSelectAll(false); setSelectedRecipients([]); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  recipientType === 'customers'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4" />
                Customers ({customers.length})
              </button>
              <button
                onClick={() => { setRecipientType('suppliers'); setSelectAll(false); setSelectedRecipients([]); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  recipientType === 'suppliers'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                Suppliers ({suppliers.length})
              </button>
            </div>

            {/* Select All */}
            <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                id="selectAll"
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="selectAll" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                Select all with email ({currentRecipients.length})
              </label>
            </div>

            {/* Recipient List */}
            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {currentRecipients.length === 0 ? (
                <p className="p-4 text-center text-gray-500">No {recipientType} with email found</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {currentRecipients.map((r) => {
                    const isSelected = selectedRecipients.some((rec) => rec.email === r.email);
                    return (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRecipient(r)}
                          className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {r.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{r.email}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || selectedRecipients.length === 0 || !promoCode.trim()}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-lg transition-all ${
              sending || selectedRecipients.length === 0 || !promoCode.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg'
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
          <p className="text-xs text-gray-500 text-center">
            📧 Powered by Brevo • Free 300 emails/day
          </p>
        </div>
      </div>
    </div>
  );
}