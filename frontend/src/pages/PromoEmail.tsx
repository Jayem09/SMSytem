import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import { Mail, Send, Loader2, Check, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

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
  { id: 'buy4get1', name: 'Buy X Get Y Free', discount: 'Buy 4 Get 1 Free' },
  { id: 'discount', name: 'Discount Sale', discount: '20% OFF' },
  { id: 'seasonal', name: 'Seasonal Promo', discount: 'Special Offer' },
];

export default function PromoEmail() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();

  const [campaignTitle, setCampaignTitle] = useState('SPRING COLLECTION');
  const [subjectLine, setSubjectLine] = useState('EXCLUSIVE: Seasonal Collection Preview Inside');
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [promoCode, setPromoCode] = useState('SMSPREMIUM');
  const [discount, setDiscount] = useState(TEMPLATES[0].discount);
  const [validUntil, setValidUntil] = useState('');
  const [details, setDetails] = useState('');

  const [recipientType, setRecipientType] = useState<'customers' | 'suppliers'>('customers');
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, suppliersRes] = await Promise.all([
        api.get('/api/customers'),
        api.get('/api/suppliers'),
      ]);

      const customersData = (customersRes.data as { customers?: Customer[] })?.customers || [];
      const suppliersData = (suppliersRes.data as { suppliers?: Supplier[] })?.suppliers || [];

      setCustomers(customersData.filter(c => c.email?.trim()));
      setSuppliers(suppliersData.filter(s => s.email?.trim()));
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      showToast('Select at least one recipient', 'error');
      return;
    }
    if (!promoCode.trim()) {
      showToast('Enter a promo code', 'error');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await api.post('/api/promo/send', {
        recipients: selectedRecipients,
        template: selectedTemplate,
        subject: subjectLine,
        campaign_title: campaignTitle,
        promo_code: promoCode.toUpperCase(),
        discount,
        valid_until: validUntil,
        details,
      });

      const data = res.data as { success: number; failed: number };
      setResult(data);
      showToast(`Sent to ${data.success} recipients`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send emails';
      showToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  const toggleRecipient = (item: Customer | Supplier) => {
    const isSelected = selectedRecipients.some(r => r.email === item.email);
    if (isSelected) {
      setSelectedRecipients(selectedRecipients.filter(r => r.email !== item.email));
    } else {
      setSelectedRecipients([...selectedRecipients, { email: item.email, name: item.name }]);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'select',
      label: '',
      render: (item: Customer | Supplier) => {
        const isSelected = selectedRecipients.some(r => r.email === item.email);
        return (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleRecipient(item)}
            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
          />
        );
      },
      className: 'w-10'
    },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedRecipients]);

  const data = recipientType === 'customers' ? customers : suppliers;

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gray-900 text-white rounded-xl">
          <Mail className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Promo Email</h1>
          <p className="text-sm text-gray-500">Send promotional emails to your customers and suppliers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-900">Campaign Details</h2>
              <p className="text-sm text-gray-500 mt-1">Configure your promotional campaign.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Campaign Title</label>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
                  placeholder="e.g. SPRING PREVIEW"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Subject Line</label>
                <input
                  type="text"
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
                  placeholder="Enter the subject line..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Promo Code</label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Valid Until</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-900">Email Template</h2>
              <p className="text-sm text-gray-500 mt-1">Choose a template for your campaign.</p>
            </div>
            <div className="p-5 space-y-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    setDiscount(template.discount);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                    selectedTemplate === template.id
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-400'
                  }`}
                >
                  <span className="text-sm font-bold">{template.name}</span>
                </button>
              ))}

              <div className="pt-4">
                <label className="block text-sm font-bold text-gray-900 mb-2">Offer Details</label>
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
                  placeholder="e.g. 20% OFF"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Additional Information</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all resize-none"
                  placeholder="Enter additional campaign notes..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-900">Recipients</h2>
              <p className="text-sm text-gray-500 mt-1">Select recipients for your campaign.</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => { setRecipientType('customers'); setSelectedRecipients([]); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    recipientType === 'customers'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Customers ({customers.length})
                </button>
                <button
                  onClick={() => { setRecipientType('suppliers'); setSelectedRecipients([]); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    recipientType === 'suppliers'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Suppliers ({suppliers.length})
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <DataTable
                  columns={columns}
                  data={data}
                  searchValue={search}
                  onSearchChange={setSearch}
                  pageSize={8}
                />
              </div>

              {selectedRecipients.length > 0 && (
                <p className="text-sm text-gray-500">
                  {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>

          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                Sent to {result.success} recipients ({result.failed} failed)
              </span>
              <button onClick={() => setResult(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || selectedRecipients.length === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-wait"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                SEND TO {selectedRecipients.length} RECIPIENT{selectedRecipients.length !== 1 ? 'S' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}