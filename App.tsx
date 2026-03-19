
import React, { useState, useEffect } from 'react';
import { AppTab, Language, SUPPORTED_LANGUAGES } from './types';
import Home from './components/Home';
import FarmingAssistant from './components/FarmingAssistant';
import HealthAssistant from './components/HealthAssistant';
import VoiceAssistant from './components/VoiceAssistant';
import Navigation from './components/Navigation';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.HOME);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('smartcare_lang');
    return saved ? JSON.parse(saved) : SUPPORTED_LANGUAGES[0];
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('smartcare_lang', JSON.stringify(selectedLanguage));
  }, [selectedLanguage]);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.HOME:
        return (
          <Home 
            onNavigate={setActiveTab} 
            selectedLanguage={selectedLanguage} 
            onLanguageChange={setSelectedLanguage} 
            isOnline={isOnline}
          />
        );
      case AppTab.FARMING:
        return <FarmingAssistant language={selectedLanguage} isOnline={isOnline} />;
      case AppTab.HEALTH:
        return <HealthAssistant language={selectedLanguage} isOnline={isOnline} />;
      case AppTab.VOICE:
        return (
          <VoiceAssistant 
            language={selectedLanguage}
            isOnline={isOnline}
            onClose={() => setActiveTab(AppTab.HOME)} 
          />
        );
      default:
        return (
          <Home 
            onNavigate={setActiveTab} 
            selectedLanguage={selectedLanguage} 
            onLanguageChange={setSelectedLanguage} 
            isOnline={isOnline}
          />
        );
    }
  };

  return (
    <div className={`flex flex-col h-screen max-w-md mx-auto bg-white shadow-xl relative overflow-hidden transition-colors duration-500 ${!isOnline ? 'grayscale-[0.2]' : ''}`}>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-slate-800 text-white text-[10px] py-1 text-center font-bold tracking-widest uppercase z-[70]">
          Offline Mode • Local Knowledge Only
        </div>
      )}

      {/* Main Screen Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </main>

      {/* Floating Voice Button */}
      {activeTab !== AppTab.VOICE && (
        <button
          onClick={() => setActiveTab(AppTab.VOICE)}
          className={`fixed bottom-24 right-6 w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white z-40 transition-all active:scale-95 border-4 border-white ${
            isOnline ? 'bg-emerald-600' : 'bg-slate-600'
          }`}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v10a3 3 0 006 0V6a3 3 0 00-3-3z" />
          </svg>
        </button>
      )}

      {/* Navigation Bar */}
      {activeTab !== AppTab.VOICE && (
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
};

export default App;
