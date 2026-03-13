import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Printer, Calendar } from 'lucide-react';

interface AdvisorPerformance {
  advisor_name: string;
  tires_sold: number;
}

interface CategorySale {
  category: string;
  total_sales: number;
}

interface PaymentSummary {
  method: string;
  total: number;
}

interface DailySummary {
  date: string;
  advisor_performance: AdvisorPerformance[];
  category_sales: CategorySale[];
  payment_summary: PaymentSummary[];
  account_receivables: number;
  total_sales: number;
}

export default function DailyReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchReport(true);
    
    
    const interval = setInterval(() => fetchReport(false), 15000);
    return () => clearInterval(interval);
  }, [date]);

  const fetchReport = async (showLoading: boolean) => {
    try {
      if (showLoading) setLoading(true);
      
      const res = await api.get(`/api/reports/daily-summary?date=${date}&_t=${Date.now()}`);
      setData(res.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) return <div className="p-8 text-center text-gray-500">Loading Report...</div>;

  const totalQtySold = (data?.advisor_performance || []).reduce((acc: number, curr: AdvisorPerformance) => acc + curr.tires_sold, 0) || 0;
  
  
  const paymentMethodsDisplay = [
    { key: 'cash', label: 'CASH' },
    { key: 'dated_check', label: 'DATED CHECK' },
    { key: 'card', label: 'CREDIT CARD' },
    { key: 'bank_transfer', label: 'ONLINE PAYMENT / BANK TRANSFER' },
    { key: 'gcash', label: 'GCASH' },
    { key: 'post_dated_check', label: 'POST-DATED CHECK' },
    { key: 'claimed_downpayment', label: 'CLAIMED DOWNPAYMENT' },
    { key: 'goodyear_voucher', label: 'GOODYEAR VOUCHER' },
    { key: 'ewt', label: 'EWT' },
    { key: 'trade_in', label: 'TRADE IN' },
  ];

  const getPaymentValue = (key: string) => {
    return (data?.payment_summary || []).find((p: PaymentSummary) => p.method.toLowerCase() === key.toLowerCase())?.total || 0;
  };

  const totalGoodAsCash = (data?.payment_summary || []).reduce((acc: number, curr: PaymentSummary) => acc + curr.total, 0) || 0;

  return (
    <div className="p-8 w-full min-h-screen bg-white">
      {}
      <div className="flex justify-between items-center mb-8 no-print pb-6 border-b border-gray-100">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">DAILY SUMMARY</h1>
            {lastUpdated && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-gray-400 ml-2" />
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent border-none text-sm font-bold focus:ring-0 px-2 cursor-pointer text-gray-900"
            />
          </div>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl active:scale-95"
        >
          <Printer className="w-5 h-5" />
          PRINT DAILY REPORT
        </button>
      </div>

      {}
      <div className="text-center mb-10">
        <h2 className="text-red-600 text-4xl font-black uppercase tracking-tighter mb-2">LIPA B - MATAAS NA LUPA BRANCH</h2>
        <div className="inline-block px-6 py-2 bg-gray-900 text-white rounded-full font-black text-lg">
          {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 items-start">
        {}
        <div className="col-span-7 space-y-12">
          {}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 uppercase">Service Advisor Performance</h3>
              <span className="bg-red-50 text-red-600 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">Tires Sold</span>
            </div>
            <table className="w-full border-collapse border-4 border-black text-sm uppercase font-black">
              <thead>
                <tr className="bg-black text-white">
                  <th className="border-2 border-black px-4 py-3 w-16 text-center">NO</th>
                  <th className="border-2 border-black px-6 py-3 text-left">SERVICE ADVISOR</th>
                  <th className="border-2 border-black px-6 py-3 w-32 text-center text-[10px] leading-tight font-black uppercase tracking-tighter">QTY TIRES SOLD<br/>QTY. SOLD</th>
                </tr>
              </thead>
              <tbody>
                {(data?.advisor_performance || []).map((sa: AdvisorPerformance, i: number) => (
                  <tr key={sa.advisor_name} className="hover:bg-gray-50 transition-colors">
                    <td className="border-2 border-black px-4 py-2.5 text-center font-black">{i + 1}</td>
                    <td className="border-2 border-black px-6 py-2.5 font-black">{sa.advisor_name}</td>
                    <td className="border-2 border-black px-6 py-2.5 text-center font-black">{sa.tires_sold}</td>
                  </tr>
                ))}
                <tr className="bg-yellow-100">
                  <td colSpan={2} className="border-2 border-black px-6 py-3 text-right font-black text-lg">TOTAL QTY</td>
                  <td className="border-2 border-black px-6 py-3 text-center text-red-600 text-xl font-black">{totalQtySold}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {}
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black text-gray-900 uppercase">Sales Breakdown by Category</h3>
            </div>
            <table className="w-full border-collapse border-4 border-black text-sm uppercase font-black">
              <thead>
                <tr className="bg-black text-white">
                  <th className="border-2 border-black px-6 py-3 text-left">CATEGORY</th>
                  <th className="border-2 border-black px-6 py-3 w-48 text-center text-red-500">TOTAL SALES</th>
                </tr>
              </thead>
              <tbody>
                {(data?.category_sales || []).map((cat: CategorySale) => (
                  <tr key={cat.category} className="hover:bg-gray-50 transition-colors">
                    <td className="border-2 border-black px-6 py-2.5">{cat.category}</td>
                    <td className="border-2 border-black px-6 py-2.5 text-right font-mono">₱ {cat.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="bg-yellow-100">
                  <td className="border-2 border-black px-6 py-4 text-left text-xl font-black">TOTAL SALES</td>
                  <td className="border-2 border-black px-6 py-4 text-right text-red-600 text-2xl font-black font-mono">₱ {data?.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {}
        <div className="col-span-5 space-y-10">
          {}
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black text-gray-900 uppercase">Payment Summary</h3>
            </div>
            <table className="w-full border-collapse border-4 border-black text-sm uppercase font-black">
              <thead>
                <tr className="bg-black text-white">
                  <th colSpan={3} className="border-2 border-black px-6 py-3 text-center text-red-500">GOOD AS CASH SALES AS OF 6:00 PM</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethodsDisplay.map((pm) => (
                  <tr key={pm.key} className="hover:bg-gray-50 transition-colors">
                    <td className="border-2 border-black px-6 py-2.5 w-1/2">{pm.label}</td>
                    <td className="border-2 border-black px-6 py-2.5 text-right text-red-600 font-mono w-1/2">
                      {getPaymentValue(pm.key) > 0 ? `₱ ${getPaymentValue(pm.key).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-yellow-100">
                  <td className="border-2 border-black px-6 py-4 text-left font-black tracking-tight">TOTAL GOOD AS CASH AS OF :</td>
                  <td className="border-2 border-black px-6 py-4 text-right text-red-600 text-2xl font-black font-mono">
                    ₱ {totalGoodAsCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {}
          <section className="bg-yellow-100 border-4 border-black p-6 flex justify-between items-center shadow-lg">
            <div>
              <span className="text-xl font-black uppercase text-gray-900 block">ACCOUNT RECEIVABLES</span>
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">Outstanding Pending Balance</span>
            </div>
            <span className="text-red-600 text-4xl font-black font-mono tracking-tighter">₱ {data?.account_receivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </section>
        </div>
      </div>

      {}
      <style>{`
        @media print {
          @page {
            margin: 0.5cm;
            size: portrait;
          }
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .min-h-screen { min-height: 0 !important; }
          main { margin: 0 !important; padding: 0 !important; margin-left: 0 !important; }
          .p-8 { padding: 0 !important; }
          .w-full { width: 100% !important; }
          
          
          .grid-cols-12 { display: flex !important; gap: 20px !important; }
          .col-span-7 { width: 58% !important; }
          .col-span-5 { width: 42% !important; }
          
          table { page-break-inside: avoid; border-width: 2pt !important; }
          th, td { border-width: 1pt !important; }
          .bg-black { background-color: black !important; color: white !important; }
          .bg-yellow-100 { background-color: #fef9c3 !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-900 { background-color: #111827 !important; color: white !important; }
          .text-red-600 { color: #dc2626 !important; }
          .text-red-500 { color: #ef4444 !important; }
        }
      `}</style>
    </div>
  );
}
