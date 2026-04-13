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
  const [campaignTitle, setCampaignTitle] = useState('SPRING COLLECTION');
  const [subjectLine, setSubjectLine] = useState('EXCLUSIVE: Seasonal Collection Preview Inside');
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [promoCode, setPromoCode] = useState('SMSPREMIUM');
  const [discount, setDiscount] = useState(TEMPLATES[0].defaultDiscount);
  const [validUntil, setValidUntil] = useState('');
  const [details, setDetails] = useState('');

  // Selection state
  const [recipientType, setRecipientType] = useState<'customers' | 'suppliers'>('customers');
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState('');
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

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      alert('Select at least one recipient');
      return;
    }
    if (!promoCode.trim()) {
      alert('Enter a promo code');
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

      setResult(res.data as any);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send emails';
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  const columns = [
    { 
      key: 'select', 
      label: '', 
      render: (item: any) => {
        const isSelected = selectedRecipients.some(r => r.email === item.email);
        return (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {
              if (isSelected) {
                setSelectedRecipients(selectedRecipients.filter(r => r.email !== item.email));
              } else {
                setSelectedRecipients([...selectedRecipients, { email: item.email, name: item.name }]);
              }
            }}
            className="w-4 h-4 rounded border-white/10 bg-white/5 text-white focus:ring-slate-900 transition-all cursor-pointer"
          />
        );
      },
      className: "w-12 text-center"
    },
    { key: 'name', label: 'NAME', sortable: true },
    { key: 'email', label: 'EMAIL', sortable: true },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="h-full flex flex-col p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        
        {/* Boutique Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-[1px] w-8 bg-white/20"></span>
              <p className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase">Marketing Suite</p>
            </div>
            <h1 className="text-4xl font-light tracking-tight text-white mb-2">PROMO <span className="italic font-serif">Engine</span></h1>
            <p className="text-slate-400 font-light tracking-wide max-w-md line-clamp-1">Deliver premium experiences to your audience with precision.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {result && (
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full flex items-center gap-3 animate-in zoom-in-95 duration-500">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium tracking-wide">
                  {result.success} SENT / {result.failed} FAILED
                </span>
                <button onClick={() => setResult(null)} className="text-slate-500 hover:text-white transition-colors">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={handleSend}
              disabled={sending || selectedRecipients.length === 0}
              className={`group relative px-10 py-4 rounded-full font-bold text-xs tracking-[0.2em] uppercase transition-all duration-500 ${
                sending || selectedRecipients.length === 0
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-white text-slate-950 hover:bg-slate-200 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] active:scale-95'
              }`}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                   DEPLOY TO {selectedRecipients.length} GUESTS
                </div>
              )}
            </button>
          </div>
        </div>

        {/* 3-Column Gallery Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          
          {/* Column 1: Strategy (The Configuration) */}
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-700 delay-150">
            <div className="group relative bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl transition-all duration-500 hover:border-white/20">
              <div className="flex items-center gap-3 mb-8">
                <p className="text-[10px] font-black tracking-widest text-white/60">01</p>
                <div className="h-[1px] flex-1 bg-white/10 group-hover:bg-white/20 transition-colors"></div>
                <h3 className="text-[10px] font-black tracking-widest text-white uppercase">Campaign Strategy</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Campaign Title</label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value.toUpperCase())}
                    className="w-full bg-transparent border-b border-white/10 focus:border-white py-2 text-lg font-light tracking-wide outline-none transition-all placeholder:text-white/10"
                    placeholder="e.g. SPRING PREVIEW"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject Line</label>
                  <input
                    type="text"
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 focus:border-white py-2 text-sm font-light tracking-wide outline-none transition-all placeholder:text-white/10"
                    placeholder="Enter the subject line..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Promo Code</label>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="w-full bg-transparent border-b border-white/10 focus:border-white py-2 text-sm font-mono tracking-widest outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valid Until</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full bg-transparent border-b border-white/10 focus:border-white py-2 text-sm outline-none transition-all color-scheme-dark"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl transition-all duration-500 hover:border-white/20">
              <div className="flex items-center gap-3 mb-6">
                 <p className="text-[10px] font-black tracking-widest text-white/60">02</p>
                 <div className="h-[1px] flex-1 bg-white/10 group-hover:bg-white/20 transition-colors"></div>
                 <h3 className="text-[10px] font-black tracking-widest text-white uppercase">Visual Theme</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setDiscount(template.defaultDiscount);
                    }}
                    className={`relative w-full text-left p-4 rounded-xl border transition-all duration-500 overflow-hidden ${
                      selectedTemplate === template.id
                        ? 'bg-white border-white'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span className={`text-[10px] font-black tracking-widest uppercase transition-colors ${
                      selectedTemplate === template.id ? 'text-slate-950' : 'text-white/40'
                    }`}>
                      {template.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Content (The Creative) */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="group h-full relative bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl transition-all duration-500 hover:border-white/20 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                 <p className="text-[10px] font-black tracking-widest text-white/60">03</p>
                 <div className="h-[1px] flex-1 bg-white/10 group-hover:bg-white/20 transition-colors"></div>
                 <h3 className="text-[10px] font-black tracking-widest text-white uppercase">Campaign Creative</h3>
              </div>

              <div className="space-y-6 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Main Header</label>
                  <input
                    type="text"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 focus:border-white py-2 text-2xl font-black tracking-tighter outline-none transition-all uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">More Information</label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-light tracking-wide outline-none transition-all focus:border-white/30 resize-none hover:bg-white/10"
                    placeholder="Enter additional campaign notes..."
                  />
                </div>
              </div>

              {/* Mini Preview Box */}
              <div className="flex-1 bg-white rounded-3xl p-8 overflow-hidden relative group/preview transition-all duration-700 hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.1)]">
                <div className="absolute inset-0 bg-slate-100/50 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                
                <div className="h-full flex flex-col border border-slate-200 rounded-xl overflow-hidden scale-95 group-hover/preview:scale-100 transition-transform duration-700 shadow-sm">
                  <div className="h-3 bg-slate-50 border-b border-slate-100 flex items-center px-3 gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                  </div>
                  <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-white scrollbar-hide">
                    <div className="h-4 w-12 bg-slate-900 mx-auto rounded"></div>
                    <div className="h-8 w-3/4 bg-slate-100 mx-auto rounded"></div>
                    <div className="h-2 w-1/2 bg-slate-50 mx-auto rounded"></div>
                    
                    <div className="grid grid-cols-3 gap-2 py-2">
                       <div className="aspect-[3/4] bg-slate-50 rounded-lg border border-slate-100"></div>
                       <div className="aspect-[3/4] bg-slate-50 rounded-lg border border-slate-100"></div>
                       <div className="aspect-[3/4] bg-slate-50 rounded-lg border border-slate-100 border-dashed"></div>
                    </div>

                    <div className="h-16 w-full bg-slate-950 rounded-xl"></div>
                    <div className="h-8 w-1/2 bg-slate-100 mx-auto rounded-full"></div>
                  </div>
                </div>

                <div className="absolute top-4 right-4 p-2 bg-slate-950 text-white rounded-full opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300">
                  <Search className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Audience (The Precision) */}
          <div className="lg:col-span-1 animate-in fade-in slide-in-from-right-4 duration-700 delay-450">
            <div className="group h-full relative bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl transition-all duration-500 hover:border-white/20 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                 <p className="text-[10px] font-black tracking-widest text-white/60">04</p>
                 <div className="h-[1px] flex-1 bg-white/10 group-hover:bg-white/20 transition-colors"></div>
                 <h3 className="text-[10px] font-black tracking-widest text-white uppercase">Target Audience</h3>
              </div>

              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => { setRecipientType('customers'); setSelectedRecipients([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all duration-500 ${
                    recipientType === 'customers'
                      ? 'bg-white text-slate-950'
                      : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  Customers ({customers.length})
                </button>
                <button
                  onClick={() => { setRecipientType('suppliers'); setSelectedRecipients([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all duration-500 ${
                    recipientType === 'suppliers'
                      ? 'bg-white text-slate-950'
                      : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  Suppliers ({suppliers.length})
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                 <div className="text-slate-200 boutique-table h-full overflow-hidden">
                    <DataTable
                      columns={columns}
                      data={recipientType === 'customers' ? customers : suppliers}
                      searchValue={search}
                      onSearchChange={setSearch}
                      pageSize={10}
                    />
                 </div>
              </div>

              <p className="text-[9px] text-slate-500 uppercase tracking-widest text-center mt-6">
                 Powered by Brevo • Integrated Precision Selection
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}