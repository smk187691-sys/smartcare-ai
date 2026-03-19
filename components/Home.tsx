
import React, { useState } from 'react';
import { AppTab, SUPPORTED_LANGUAGES, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface HomeProps {
  onNavigate: (tab: AppTab) => void;
  isOnline: boolean;
  user: User;
}

const Home: React.FC<HomeProps> = ({ onNavigate, isOnline, user }) => {
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="p-6 pb-28 min-h-screen bg-slate-50">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <p className="text-indigo-400 text-[10px] font-extrabold uppercase tracking-widest mb-1">{t('home.welcome') || 'Welcome Back'}</p>
          <h1 className="text-3xl font-extrabold text-slate-800 flex items-center tracking-tight">
            {user.name.split(' ')[0]}
            {!isOnline && (
                <span className="ml-3 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md uppercase tracking-wider font-bold shadow-sm">Offline</span>
            )}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">{t('home.tagline') || 'Your intelligent rural assistant'}</p>
        </div>
        <div className="flex flex-col items-end space-y-3">
            <button 
                onClick={() => setIsLangModalOpen(true)}
                className="flex items-center space-x-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-sm active:scale-95 hover:border-indigo-300 transition-all font-bold group"
            >
                <svg className="w-4 h-4 text-indigo-500 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[10px] uppercase tracking-wider">{language.code}</span>
            </button>
            <div className={`text-[10px] font-extrabold flex items-center tracking-wide uppercase px-2 py-1 rounded-md ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-400'}`}></span>
                {isOnline ? (t('home.online') || 'Online') : (t('home.offline') || 'Offline')}
            </div>
        </div>
      </header>

      {/* Language Selection Modal */}
      {isLangModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-[100%] duration-300 max-h-[85vh] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            <div className="flex justify-between items-center mb-6 mt-2">
              <h3 className="text-xl font-extrabold text-slate-800">{t('home.lang.title') || 'Select Language'}</h3>
              <button onClick={() => setIsLangModalOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2 pb-4 scrollbar-hide">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang);
                    setIsLangModalOpen(false);
                  }}
                  className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all shadow-sm ${
                    language.code === lang.code 
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-indigo-100' 
                      : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="font-extrabold text-lg leading-tight mb-1">{lang.nativeName}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{lang.name}</span>
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setIsLangModalOpen(false)}
              className="mt-4 w-full py-4 bg-slate-900 text-white rounded-2xl font-bold tracking-wide active:scale-95 transition-transform shadow-lg shadow-slate-900/20"
            >
              {t('home.lang.confirm') || 'Confirm Language'}
            </button>
          </div>
        </div>
      )}

      {/* Hero Voice Assistant Card */}
      <div className={`${isOnline ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800' : 'bg-gradient-to-br from-slate-600 to-slate-800'} rounded-[32px] p-7 text-white mb-8 shadow-xl relative overflow-hidden transition-colors duration-500 group`}>
        <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px]">
          <div>
            <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-4 backdrop-blur-md">
                <span className="text-xl">🎙️</span>
            </div>
            <h2 className="text-2xl font-extrabold mb-2 leading-tight">{t('home.voice.title') || 'Smart Voice Assistant'}</h2>
            <p className="text-indigo-100 mb-6 text-sm font-medium w-4/5 leading-relaxed">
                {isOnline ? (t('home.voice.desc.online', { lang: language.nativeName }) || `Speak naturally in ${language.nativeName} to ask anything about farming, health, or schemes.`) : (t('home.voice.desc.offline') || 'Voice assistant is limited while offline. Please connect to the internet.')}
            </p>
          </div>
          <button 
            onClick={() => onNavigate(AppTab.VOICE)}
            className="self-start flex items-center space-x-2 bg-white text-indigo-800 px-6 py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all hover:bg-indigo-50"
          >
            <span>{t('home.voice.btn') || 'Start Speaking'}</span>
            <span className="text-lg">→</span>
          </button>
        </div>
        <div className={`absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full opacity-40 blur-3xl transition-transform duration-700 group-hover:scale-110 ${isOnline ? 'bg-fuchsia-500' : 'bg-slate-400'}`}></div>
        <div className="absolute bottom-0 right-0 opacity-10 transform translate-x-4 translate-y-4">
             <svg className="w-40 h-40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div 
          onClick={() => onNavigate(AppTab.FARMING)}
          className="bg-white border border-slate-100 p-5 rounded-[28px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="bg-emerald-50 w-14 h-14 rounded-[20px] flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
            <span className="text-2xl">👨‍🌾</span>
          </div>
          <div>
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight mb-1">{t('home.farming.title') || 'Farming'}</h3>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{isOnline ? (t('home.farming.desc.online') || 'Crop diagnosis & info') : (t('home.farming.desc.offline') || 'Basic crop info')}</p>
          </div>
        </div>
        
        <div 
          onClick={() => onNavigate(AppTab.HEALTH)}
          className="bg-white border border-slate-100 p-5 rounded-[28px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="bg-rose-50 w-14 h-14 rounded-[20px] flex items-center justify-center text-rose-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
            <span className="text-2xl">⚕️</span>
          </div>
          <div>
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight mb-1">{t('home.health.title') || 'Health'}</h3>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('home.health.desc') || 'Symptom analysis & tips'}</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate(AppTab.SCHEMES)}
          className="bg-white border border-slate-100 p-5 rounded-[28px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between col-span-2"
        >
            <div className="flex items-center justify-between">
                <div>
                  <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center text-amber-600 mb-3 group-hover:scale-110 transition-transform shadow-inner">
                    <span className="text-xl">💰</span>
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-lg leading-tight mb-1">Money Making Schemes</h3>
                  <p className="text-xs text-slate-500 font-medium w-4/5 leading-relaxed">Discover Govt funds and financial aid based on your profile using our AI Advisor.</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-full text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-2xl p-5 flex items-center space-x-4 shadow-sm">
        <div className="bg-white p-2.5 rounded-xl text-blue-600 shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="flex-1">
          <h4 className="font-extrabold text-blue-900 text-sm mb-0.5">{t('home.status.title') || 'System Status'}</h4>
          <p className="text-blue-700/80 text-xs font-semibold">
              {isOnline ? (t('home.status.online') || 'All AI features fully connected') : (t('home.status.offline') || 'Running on offline basic knowledge mode')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
