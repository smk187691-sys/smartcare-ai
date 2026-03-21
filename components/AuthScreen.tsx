import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const AuthScreen: React.FC = () => {
  const { signup, sendOtp, verifyOtp } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m: 'login' | 'signup') => {
    setMode(m);
    setStep('phone');
    setError('');
    setOtp('');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      setError('Please enter a valid 10-digit phone number starting with 6, 7, 8, or 9.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (mode === 'signup' && email && !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // slight delay for feel
    const result = sendOtp(phoneNumber);
    setLoading(false);

    if (result.success) {
      setStep('otp');
    } else {
      setError(result.error || 'Failed to send OTP.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    
    if (mode === 'login') {
      const result = verifyOtp(phoneNumber, otp);
      setLoading(false);
      if (!result.success) setError(result.error || 'Invalid OTP.');
    } else {
      // Signup verification
      const result = verifyOtp(phoneNumber, otp, name, email);
      setLoading(false);
      if (!result.success) setError(result.error || 'Invalid OTP.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #134e4a 100%)'
    }}>
      {/* Top decorative blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
      <div className="absolute top-10 right-0 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

      {/* Hero / Branding */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6 relative z-10">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <svg className="w-11 h-11 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">SmartCare AI</h1>
        <p className="text-emerald-300 text-sm mt-1 font-medium">{t('home.tagline')}</p>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-5 relative z-10">
        <div className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>

          {/* Tab switcher */}
          <div className="flex m-4 rounded-2xl p-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                id={`auth-tab-${m}`}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
                  mode === m
                    ? 'text-slate-900 shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={mode === m ? { background: 'white' } : {}}
              >
                {t(m === 'login' ? 'auth.signIn' : 'auth.signUp')}
              </button>
            ))}
          </div>

          <form onSubmit={step === 'phone' ? handleSendOtp : handleSubmit} className="px-6 pb-6 space-y-4">
            {mode === 'signup' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('profile.name')}</label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Kumar"
                  disabled={step === 'otp'}
                  className="w-full px-4 py-3.5 rounded-2xl text-white text-sm outline-none transition-all"
                  style={{ 
                    background: 'rgba(255,255,255,0.07)', 
                    border: '1px solid rgba(255,255,255,0.12)',
                    opacity: step === 'otp' ? 0.6 : 1
                  }}
                  onFocus={e => (e.target.style.border = '1px solid #10b981')}
                  onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.12)')}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('auth.phone')}</label>
              <input
                id="auth-phone"
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder={t('auth.phone.placeholder')}
                disabled={step === 'otp'}
                className="w-full px-4 py-3.5 rounded-2xl text-white text-sm outline-none transition-all"
                style={{ 
                  background: 'rgba(255,255,255,0.07)', 
                  border: '1px solid rgba(255,255,255,0.12)',
                  opacity: step === 'otp' ? 0.6 : 1
                }}
                onFocus={e => (e.target.style.border = '1px solid #10b981')}
                onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.12)')}
                autoComplete="tel"
              />
            </div>

            {step === 'otp' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('auth.otp')}</label>
                <input
                  id="auth-otp"
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder={t('auth.otp.placeholder')}
                  className="w-full px-4 py-3.5 rounded-2xl text-white text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                  onFocus={e => (e.target.style.border = '1px solid #10b981')}
                  onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.12)')}
                />
                <button 
                  type="button" 
                  onClick={() => setStep('phone')}
                  className="text-[10px] text-emerald-400 mt-1 hover:underline"
                >
                  Change Phone Number
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <>
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('auth.emailOptional')}</label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={step === 'otp'}
                    className="w-full px-4 py-3.5 rounded-2xl text-white text-sm outline-none transition-all"
                    style={{ 
                      background: 'rgba(255,255,255,0.07)', 
                      border: '1px solid rgba(255,255,255,0.12)',
                      opacity: step === 'otp' ? 0.6 : 1
                    }}
                    onFocus={e => (e.target.style.border = '1px solid #10b981')}
                    onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.12)')}
                    autoComplete="email"
                  />
                </div>
              </>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start space-x-2 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 animate-in fade-in duration-200">
                <svg className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-rose-300 text-xs font-medium">{error}</p>
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:scale-95 shadow-lg mt-2"
              style={{
                background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: loading ? 'none' : '0 8px 32px rgba(16,185,129,0.3)'
              }}
            >
              {loading
                ? <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    <span>Please wait...</span>
                  </span>
                : mode === 'login' 
                  ? (step === 'phone' ? t('auth.sendOtp') : t('auth.verifyOtp')) 
                  : t('auth.create')
              }
            </button>

            <p className="text-center text-xs text-slate-500 pb-2">
              {t(mode === 'login' ? 'auth.noAccount' : 'auth.hasAccount')}
              <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors">
                {t(mode === 'login' ? 'auth.signUp' : 'auth.signIn')}
              </button>
            </p>
          </form>
        </div>
      </div>

      <div className="text-center py-6 text-slate-600 text-xs relative z-10">
        Your data stays on your device. 🔒
      </div>
    </div>
  );
};

export default AuthScreen;
