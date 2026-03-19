import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { GoogleGenAI, Type } from "@google/genai";
import MicButton from './MicButton';

interface Scheme {
  id: string;
  title: string;
  description: string;
  eligibility: string;
  category: 'Farming' | 'Health';
  badge: string;
  link?: string;
}

const SchemesScreen: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  const [filter, setFilter] = useState<'All' | 'Farming' | 'Health'>('All');
  const [profileInput, setProfileInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const { language, t } = useLanguage();

  const handleTranscription = (text: string) => {
    setProfileInput(prev => (prev + ' ' + text).trim());
  };

  const fetchSchemes = async () => {
    if (!profileInput.trim()) return;
    if (!isOnline) {
      alert("Schemes AI advisor requires an internet connection.");
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [{ text: `Based on this user profile/query: "${profileInput}", act as a Gov Schemes Advisor. Return 5 highly relevant active government schemes (mix of Farming and Health, depending on the query). Format as JSON in ${language.name}. Don't invent schemes, use real Indian government ones.` }]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                eligibility: { type: Type.STRING },
                category: { type: Type.STRING, enum: ['Farming', 'Health'] },
                badge: { type: Type.STRING },
                link: { type: Type.STRING, description: "Relevant google search query or actual link." }
              },
              required: ['id', 'title', 'description', 'eligibility', 'category', 'badge', 'link']
            }
          }
        }
      });
      
      const result = JSON.parse(response.text || '[]');
      setSchemes(result);
    } catch (error) {
      console.error('Schemes fetch failed:', error);
      alert('Could not fetch schemes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredSchemes = schemes.filter(
    scheme => filter === 'All' || scheme.category === filter
  );

  return (
    <div className="p-6 pb-28 min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-indigo-800 via-indigo-700 to-blue-600 -mx-6 -mt-6 p-8 rounded-b-3xl shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] relative overflow-hidden mb-8">
        <div className="absolute right-0 top-0 opacity-10">
          <svg className="w-64 h-64 transform translate-x-16 -translate-y-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z"/>
          </svg>
        </div>
        <div className="absolute left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold text-white mb-2">{t('schemes.title') || 'Schemes & Funds'}</h2>
          <p className="text-indigo-100 text-sm font-medium">{t('schemes.desc') || 'Discover benefits tailored exactly to your profile.'}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-lg border border-slate-100 mb-8 relative z-20 -mt-12">
        <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center">
            <span className="text-lg mr-2">🤖</span> AI Scheme Advisor
        </h3>
        <div className="relative mb-4">
            <textarea
                value={profileInput}
                onChange={(e) => setProfileInput(e.target.value)}
                placeholder="Describe yourself (e.g. 'I am a farmer from Bihar with 2 acres of land and 3 cows')"
                className="w-full bg-slate-50 border border-indigo-100 rounded-2xl p-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800 resize-none h-24"
            />
            <div className="absolute right-3 bottom-3">
              <MicButton 
                onTranscription={handleTranscription} 
                languageCode={language.code} 
                isOnline={isOnline} 
              />
            </div>
        </div>
        <button 
           onClick={fetchSchemes}
           disabled={loading || !profileInput.trim()}
           className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 flex justify-center items-center ${loading || !profileInput.trim() ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'}`}
        >
           {loading ? 'Finding Schemes...' : 'Find My Schemes'}
        </button>
      </div>

      {schemes.length > 0 && (
          <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {['All', 'Farming', 'Health'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                  filter === f 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200'
                }`}
              >
                {f === 'All' ? t('schemes.all') || 'All Schemes' : f === 'Farming' ? t('schemes.farming') || 'Farming' : t('schemes.health') || 'Health'}
              </button>
            ))}
          </div>
      )}

      {schemes.length === 0 && !loading && (
          <div className="text-center py-10 px-6 opacity-60">
              <span className="text-6xl filter grayscale">📋</span>
              <p className="mt-4 text-sm font-bold text-slate-600">Tell the AI about yourself to see personalized money making & support schemes.</p>
          </div>
      )}

      <div className="space-y-4">
        {filteredSchemes.map((scheme, idx) => (
          <div key={scheme.id || idx} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-3">
              <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                scheme.category === 'Farming' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {scheme.category}
              </span>
              <span className="text-[10px] text-slate-500 font-bold px-2 py-1 bg-slate-100 rounded">
                ★ {scheme.badge}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-2 leading-tight">{scheme.title}</h3>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">{scheme.description}</p>
            
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-2xl border border-indigo-100/50 mb-5 flex items-start space-x-3">
              <svg className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                 <p className="text-[10px] uppercase font-bold text-indigo-800/60 mb-1">{t('schemes.eligibility') || 'Eligibility'}</p>
                 <p className="text-xs text-indigo-900 font-semibold">{scheme.eligibility}</p>
              </div>
            </div>
            
            <a 
               href={`https://www.google.com/search?q=${encodeURIComponent(scheme.link || scheme.title)}`}
               target="_blank"
               rel="noreferrer"
               className="w-full py-3.5 rounded-xl font-bold text-indigo-600 bg-indigo-50/80 border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center justify-center space-x-2"
            >
              <span>{t('schemes.btn.check') || 'Check Details & Apply'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchemesScreen;
