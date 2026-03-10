import { useState, useEffect } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { printReceipt } from '../components/Receipt';
import { printDeliveryReceipt } from '../components/DeliveryReceipt';
import { Search, ShoppingCart, Trash2, Printer, CheckCircle, Package } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  image_url?: string;
  category_id: number;
  category?: { name: string };
}

interface CartItem extends Product {
  quantity: number;
}

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  subtotal: number;
  product?: Product;
}

interface Order {
  id: number;
  customer_id?: number | null;
  guest_name?: string;
  guest_phone?: string;
  total_amount: number;
  discount_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  items?: OrderItem[];
  customer?: { name: string };
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [serviceAdvisors, setServiceAdvisors] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Checkout State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [serviceAdvisorName, setServiceAdvisorName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [tin, setTin] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [withholdingTaxRate, setWithholdingTaxRate] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptType, setReceiptType] = useState<'SI' | 'DR'>('SI'); // Added Receipt Type
  const [discount, setDiscount] = useState('0');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [lastTin, setLastTin] = useState('');
  const [lastBusinessAddress, setLastBusinessAddress] = useState('');
  const [lastWithholdingTaxRate, setLastWithholdingTaxRate] = useState(0);
  const [lastReceiptType, setLastReceiptType] = useState<'SI' | 'DR'>('SI');
  const [isProcessingTerminal, setIsProcessingTerminal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, cRes, custRes, settingsRes] = await Promise.all([
        api.get('/api/products?all=1'),
        api.get('/api/categories'),
        api.get('/api/customers'),
        api.get('/api/settings'),
      ]);
      setProducts(pRes.data.products || []);
      setCategories(cRes.data.categories || []);
      setCustomers(custRes.data.customers || []);
      
