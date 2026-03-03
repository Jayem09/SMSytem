import { useState, useEffect } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
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
  created_at: string;
  items?: OrderItem[];
  customer?: { name: string };
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Checkout State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState('0');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isProcessingTerminal, setIsProcessingTerminal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, cRes, custRes] = await Promise.all([
        api.get('/api/products?all=1'),
        api.get('/api/categories'),
        api.get('/api/customers'),
      ]);
      setProducts(pRes.data.products || []);
      setCategories(cRes.data.categories || []);
      setCustomers(custRes.data.customers || []);
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

  const handleCheckout = async () => {
    if (cart.length === 0) return;
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
        payment_method: paymentMethod,
        discount_amount: parseFloat(discount),
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      };
      
      const res = await api.post('/api/orders', payload);
      setLastOrder(res.data.order);
      setCart([]);
      setCheckoutModalOpen(false);
      setSuccessModalOpen(true);
      setGuestName('');
      setGuestPhone('');
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
      <Modal open={checkoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title="Finalize Sale">
        <div className="space-y-4">
          <FormField
            label="Customer"
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
            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <FormField label="Guest Name" value={guestName} onChange={setGuestName} placeholder="Enter full name" />
              <FormField label="Contact Number" value={guestPhone} onChange={setGuestPhone} placeholder="09XX XXX XXXX" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
             <div className="col-span-2">
               <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Payment Protocol</label>
               <div className="grid grid-cols-2 gap-2">
                 {['cash', 'gcash', 'card', 'bank_transfer'].map(method => (
                   <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-xl border text-[10px] font-black uppercase transition-all ${
                      paymentMethod === method 
                      ? 'bg-gray-900 text-white border-gray-900 shadow-lg' 
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-900'
                    }`}
                   >
                     {method.replace('_', ' ')}
                   </button>
                 ))}
               </div>
             </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center mt-6">
            <span className="text-sm font-bold text-gray-500">Amount Due</span>
            <span className="text-2xl font-black text-gray-900">₱{finalTotal.toLocaleString()}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={isProcessingTerminal}
            className={`w-full mt-4 py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl ${
              isProcessingTerminal 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-100'
            }`}
          >
            {isProcessingTerminal ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                WAITING FOR TERMINAL...
              </span>
            ) : (
              'CONFIRM TRANSACTION'
            )}
          </button>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal open={successModalOpen} onClose={() => setSuccessModalOpen(false)} title="Sale Successful">
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tighter mb-2 uppercase">Transaction Recorded</h3>
          <p className="text-gray-500 text-sm font-medium mb-8">Order #{lastOrder?.id} has been processed and stock updated.</p>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
               onClick={() => { window.print(); setSuccessModalOpen(false); }}
               className="flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all"
            >
              <Printer className="w-4 h-4" />
              PRINT RECEIPT
            </button>
            <button
               onClick={() => setSuccessModalOpen(false)}
               className="py-3 bg-white border border-gray-200 text-gray-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
            >
              NEW SALE
            </button>
          </div>
        </div>

        {/* Hidden Printable Receipt */}
        {lastOrder && (
          <div className="hidden">
            <div id="printable-invoice" className="p-8 text-gray-900 font-sans">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-black">SM TYRE DEPOT</h1>
                <p className="text-xs font-bold uppercase tracking-widest">Premium Auto Care & Tyres</p>
                <div className="mt-4 border-t border-b border-gray-900 py-2">
                  <h2 className="text-lg font-bold">SALES RECEIPT</h2>
                  <p className="text-sm">Order #{lastOrder.id}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-bold">Date: {new Date(lastOrder.created_at).toLocaleDateString()}</p>
                <p className="text-sm">Payment: {lastOrder.payment_method.toUpperCase()}</p>
                {lastOrder.customer ? (
                  <p className="text-sm">Customer: {lastOrder.customer.name}</p>
                ) : lastOrder.guest_name ? (
                  <div className="mt-2 text-sm border-t border-gray-100 pt-2">
                    <p className="font-bold">Walk-in Customer:</p>
                    <p>{lastOrder.guest_name}</p>
                    {lastOrder.guest_phone && <p>{lastOrder.guest_phone}</p>}
                  </div>
                ) : (
                  <p className="text-sm">Customer: WALK-IN</p>
                )}
              </div>

              <table className="w-full mb-6 text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lastOrder.items?.map((item: OrderItem) => (
                    <tr key={item.id}>
                      <td className="py-2 font-bold">{item.product?.name}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">₱{item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t-2 border-gray-900 pt-4 text-right">
                <p className="text-sm text-gray-500">Discount: ₱{lastOrder.discount_amount?.toLocaleString()}</p>
                <p className="text-xl font-black">Total: ₱{lastOrder.total_amount.toLocaleString()}</p>
              </div>

              <div className="mt-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Thank you for choosing SM Tyre Depot!<br/>
                Please keep this for your records.
              </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * { visibility: hidden; }
                #printable-invoice, #printable-invoice * { visibility: visible; }
                #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; }
              }
            `}} />
          </div>
        )}
      </Modal>
    </div>
  );
}
