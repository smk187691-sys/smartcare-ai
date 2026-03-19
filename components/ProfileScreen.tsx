
import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  
  const handleUpload = (docName: string) => {
    // Mock upload delay
    setTimeout(() => {
      setUploadedDocs(prev => ({ ...prev, [docName]: true }));
    }, 1000);
  };

  if (!user) return null;

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const joinDate = new Date(user.joinedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="relative overflow-hidden px-6 pt-12 pb-10"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #10b981, transparent 60%)' }} />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)' }}>
            <span className="text-3xl font-extrabold text-white">{initials}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">{user.name}</h2>
          <p className="text-emerald-300 text-sm mt-1">{user.email}</p>
          <div className="mt-3 px-4 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1.5"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <span className="text-emerald-400">●</span>
            <span className="text-emerald-300">{t('profile.member')}</span>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '📅', label: t('profile.joined'), value: joinDate.split(' ').slice(1).join(' ') },
            { icon: '✨', label: t('profile.features'), value: t('profile.allActive') },
            { icon: '🔒', label: t('profile.data'), value: t('profile.onDevice') },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-xl mb-1">{s.icon}</span>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="text-xs font-bold text-slate-700 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Account details */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('profile.account')}</p>
          </div>
          {[
            { label: t('profile.name'), value: user.name },
            { label: t('profile.email'), value: user.email },
            { label: t('profile.memberSince'), value: joinDate },
          ].map(item => (
            <div key={item.label} className="flex items-center px-5 py-4 border-b border-slate-50 last:border-0">
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Digital Locker */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center space-x-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t('profile.locker.title')}</p>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-500 -mt-2 mb-4 leading-relaxed">{t('profile.locker.desc')}</p>
            
            {[
              { id: 'aadhaar', name: 'Aadhaar Card', icon: '🪪' },
              { id: 'ration', name: 'Ration Card', icon: '🌾' },
              { id: 'farmer', name: 'Farmer ID (Kisan Card)', icon: '👨‍🌾' },
            ].map(doc => (
              <div key={doc.id} className="flex flex-col space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <span className="text-xl flex-shrink-0">{doc.icon}</span>
                    <p className="text-sm font-bold text-slate-700 truncate">{doc.name}</p>
                  </div>
                  {uploadedDocs[doc.id] ? (
                    <span className="px-3 py-1 flex-shrink-0 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {t('profile.locker.verified')}
                    </span>
                  ) : (
                    <label className="px-3 py-1.5 flex-shrink-0 bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-indigo-100 active:scale-95 transition-all outline-none">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*,.pdf" 
                        onChange={() => handleUpload(doc.id)} 
                      />
                      {t('profile.locker.upload')}
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Version info */}
        <div className="bg-slate-50 rounded-3xl border border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">SmartCare AI</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('profile.version')}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        </div>

        {/* Logout */}
        {!confirmLogout ? (
          <button onClick={() => setConfirmLogout(true)}
            className="w-full py-4 rounded-2xl font-bold text-sm text-rose-600 flex items-center justify-center space-x-2 border-2 border-rose-100 active:scale-95 transition-all"
            style={{ background: 'rgba(239,68,68,0.05)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{t('profile.signout')}</span>
          </button>
        ) : (
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 animate-in zoom-in-95 duration-200">
            <p className="text-rose-800 font-bold text-sm mb-1">{t('profile.signout.confirm')}</p>
            <p className="text-rose-600 text-xs mb-4">{t('profile.signout.desc')}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 active:scale-95 transition-all">
                {t('profile.cancel')}
              </button>
              <button onClick={logout}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-rose-600 shadow-lg active:scale-95 transition-all">
                {t('profile.signout')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileScreen;
