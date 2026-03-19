import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { getFallbackDiagnosis } from '../SmartCareCore';
import { useAuth } from '../contexts/AuthContext';
import { addHistory } from '../utils/historyStore';
import { useLanguage } from '../contexts/LanguageContext';
import MicButton from './MicButton';

interface FarmingAssistantProps {
  isOnline: boolean;
}

const FarmingAssistant: React.FC<FarmingAssistantProps> = ({ isOnline }) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attachment, setAttachment] = useState<{name: string, data: string, mimeType: string, isVideo: boolean} | null>(null);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [weather, setWeather] = useState<{temp: number, humidity: number} | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (navigator.geolocation && isOnline) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setLocation({ lat, lon });
          try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`);
            const data = await res.json();
            if (data.current) {
              setWeather({
                temp: data.current.temperature_2m,
                humidity: data.current.relative_humidity_2m
              });
            }
          } catch (e) { console.error('Weather fetch error'); }
        },
        (err) => console.log('Location access denied', err)
      );
    }
  }, [isOnline]);

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const decodeAudio = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment({
          name: file.name,
          data: (reader.result as string).split(',')[1],
          mimeType: file.type,
          isVideo: file.type.startsWith('video/')
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTranscription = (text: string) => {
    setQuery(prev => (prev + ' ' + text).trim());
  };

  const checkCrop = async () => {
    if (!query.trim() && !attachment) return;
    setLoading(true);
    setReported(false);
    
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      const contentParts: any[] = [];
      
      if (attachment) {
        contentParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
      }
      
      contentParts.push({ text: `Act as an expert agronomist. Ensure output is JSON.
        ${attachment ? 'Analyze this plant media for diseases and pests.' : ''}
        ${query ? `User asks: "${query}".` : 'Give general farming advice.'}
        ${weather ? `Current local weather: ${weather.temp}°C, ${weather.humidity}% humidity.` : ''}
        Format response JSON in ${language.name}.` });

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contentParts,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cropName: { type: Type.STRING },
              condition: { type: Type.STRING },
              description: { type: Type.STRING },
              treatment: { type: Type.ARRAY, items: { type: Type.STRING } },
              irrigation: { type: Type.STRING },
              fertilizer: { type: Type.STRING },
              summaryForSpeech: { type: Type.STRING },
              recommendedSpecialist: { type: Type.STRING }
            },
            required: ['cropName', 'condition', 'description', 'treatment', 'irrigation', 'fertilizer', 'summaryForSpeech', 'recommendedSpecialist']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      setAnalysis(result);

      if (user) {
        addHistory(
          user.id,
          'farming',
          query || 'Image uploaded for crop analysis',
          `Diagnosis: ${result.cropName}\nCondition: ${result.condition}\nTreatments: ${result.treatment?.join(', ')}`,
          language.code
        );
      }
    } catch (error: any) {
      console.error('Diagnosis failed:', error);
      const isQuotaError = error?.message?.includes('exceeded') || error?.status === 429;
      const fallback = getFallbackDiagnosis("Unknown Crop", language.code);
      setAnalysis({
        ...fallback,
        cropName: "Fallback Analysis",
        condition: isOnline ? (isQuotaError ? "API QUOTA EXCEEDED" : "API ERROR") : "OFFLINE MODE",
        description: isOnline 
          ? "Service currently unavailable." 
          : "Offline mode. Showing basic info.",
        irrigation: "Standard",
        fertilizer: "Organic compost recommended",
        treatment: ["Maintain healthy watering schedule"],
        summaryForSpeech: "Error analyzing.",
        recommendedSpecialist: "Agricultural Store"
      });
    } finally {
      setLoading(false);
    }
  };

  const speakAdvice = async () => {
    if (!analysis?.summaryForSpeech || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak warmly in ${language.name}: ${analysis.summaryForSpeech}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
         const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
         const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), audioCtx, 24000, 1);
         const source = audioCtx.createBufferSource();
         source.buffer = audioBuffer;
         source.connect(audioCtx.destination);
         source.onended = () => setIsSpeaking(false);
         source.start();
      } else {
         setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS Failed", error);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] bg-slate-50 pb-24 relative">
      
      {/* Header */}
      <div className="bg-emerald-600 px-6 py-8 rounded-b-[40px] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-emerald-500 opacity-50 blur-2xl"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-extrabold text-white flex items-center tracking-tight mb-1">
              {t('farm.title') || 'Crop Assistant'}
            </h2>
            <p className="text-emerald-100 text-sm font-medium">{t('farm.desc') || 'Instantly identify crop issues'}</p>
          </div>
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
            <span className="text-3xl filter drop-shadow-md">👨‍🌾</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 -mt-6 z-10">
        
        {/* Main Input Card (Mimicking HealthAssistant) */}
        {!analysis && (
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 animate-in slide-in-from-bottom-4 duration-500">
            <label className="block text-sm font-extrabold text-slate-700 mb-2">{t('farm.input') || 'Describe crop query or upload a photo'}</label>
            
            <div className="relative group">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-32 p-4 rounded-2xl bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none resize-none shadow-sm transition-all placeholder:text-slate-400 group-hover:border-emerald-300"
                placeholder={t('farm.placeholder') || "E.g., My tomato leaves are turning yellow with brown spots..."}
              />
              <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                <MicButton onTranscription={handleTranscription} languageCode={language.code} isOnline={isOnline} />
                <label className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl cursor-pointer transition-colors shadow-sm active:scale-95">
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </label>
              </div>
            </div>

            {attachment && (
              <div className="mt-4 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 animate-in zoom-in-95">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {attachment.mimeType.includes('image') ? (
                    <img src={`data:${attachment.mimeType};base64,${attachment.data}`} className="w-12 h-12 rounded-lg object-cover shadow-sm border border-slate-200" alt="Preview"/>
                  ) : (
                     <div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm">MEDIA</div>
                  )}
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-700 truncate">{attachment.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{attachment.isVideo ? 'Video' : 'Image'} attached</p>
                  </div>
                </div>
                <button onClick={() => setAttachment(null)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-white rounded-lg shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            <button
              onClick={checkCrop}
              disabled={loading || (!query.trim() && !attachment)}
              className="w-full mt-6 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:shadow-emerald-600/40 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none flex justify-center items-center"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('farm.analyzing') || 'Analyzing...'}</span>
                </div>
              ) : (
                <span>{t('farm.btn.check') || 'Check Crop'}</span>
              )}
            </button>
          </div>
        )}

        {/* Results Area */}
        {analysis && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8 mt-6">
            <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center tracking-tight">
              <span className="bg-emerald-100 text-emerald-600 w-8 h-8 rounded-xl flex items-center justify-center mr-3 text-lg">💡</span>
              {t('farm.analysis') || 'Analysis Result'}
            </h3>
            
            <div className="space-y-6">
              <section className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-bold text-slate-800">{analysis.cropName}</h4>
                    <button 
                      onClick={speakAdvice}
                      disabled={isSpeaking}
                      className={`p-2 rounded-full border shadow-sm transition-all ${isSpeaking ? 'bg-emerald-100 text-emerald-600 border-emerald-200 animate-pulse' : 'bg-white text-slate-500 hover:text-emerald-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </button>
                 </div>
                 
                 <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 ${
                   analysis.condition.toLowerCase().includes('healthy')
                     ? 'bg-emerald-100 text-emerald-700' 
                     : 'bg-rose-100 text-rose-700'
                 }`}>
                   <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                   <span>{analysis.condition}</span>
                 </div>
                 
                 <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-2 border-emerald-300 pl-3">"{analysis.description}"</p>
              </section>

              <section>
                <h4 className="flex items-center text-sm font-bold text-slate-800 mb-3 uppercase tracking-tighter">
                  <span className="w-1 h-4 bg-emerald-500 rounded mr-2"></span>
                  Treatment
                </h4>
                <div className="space-y-2">
                  {analysis.treatment.map((step: string, idx: number) => (
                    <div key={idx} className="flex items-start space-x-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="font-bold text-emerald-600">{idx + 1}.</span>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <section className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 shadow-sm">
                  <h4 className="flex items-center text-xs font-bold text-blue-800 mb-2 uppercase tracking-wide">
                    <span className="mr-1">💧</span> Irrigation
                  </h4>
                  <p className="text-sm font-semibold text-blue-900 leading-snug">{analysis.irrigation}</p>
                </section>
                <section className="bg-amber-50/70 p-4 rounded-2xl border border-amber-100 shadow-sm">
                   <h4 className="flex items-center text-xs font-bold text-amber-800 mb-2 uppercase tracking-wide">
                     <span className="mr-1">🌱</span> Fertilizer
                   </h4>
                   <p className="text-sm font-semibold text-amber-900 leading-snug">{analysis.fertilizer}</p>
                </section>
              </div>
            </div>
            
            {location && analysis.recommendedSpecialist && (
              <div className="mt-8">
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                     <span className="text-lg">🏪</span>
                     <div>
                       <p className="text-[10px] font-bold text-sky-800 uppercase tracking-wider leading-none">Local Store</p>
                       <p className="text-sm font-bold text-sky-900 leading-none mt-1">Recommended Specialist</p>
                     </div>
                  </div>
                </div>
                
                <h4 className="flex items-center text-sm font-bold text-slate-800 mb-3 uppercase tracking-tighter">
                  <span className="w-1 h-4 bg-emerald-500 rounded mr-2"></span>
                  Nearby {analysis.recommendedSpecialist}
                </h4>
                <iframe 
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(analysis.recommendedSpecialist)}+near+${location.lat},${location.lon}&t=&z=13&ie=UTF8&iwloc=&output=embed`} 
                  width="100%" 
                  height="280" 
                  className="rounded-2xl border border-slate-200 shadow-sm" 
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            )}

            <div className="flex gap-2 mt-4 mt-6">
               <button 
                 onClick={() => window.open(`https://www.google.com/search?q=buy+${encodeURIComponent(analysis.fertilizer)}+online`, '_blank')}
                 className="w-full py-4 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center space-x-2"
               >
                 <span>🛒 Order Supplies</span>
               </button>
               
               <button 
                 onClick={async () => {
                   if (!reported) {
                     setReported(true);
                     try {
                       await fetch('http://localhost:5000/api/report', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ type: 'CROP_DISEASE', data: analysis, location })
                       });
                     } catch (e) { console.error('Reporting failed', e); }
                     alert("Report sent anonymously to the Regional Agriculture Department.");
                   }
                 }}
                 className={`w-full py-4 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center space-x-2 border-2 ${
                   reported ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                 }`}
               >
                 <span>{reported ? 'Reported ✓' : '🚨 Report Disease'}</span>
               </button>
            </div>

            <button 
              onClick={() => {setQuery(''); setAnalysis(null); setReported(false);}}
              className="w-full mt-3 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all"
            >
              Check Another Crop
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default FarmingAssistant;
