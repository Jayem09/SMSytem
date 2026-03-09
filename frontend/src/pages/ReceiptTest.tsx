import { useState } from 'react';
import { generateReceiptHTML } from '../components/Receipt';
import { generateDeliveryReceiptHTML } from '../components/DeliveryReceipt';

// Dummy data for testing the receipt alignment
const dummyOrder = {
  id: 12345,
  total_amount: 15000,
  discount_amount: 0,
  payment_method: 'CASH',
  created_at: new Date().toISOString(),
  customer: {
    name: 'JUAN DELA CRUZ',
    address: '123 RIZAL ST. MANILA',
  },
  items: [
    {
      id: 1,
      quantity: 4,
      price: 3500,
      subtotal: 14000,
      product: { name: 'MICHELIN LTX FORCE 265/70 R16' }
    },
    {
      id: 2,
      quantity: 1,
      price: 1000,
      subtotal: 1000,
      product: { name: 'WHEEL ALIGNMENT' }
    }
  ]
};

const dummyTin = '123-456-789-000';
const dummyAddress = '123 RIZAL ST. MANILA';
const dummyWhTaxRate = 1;

export default function ReceiptTest() {
  const [type, setType] = useState<'SI' | 'DR'>('SI');

  const htmlDoc = type === 'SI' 
    ? generateReceiptHTML(dummyOrder, dummyTin, dummyAddress, dummyWhTaxRate)
    : generateDeliveryReceiptHTML(dummyOrder, dummyTin, dummyAddress, dummyWhTaxRate);

  return (
    <div className="w-full h-screen flex flex-col items-center bg-gray-100 p-4">
      <div className="w-full max-w-5xl flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Receipt Live Preview</h1>
        
        <div className="flex bg-gray-200 rounded-lg p-1">
          <button 
            onClick={() => setType('SI')}
            className={`px-4 py-1 text-sm font-bold rounded-md transition-all ${type === 'SI' ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Sales Invoice
          </button>
          <button 
            onClick={() => setType('DR')}
            className={`px-4 py-1 text-sm font-bold rounded-md transition-all ${type === 'DR' ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Delivery Receipt
          </button>
        </div>

        <p className="text-gray-500 text-sm">
          Edit <code className="bg-gray-200 px-1 rounded">{type === 'SI' ? 'Receipt.tsx' : 'DeliveryReceipt.tsx'}</code> and save to see changes live.
        </p>
      </div>

      <div className="flex-1 w-full max-w-5xl bg-white shadow-xl overflow-hidden rounded-lg">
        {/* We use an iframe with srcDoc so the HTML renders isolated with its own styles */}
        <iframe 
          title="Receipt Preview" 
          srcDoc={htmlDoc} 
          className="w-full h-full border-none" 
        />
      </div>
    </div>
  );
}
