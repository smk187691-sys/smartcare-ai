import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
  title: string;
  description: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess, amount, title, description }) => {
  const [processing, setProcessing] = useState(false);
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handlePayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onSuccess();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="bg-emerald-600 p-6 text-center">
          <h3 className="text-white font-bold text-xl">{title}</h3>
          <p className="text-emerald-100 text-sm mt-1">{description}</p>
        </div>
        
        <div className="p-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl mb-6">
            <span className="text-slate-500 font-semibold">{t('payment.total')}</span>
            <span className="text-2xl font-extrabold text-slate-800">₹{amount}</span>
          </div>
          
          <button
            onClick={handlePayment}
            disabled={processing}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 transition-all flex justify-center items-center ${
              processing ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {processing ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : t('payment.pay', { amount: String(amount) })}
          </button>
          
          <button
            onClick={onClose}
            disabled={processing}
            className="w-full mt-3 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {t('payment.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
