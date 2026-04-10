import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { printReceipt } from '../components/Receipt';
import { printDeliveryReceipt } from '../components/DeliveryReceipt';
import {
  Search, ShoppingCart, Trash2, Printer, CheckCircle, Package
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { usePOS, type POSProduct } from '../hooks/usePOS';

interface Product {
  id: number;
  name: string;
  price: number;
  branch_stock: number;
  stock?: number;
  is_service?: boolean;
  image_url?: string;
  category_id: number;
  category?: { name: string };
  points_required?: number;
  is_reward?: boolean;
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

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  rfid_card_id?: string;
  loyalty_points?: number;
}

export default function POS() {
  const { state, dispatch, addToCart, removeFromCart, updateQuantity, clearCart, setSearch, setCategory, subtotal: posSubtotal, filteredProducts } = usePOS();
  const { products, categories, customers, cart, search, selectedCategory, loading, error } = state;

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [serviceAdvisorName, setServiceAdvisorName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [tin, setTin] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [withholdingTaxRate, setWithholdingTaxRate] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptType, setReceiptType] = useState<'SI' | 'DR'>('SI');
  const [discount, setDiscount] = useState('0');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [lastTin, setLastTin] = useState('');
  const [lastBusinessAddress, setLastBusinessAddress] = useState('');
  const [lastWithholdingTaxRate, setLastWithholdingTaxRate] = useState(0);
  const [lastReceiptType, setLastReceiptType] = useState<'SI' | 'DR'>('SI');
  const [isProcessingTerminal, setIsProcessingTerminal] = useState(false);

  // RFID & Loyalty State
  const [isRfidScanning, setIsRfidScanning] = useState(false);
  const [rfidBuffer, setRfidBuffer] = useState('');
  const [rfidError, setRfidError] = useState(false);
  const [rfidCustomer, setRfidCustomer] = useState<Customer | null>(null);
  const [selectedReward, setSelectedReward] = useState<Product | null>(null);

  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const [pRes, cRes, custRes] = await Promise.all([
        api.get('/api/products?all=1'),
        api.get('/api/categories'),
        api.get('/api/customers'),
      ]);
      dispatch({ type: 'SET_PRODUCTS', payload: (pRes.data as { products?: POSProduct[] }).products || [] });
      dispatch({ type: 'SET_CATEGORIES', payload: (cRes.data as { categories?: { id: number; name: string }[] }).categories || [] });
      dispatch({ type: 'SET_CUSTOMERS', payload: (custRes.data as { customers?: { id: number; name: string }[] }).customers || [] });
    } catch {
      console.error('POS data fetch failed');
      dispatch({ type: 'SET_ERROR', payload: 'Failed to sync with inventory system. Please check your connection.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  // RFID Scanner Logic - Only active when explicitly scanning
  const rfidInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRfidScanning && rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  }, [isRfidScanning]);

  const handleRfidInputChange = (value: string) => {
    // Check for Enter key ( RFID scanner sends Enter at the end )
    if (value.includes('\n') || value.endsWith('\r')) {
      const cleanValue = value.replace(/[\r\n]/g, '').trim();
      if (cleanValue.length >= 8) {
        handleRfidScan(cleanValue);
      }
      setRfidBuffer('');
      setIsRfidScanning(false);
      return;
    }
    setRfidBuffer(value);
  };

  const handleRfidInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setRfidBuffer('');
      setIsRfidScanning(false);
    }
  };

  const handleRfidScan = async (uid: string) => {
    try {
      const res = await api.get(`/api/customers/rfid/${uid}`);
      const data = res.data as { customer?: Customer };
      if (data?.customer) {
        setRfidCustomer(data.customer);
        setCustomerId(data.customer.id.toString());
        setRfidError(false);
        showToast(`Welcome back, ${data.customer.name}!`, 'success');
      } else {
        setRfidError(true);
        setRfidCustomer(null);
        showToast('RFID card not recognized.', 'error');
      }
    } catch {
      setRfidError(true);
      setRfidCustomer(null);
    }
  };

  const clearRfidCustomer = () => {
    setRfidCustomer(null);
    setCustomerId('');
    setRfidBuffer('');
    setSelectedReward(null);
    setRfidError(false);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const finalTotal = Math.max(0, posSubtotal - parseFloat(discount || '0'));
  const earnedPoints = Math.floor(posSubtotal / 200);

  const handleAddToCart = (product: Product) => {
    if (!product.is_service && product.branch_stock <= 0) return;
    addToCart(product as POSProduct);
  };

  const handleCheckout = async (status: 'pending' | 'completed' = 'completed') => {
    if (cart.length === 0) return;
    if (receiptType === 'SI' && !businessAddress.trim()) {
      showToast('Business Address is required for a Sales Invoice (SI).', 'error');
      return;
    }
    // Validate: If RFID was scanned but not found, block checkout
    if (rfidError) {
      showToast('Invalid RFID card. Please scan a registered card or select customer manually.', 'error');
      return;
    }
    try {
      if (paymentMethod === 'card') {
        setIsProcessingTerminal(true);
        try {
          const terminalRes = await api.post('/api/terminal/payment', { amount: finalTotal });
          const terminalData = terminalRes.data as { status: string; error_message?: string };
          if (terminalData.status !== "APPROVED") {
            showToast(`Terminal Error: ${terminalData.error_message || "Transaction Declined"}`, 'error');
            setIsProcessingTerminal(false);
            return;
          }

        } catch (termErr: unknown) {
          const err = termErr instanceof Error ? termErr.message : 'Unknown error';
          showToast(`Failed to communicate with terminal: ${err}`, 'error');
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
        reward_id: selectedReward?.id || null,
        reward_points: selectedReward?.points_required || 0,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      };

      const res = await api.post('/api/orders', payload);
      const orderResData = res.data as { order: Order };
      setLastOrder(orderResData.order);
      setLastTin(tin);
      setLastBusinessAddress(businessAddress);
      setLastWithholdingTaxRate(parseFloat(withholdingTaxRate) || 0);
      setLastReceiptType(receiptType);

      clearCart();
      setCheckoutModalOpen(false);
      setSuccessModalOpen(true);

      setCustomerId('');
      setGuestName('');
      setGuestPhone('');
      setServiceAdvisorName('');
      setTin('');
      setBusinessAddress('');
      setWithholdingTaxRate('0');
      setPaymentMethod('cash');
      setReceiptType('SI');
      setDiscount('0');
      setSelectedReward(null);

      fetchData();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string, details?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Checkout failed';
      const detailMessage = axiosError.response?.data?.details ? `\nDetails: ${axiosError.response.data.details}` : '';
      showToast(`${errorMessage}${detailMessage}`, 'error');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      { }
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
                onClick={() => setCategory(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === null
                  ? 'bg-gray-900 text-white shadow-lg shadow-gray-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
              >
                ALL
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id
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
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              { }
              <div className="grid grid-cols-[2fr_1fr_auto_auto] gap-0 border-b border-gray-100 bg-gray-50">
                <div className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</div>
                <div className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Price</div>
                <div className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</div>
                <div className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"></div>
              </div>
              { }
              {filteredProducts.map((p, idx) => {
                const outOfStock = !p.is_service && p.branch_stock <= 0;
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[2fr_1fr_auto_auto] gap-0 items-center border-b border-gray-50 transition-colors ${outOfStock ? 'opacity-50' : 'hover:bg-indigo-50/40 cursor-pointer'
                      } ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    onClick={() => !outOfStock && handleAddToCart(p)}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.is_service && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 uppercase tracking-widest shrink-0">SVC</span>
                        )}
                        <div>
                          <div className="text-sm font-semibold text-gray-900 leading-tight">{p.name}</div>
                          <div className="text-[10px] text-gray-400 font-medium">{p.category?.name}</div>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <span className="text-sm font-black text-indigo-600">₱{p.price.toLocaleString()}</span>
                    </div>
                    <div className="px-4 py-3">
                      {p.is_service ? (
                        <span className="text-[10px] font-bold text-gray-400">N/A</span>
                      ) : outOfStock ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-600">OUT</span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.branch_stock <= 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {p.branch_stock}
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-3">
                      <button
                        disabled={outOfStock}
                        onClick={(e) => { e.stopPropagation(); if (!outOfStock) handleAddToCart(p); }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${outOfStock
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:bg-indigo-600 active:scale-95 shadow-sm'
                          }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      { }
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-900" />
            <h2 className="font-bold text-gray-900 uppercase tracking-tighter">Current Transaction</h2>
          </div>
          <span className="bg-gray-900 text-white text-[10px] font-black px-2 py-1 rounded-full">{cart.length} ITEMS</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
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
                      <button onClick={() => updateQuantity(item.id, -1)} className="px-2 py-1 text-gray-400 hover:text-gray-900 transition-all duration-200">-</button>
                      <span className="text-xs font-black min-w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="px-2 py-1 text-gray-400 hover:text-gray-900 transition-all duration-200">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-all duration-200">
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

        <div className="flex-none p-6 bg-gray-50 border-t border-gray-200 space-y-4">
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
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${cart.length === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-200 active:shadow-none'
              }`}
          >
            PROCESS CHECKOUT
          </button>
        </div>
      </div>

      { }
      <Modal open={checkoutModalOpen} onClose={() => {
        setCheckoutModalOpen(false);
        setIsRfidScanning(false);
        setRfidBuffer('');
        setRfidError(false);
      }} title="Finalize Sale" maxWidth="max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Customer */}
          <div className="space-y-4">
            {/* RFID Card Section */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">RFID Card</span>
                {rfidCustomer && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Linked</span>
                )}
              </div>

              {isRfidScanning ? (
                <div className="relative">
                  <input
                    ref={rfidInputRef}
                    type="text"
                    autoFocus
                    readOnly
                    placeholder="Tap RFID card or type ID..."
                    className="w-full px-4 py-3 border-2 border-indigo-500 rounded-lg text-sm font-medium bg-white"
                    onChange={(e) => handleRfidInputChange(e.target.value)}
                    onKeyDown={handleRfidInputKeyDown}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                  {rfidBuffer && (
                    <div className="text-xs text-gray-400 mt-1 ml-1">Receiving: {rfidBuffer}</div>
                  )}
                </div>
              ) : rfidCustomer ? (
                <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-emerald-200">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{rfidCustomer.name}</p>
                    <p className="text-xs text-gray-500">{rfidCustomer.loyalty_points?.toFixed(0) || 0} points</p>
                  </div>
                  <button onClick={clearRfidCustomer} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : rfidError ? (
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <p className="text-sm text-red-600">RFID card not recognized</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsRfidScanning(true);
                      setRfidBuffer('');
                    }}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  >
                    Click to Scan RFID Card
                  </button>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Or enter card number manually..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          handleRfidScan(input.value);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          handleRfidScan(e.target.value.trim());
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousSibling as HTMLInputElement;
                        if (input?.value.trim()) {
                          handleRfidScan(input.value.trim());
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-indigo-600 text-white text-xs rounded"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Customer Select */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer</label>
              <select
                value={customerId}
                onChange={async (e) => {
                  const cid = e.target.value;
                  setCustomerId(cid);
                  setRfidCustomer(null);
                  setSelectedReward(null);
                  // Fetch customer data if selected
                  if (cid) {
                    try {
                      const res = await api.get(`/api/customers/${cid}`);
                      const data = res.data as { customer?: Customer };
                      if (data?.customer) {
                        setRfidCustomer(data.customer);
                      }
                    } catch {
                      // ignore
                    }
                  }
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Walk-in Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {!customerId && !rfidCustomer && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Guest Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Contact</label>
                  <input
                    type="text"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
              </div>
            )}

            {/* Loyalty Points - Separate Add and Redeem */}
            {customerId && (
              <>
                {(() => {
                  const selectedCustomer = rfidCustomer || customers.find(c => c.id === parseInt(customerId));
                  const availablePoints = selectedCustomer?.loyalty_points || 0;

                  return (
                    <div className="space-y-3">
                      {/* ADD POINTS SECTION - Earn points from this purchase */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Points</span>
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+ EARN</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            You'll earn: <span className="font-bold text-indigo-600 text-lg">+{earnedPoints} pts</span>
                          </span>
                          <span className="text-xs text-gray-400">1 point per ₱200</span>
                        </div>
                      </div>

                      {/* REDEEM POINTS SECTION - Select reward product */}
                      {availablePoints > 0 && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Redeem Reward</span>
                            <span className="text-sm font-bold text-gray-700">{Math.floor(availablePoints)} pts</span>
                          </div>

                          {/* Available Rewards - filter products that can be redeemed with available points */}
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {products.filter(p => p.is_reward && p.points_required > 0 && p.points_required <= Math.floor(availablePoints)).map(reward => (
                              <button
                                key={reward.id}
                                onClick={() => setSelectedReward(selectedReward?.id === reward.id ? null : reward)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${selectedReward?.id === reward.id
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-gray-200 hover:border-indigo-300 bg-white'
                                  }`}
                              >
                                <div className="text-left">
                                  <p className="text-sm font-bold text-gray-900">{reward.name}</p>
                                  <p className="text-xs text-gray-500">{reward.category?.name}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-black text-indigo-600">{reward.points_required} pts</span>
                                </div>
                              </button>
                            ))}
                            {products.filter(p => p.is_reward && p.points_required > 0 && p.points_required <= Math.floor(availablePoints)).length === 0 && (
                              <p className="text-xs text-gray-400 text-center py-4">No rewards available with your points</p>
                            )}
                          </div>

                          {/* Selected Reward */}
                          {selectedReward && (
                            <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-indigo-700 uppercase">Selected Reward</p>
                                  <p className="text-sm font-bold text-gray-900">{selectedReward.name}</p>
                                  <p className="text-xs text-gray-500">Use {selectedReward.points_required} points</p>
                                </div>
                                <button
                                  onClick={() => setSelectedReward(null)}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Right Column: Payment & Summary */}
          <div className="space-y-4">
            {/* Receipt Type */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Receipt Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setReceiptType('SI')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${receiptType === 'SI'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-900'
                    }`}
                >
                  Sales Invoice
                </button>
                <button
                  onClick={() => setReceiptType('DR')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${receiptType === 'DR'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-900'
                    }`}
                >
                  Delivery Receipt
                </button>
              </div>
            </div>

            {receiptType === 'SI' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">TIN</label>
                  <input
                    type="text"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="000-000-000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">WHT %</label>
                  <input
                    type="number"
                    value={withholdingTaxRate}
                    onChange={(e) => setWithholdingTaxRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Business Address</label>
                  <input
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="card">Credit Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="dated_check">Dated Check</option>
                <option value="post_dated_check">Post-Dated Check</option>
              </select>
            </div>

            {/* Discount */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Additional Discount</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>

            {/* Total */}
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase">Total Amount</span>
                <span className="text-2xl font-black text-white">₱{finalTotal.toLocaleString()}</span>
              </div>
              {selectedReward && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-400">Reward: {selectedReward.name}</span>
                  <span className="text-amber-400">-{selectedReward.points_required} pts</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleCheckout('pending')}
                className="py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:border-gray-900 transition-colors"
              >
                Hold Sale
              </button>
              <button
                onClick={() => handleCheckout('completed')}
                disabled={isProcessingTerminal}
                className="py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50 transition-colors"
              >
                {isProcessingTerminal ? 'Processing...' : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      { }
      <Modal open={successModalOpen} onClose={() => setSuccessModalOpen(false)} title="Success">
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in spin-in-12 duration-500">
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
              onClick={async () => {
                if (lastOrder) {
                  if (lastReceiptType === 'SI') {
                    await printReceipt(lastOrder, lastTin, lastBusinessAddress, lastWithholdingTaxRate);
                  } else {
                    await printDeliveryReceipt(lastOrder, lastTin, lastBusinessAddress, lastWithholdingTaxRate);
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