      // Parse SA list from settings
      if (settingsRes.data?.service_advisors) {
        try {
          const parsed = Array.isArray(settingsRes.data.service_advisors)
            ? settingsRes.data.service_advisors
            : JSON.parse(settingsRes.data.service_advisors);
          setServiceAdvisors(parsed);
        } catch (e) {
          console.error("Failed to parse SAs", e);
        }
      }
    } catch (err) {
      console.error('POS data fetch failed', err);
      setError('Failed to sync with inventory system. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQty = Math.max(1, Math.min(item.quantity + delta, item.stock));
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const finalTotal = Math.max(0, subtotal - parseFloat(discount || '0'));

  const handleCheckout = async (status: 'pending' | 'completed' = 'completed') => {
    if (cart.length === 0) return;
    if (receiptType === 'SI' && (!tin.trim() || !businessAddress.trim())) {
      alert('TIN and Business Address are required for a Sales Invoice (SI).');
      return;
    }
    try {
      if (paymentMethod === 'card') {
        setIsProcessingTerminal(true);
        try {
          // 1. Call the Terminal Service
          const terminalRes = await api.post('/api/terminal/payment', { amount: finalTotal });
          if (terminalRes.data.status !== "APPROVED") {
            alert(`Terminal Error: ${terminalRes.data.error_message || "Transaction Declined"}`);
            setIsProcessingTerminal(false);
            return;
          }
          // The terminal approved the transaction. Proceed to save the order.
        } catch (termErr: any) {
          alert(`Failed to communicate with terminal: ${termErr.message}`);
          setIsProcessingTerminal(false);
          return;
        }
        setIsProcessingTerminal(false);
      }

      const payload = {
        customer_id: customerId ? parseInt(customerId) : null,
        guest_name: !customerId ? guestName : '',
        guest_phone: !customerId ? guestPhone : '',
        service_advisor_name: serviceAdvisorName,
        payment_method: paymentMethod,
        discount_amount: parseFloat(discount),
        status: status,
        receipt_type: receiptType,
        tin: tin,
        business_address: businessAddress,
        withholding_tax_rate: parseFloat(withholdingTaxRate) || 0,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      };
      
      const res = await api.post('/api/orders', payload);
      setLastOrder(res.data.order);
      setLastTin(tin);
      setLastBusinessAddress(businessAddress);
      setLastWithholdingTaxRate(parseFloat(withholdingTaxRate) || 0);
      setLastReceiptType(receiptType);
      
      setCart([]);
      setCheckoutModalOpen(false);
      setSuccessModalOpen(true);
      setGuestName('');
      setGuestPhone('');
      setServiceAdvisorName('');
      setTin('');
      setBusinessAddress('');
      setWithholdingTaxRate('0');
      // Keep selected print mechanism
      fetchData(); // Refresh stock and meta
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string, details?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Checkout failed';
      const detailMessage = axiosError.response?.data?.details ? `\nDetails: ${axiosError.response.data.details}` : '';
      alert(`${errorMessage}${detailMessage}`);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase()?.includes(search.toLowerCase()) || false;
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left Column: Product Selection */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name or specialized field..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-[50%] no-scrollbar">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === null 
                  ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' 
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                ALL
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id 
                    ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {cat.name?.toUpperCase() || 'CATEGORY'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-gray-400 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Inventory Database...</div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="p-4 bg-red-50 rounded-full mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Sync Connection Error</h3>
              <p className="text-gray-500 text-sm max-w-xs mb-6">{error}</p>
              <button 
                onClick={fetchData}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
              >
                RETRY CONNECTION
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
              <Package className="w-12 h-12 stroke-[1.5px]" />
              <p>No products match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className={`flex flex-col text-left bg-white rounded-2xl border transition-all active:scale-95 group relative overflow-hidden ${
                    p.stock <= 0 
                    ? 'opacity-60 cursor-not-allowed border-gray-200' 
                    : 'border-gray-100 hover:border-gray-900 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.category?.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.stock <= 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        STK: {p.stock}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 leading-tight mb-1 line-clamp-2">{p.name}</h3>
                    <p className="text-lg font-black text-indigo-600">₱{p.price.toLocaleString()}</p>
                  </div>
                  {p.stock <= 0 && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-xl">OUT OF STOCK</span>
                    </div>
                  )}
                  <div className="h-1 w-full bg-gray-50 group-hover:bg-gray-900 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Right Column: Cart & Summary */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-900" />
            <h2 className="font-bold text-gray-900 uppercase tracking-tighter">Current Transaction</h2>
          </div>
          <span className="bg-gray-900 text-white text-[10px] font-black px-2 py-1 rounded-full">{cart.length} ITEMS</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 uppercase tracking-widest">Cart is empty</p>
                <p className="text-xs text-gray-500 mt-1">Add items from the menu to build an order.</p>
              </div>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-3 items-start bg-gray-50 p-3 rounded-2xl border border-gray-100 group">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{item.name}</h4>
                  <p className="text-[10px] text-gray-500 font-medium">₱{item.price.toLocaleString()} per unit</p>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg">
                      <button onClick={() => updateQuantity(item.id, -1)} className="px-2 py-1 text-gray-400 hover:text-gray-900 transition-colors">-</button>
                      <span className="text-xs font-black min-w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="px-2 py-1 text-gray-400 hover:text-gray-900 transition-colors">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-900">₱{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium tracking-tight">Processing Subtotal</span>
              <span className="font-bold text-gray-900">₱{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium tracking-tight">Applied Discount</span>
              </div>
              <input 
                type="number" 
                className="w-20 text-right bg-transparent border-b border-gray-300 text-sm font-bold focus:border-indigo-600 outline-none"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-end">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Grand Total Amount</span>
              <span className="text-3xl font-black text-gray-900 tracking-tighter leading-none">₱{finalTotal.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => setCheckoutModalOpen(true)}
            disabled={cart.length === 0}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              cart.length === 0 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-200 active:shadow-none'
            }`}
          >
            PROCESS CHECKOUT
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      <Modal open={checkoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title="Finalize Sale" maxWidth="max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-2">
          {/* Left Column: Customer & Service Info */}
          <div className="space-y-5">
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Customer Details</h3>
              <div className="space-y-4">
                <FormField
                  label="Customer Identity"
                  type="select"
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder="Search customer..."
                  options={[
                    { value: '', label: 'WALK-IN CUSTOMER' },
                    ...customers.map(c => ({ value: c.id, label: c.name.toUpperCase() }))
                  ]}
                />
                {!customerId && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                    <FormField label="Guest Name" value={guestName} onChange={setGuestName} placeholder="Enter full name" />
                    <FormField label="Contact" value={guestPhone} onChange={setGuestPhone} placeholder="09XX XXX XXXX" />
                  </div>
                )}
                <FormField
                  label="Assigned Advisor (Optional)"
                  type="select"
                  value={serviceAdvisorName}
                  onChange={setServiceAdvisorName}
                  placeholder="Select a Service Advisor..."
                  options={[
                    { value: '', label: 'NONE SELECTED' },
                    ...serviceAdvisors.map(sa => ({ value: sa, label: sa.toUpperCase() }))
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Record & Payment Protocol */}
          <div className="space-y-5 md:pl-6 md:border-l border-gray-100">
             <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Paperwork & Payment</h3>
              <div className="space-y-4">
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button 
                    onClick={() => setReceiptType('SI')}
                    className={`flex-1 py-2 text-[10px] font-black tracking-widest uppercase transition-all rounded-lg ${
                      receiptType === 'SI' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Sales Invoice
                  </button>
                  <button 
                    onClick={() => setReceiptType('DR')}
                    className={`flex-1 py-2 text-[10px] font-black tracking-widest uppercase transition-all rounded-lg ${
                      receiptType === 'DR' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Delivery Receipt
                  </button>
                </div>

                {receiptType === 'SI' && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in-95 duration-200 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <FormField label="Tax Identification (TIN)" value={tin} onChange={setTin} required placeholder="000-000-000" />
                    <FormField label="Withholding (%)" type="number" value={withholdingTaxRate} onChange={setWithholdingTaxRate} placeholder="0" />
                    <div className="col-span-2">
                      <FormField label="Business Address" value={businessAddress} onChange={setBusinessAddress} required placeholder="Full registered address" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Payment Protocol</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['cash', 'gcash', 'card', 'bank_transfer'].map(method => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`p-3 rounded-xl border text-[10px] font-black uppercase transition-all ${
                          paymentMethod === method 
                          ? 'bg-gray-900 text-white border-gray-900 shadow-md' 
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-900 hover:text-gray-900'
                        }`}
                      >
                        {method.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6">
            <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Final Amount Due</span>
            <span className="text-4xl font-black text-gray-900 tracking-tighter">₱{finalTotal.toLocaleString()}</span>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleCheckout('pending')}
              disabled={isProcessingTerminal}
              className={`w-1/3 py-5 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl hover:border-gray-900 hover:text-gray-900 text-[11px] font-black uppercase tracking-widest transition-all ${
                isProcessingTerminal ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              SAVE PENDING
            </button>
            <button
              onClick={() => handleCheckout('completed')}
              disabled={isProcessingTerminal}
              className={`flex-1 py-5 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all shadow-xl active:scale-[0.98] ${
                isProcessingTerminal 
                  ? 'bg-gray-300 cursor-not-allowed shadow-none border border-transparent text-gray-500' 
                  : 'bg-gray-900 hover:bg-black shadow-gray-200/50'
              }`}
            >
              {isProcessingTerminal ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                  WAITING ON TERMINAL
                </span>
              ) : (
                'CONFIRM & PRINT'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal open={successModalOpen} onClose={() => setSuccessModalOpen(false)} title="Success">
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tighter mb-2 uppercase">
            Order {lastOrder?.status === 'pending' ? 'Saved' : 'Recorded'}
          </h3>
          <p className="text-gray-500 text-sm font-medium mb-8">
            Order #{lastOrder?.id} has been {lastOrder?.status === 'pending' ? 'saved as pending.' : 'processed and stock updated.'}
          </p>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
               onClick={() => { 
                 if (lastOrder) {
                   if (lastReceiptType === 'SI') {
                     printReceipt(lastOrder, lastTin, lastBusinessAddress, lastWithholdingTaxRate); 
                   } else {
                     printDeliveryReceipt(lastOrder, lastTin, lastBusinessAddress, lastWithholdingTaxRate);
                   }
                 }
                 setSuccessModalOpen(false); 
               }}
               className="flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all"
            >
              <Printer className="w-4 h-4" />
              PRINT {lastReceiptType}
            </button>
            <button
               onClick={() => setSuccessModalOpen(false)}
               className="py-3 bg-white border border-gray-200 text-gray-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
            >
              NEW SALE
            </button>
          </div>
        </div>

      </Modal>
    </div>
  );
}
