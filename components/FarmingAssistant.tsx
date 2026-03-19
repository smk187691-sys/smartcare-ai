import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CropDiagnosis } from '../types';
import { getFallbackDiagnosis } from '../SmartCareCore';
import { useAuth } from '../contexts/AuthContext';
import { addHistory } from '../utils/historyStore';
import PaymentModal from './PaymentModal';
import { useLanguage } from '../contexts/LanguageContext';
import MicButton from './MicButton';

interface FarmingAssistantProps {
  isOnline: boolean;
}

interface EnhancedDiagnosis extends CropDiagnosis {
  irrigation: string;
  fertilizer: string;
  summaryForSpeech: string;
  recommendedSpecialist?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  attachment?: { name: string, data: string, mimeType: string, isVideo: boolean } | null;
  diagnosis?: EnhancedDiagnosis;
  isSpeaking?: boolean;
}

const FarmingAssistant: React.FC<FarmingAssistantProps> = ({ isOnline }) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [temporaryAttachment, setTemporaryAttachment] = useState<{name: string, data: string, mimeType: string, isVideo: boolean} | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [weather, setWeather] = useState<{temp: number, humidity: number} | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [reported, setReported] = useState<{ [key: string]: boolean }>({});
  const [showMenu, setShowMenu] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setTemporaryAttachment({
          name: 'CameraCapture.jpg',
          data: dataUrl.split(',')[1],
          mimeType: 'image/jpeg',
          isVideo: false
        });
        stopCamera();
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTemporaryAttachment({
          name: file.name,
          data: (reader.result as string).split(',')[1],
          mimeType: file.type,
          isVideo: file.type.startsWith('video/')
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const decodeAudio = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

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

  const handleTranscription = (text: string) => {
    setUserQuestion(prev => (prev + ' ' + text).trim());
  };

  const sendMessage = async () => {
    if (!temporaryAttachment && !userQuestion.trim()) return;

    const currentQuery = userQuestion.trim();
    const currentAttachment = temporaryAttachment;

    const msgId = crypto.randomUUID();
    
    setMessages(prev => [...prev, {
      id: msgId,
      role: 'user',
      text: currentQuery || undefined,
      attachment: currentAttachment
    }]);

    setUserQuestion('');
    setTemporaryAttachment(null);
    setLoading(true);

    if (!isOnline) {
      const fallback = getFallbackDiagnosis("Scanned Crop", language.code);
      setMessages(prev => [...prev, {
         id: crypto.randomUUID(),
         role: 'assistant',
         diagnosis: {
           ...fallback,
           irrigation: "Water manually based on soil dampness.",
           fertilizer: "Apply organic compost if available.",
           summaryForSpeech: "I am offline, but please check soil moisture and leaf health."
         }
      }]);
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      const contentParts: any[] = [];
      
      // Only add image/video if there's an attachment
      if (currentAttachment) {
        contentParts.push({ inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.data } });
      }
      
      contentParts.push({ text: `Act as an expert agronomist. 
        ${currentAttachment ? 'Analyze this plant media for diseases and pests.' : ''}
        ${currentQuery ? `The user asks: "${currentQuery}". Please answer directly.` : 'Give general farming advice.'}
        ${weather ? `Current local weather is ${weather.temp}°C with ${weather.humidity}% humidity.` : ''}
        Provide:
        1. Crop identity and health condition (if image provided, otherwise give general advice).
        2. Specific treatments or recommendations.
        3. Irrigation advice.
        4. Fertilizer recommendations.
        5. A short encouraging summary for audio output (2 sentences max).
        6. A specific google search term for the required specialist (e.g. 'Agronomist store near me').
        Format as JSON in ${language.name}.` });

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: contentParts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cropName: { type: Type.STRING },
              condition: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              description: { type: Type.STRING },
              treatment: { type: Type.ARRAY, items: { type: Type.STRING } },
              irrigation: { type: Type.STRING },
              fertilizer: { type: Type.STRING },
              summaryForSpeech: { type: Type.STRING },
              recommendedSpecialist: { type: Type.STRING }
            },
            required: ['cropName', 'condition', 'confidence', 'description', 'treatment', 'irrigation', 'fertilizer', 'summaryForSpeech', 'recommendedSpecialist']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        diagnosis: result
      }]);

      if (user) {
        addHistory(
          user.id,
          'farming',
          currentQuery || 'Image uploaded for crop analysis',
          `Diagnosis: ${result.cropName}\nCondition: ${result.condition}\nTreatments: ${result.treatment?.join(', ')}`,
          language.code
        );
      }
    } catch (error: any) {
      console.error('Diagnosis failed:', error);
      
      const isQuotaError = error?.message?.includes('exceeded') || error?.status === 429;
      
      const fallback = getFallbackDiagnosis("Unknown Crop", language.code);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        diagnosis: {
          ...fallback,
          condition: isOnline ? (isQuotaError ? "API QUOTA EXCEEDED" : "API SERVICE ERROR") : "MANUAL CHECK REQUIRED (OFFLINE)",
          description: isOnline 
            ? (isQuotaError ? "The AI service quota has been exceeded. Please check your API billing or wait for the limit to reset." : "The AI service is currently experiencing issues. Please try again later.")
            : "In offline mode, I cannot analyze images. However, common issues involve over-watering or nutrient deficiency.",
          irrigation: "N/A",
          fertilizer: "N/A",
          summaryForSpeech: isOnline ? "I'm sorry, my AI service is currently unavailable." : "Error analyzing image. Please try again."
        }
      }]);
    } finally {
      setLoading(false);
    }
  };

  const speakAnalysis = async (msgId: string, text: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? {...m, isSpeaking: true} : m));
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak warmly in ${language.name}: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), audioCtx, 24000, 1);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setMessages(prev => prev.map(m => m.id === msgId ? {...m, isSpeaking: false} : m));
        source.start();
      } else {
        setMessages(prev => prev.map(m => m.id === msgId ? {...m, isSpeaking: false} : m));
      }
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === msgId ? {...m, isSpeaking: false} : m));
    }
  };

  useEffect(() => {
    // Fetch Location and Weather
    if (navigator.geolocation && isOnline) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
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
      });
    }

    return () => stopCamera();
  }, [isOnline]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50">
      
      {/* Header */}
      <div className="bg-emerald-600 px-6 py-4 shadow-md z-20 sticky top-0 flex justify-between items-center rounded-b-3xl">
        <h2 className="text-xl font-bold text-white flex items-center">
          <span className="mr-2 text-2xl">👨‍🌾</span> {t('farm.title') || 'Agronomist AI'}
        </h2>
        {!isOnline && <span className="text-[10px] bg-amber-400 text-amber-900 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Offline</span>}
      </div>

      {/* Chat History Drawer */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {messages.length === 0 && !isCameraOpen ? (
          <div className="flex flex-col items-center justify-center h-full opacity-60 px-6 text-center">
            <span className="text-6xl filter grayscale">🌾</span>
            <p className="mt-4 font-bold text-slate-700">How can I help you farm today?</p>
            <p className="text-xs text-slate-500 mt-2">Take a photo of a sick plant, ask for fertilizer tips, or ask about irrigation.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {msg.role === 'user' ? (
                <div className="bg-emerald-600 text-white rounded-3xl rounded-tr-sm p-4 max-w-[85%] shadow-sm">
                  {msg.attachment && msg.attachment.mimeType.includes('image') && (
                    <img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} alt="Upload" className="w-full rounded-xl mb-3 border border-emerald-500/50" />
                  )}
                  {msg.attachment && !msg.attachment.mimeType.includes('image') && (
                    <div className="bg-emerald-700/50 p-2 rounded-lg text-xs mb-2 truncate">📄 {msg.attachment.name}</div>
                  )}
                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-3xl rounded-tl-sm p-5 max-w-[95%] shadow-md">
                  {msg.diagnosis && (
                    <>
                      <div className="flex items-start justify-between mb-3 border-b border-slate-50 pb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 leading-tight">{msg.diagnosis.cropName}</h3>
                          <div className={`mt-1.5 flex items-center space-x-1.5 px-2 py-0.5 rounded-full inline-flex text-[10px] font-bold uppercase tracking-wider ${
                            msg.diagnosis.condition.toLowerCase().includes('healthy') || msg.diagnosis.condition.toLowerCase().includes('स्वस्थ') 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{msg.diagnosis.condition}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => speakAnalysis(msg.id, msg.diagnosis!.summaryForSpeech)}
                          disabled={msg.isSpeaking}
                          className={`p-2.5 rounded-full transition-all ${msg.isSpeaking ? 'bg-emerald-100 text-emerald-600 animate-pulse' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100'}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                        </button>
                      </div>

                      <p className="text-slate-600 text-xs mb-5 leading-relaxed italic border-l-2 border-slate-200 pl-3">"{msg.diagnosis.description}"</p>

                      <div className="space-y-4">
                        <section>
                          <h4 className="flex items-center text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest"><span className="w-1 h-3 bg-emerald-500 rounded mr-1.5"></span>Treatment</h4>
                          <div className="space-y-1.5">
                            {msg.diagnosis.treatment.map((step, idx) => (
                              <div key={idx} className="flex items-start text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="font-bold text-emerald-600 mr-1.5">{idx + 1}.</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </section>

                        <div className="grid grid-cols-2 gap-2">
                          <section className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                            <h4 className="text-[10px] font-bold text-blue-800/60 mb-1 uppercase tracking-widest">💧 Irrigation</h4>
                            <p className="text-[10px] font-semibold text-blue-900 leading-tight">{msg.diagnosis.irrigation}</p>
                          </section>
                          <section className="bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                            <h4 className="text-[10px] font-bold text-amber-800/60 mb-1 uppercase tracking-widest">🌱 Fertilizer</h4>
                            <p className="text-[10px] font-semibold text-amber-900 leading-tight">{msg.diagnosis.fertilizer}</p>
                          </section>
                        </div>
                        
                        {location && msg.diagnosis.recommendedSpecialist && (
                          <div className="mt-3">
                            <h4 className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest flex items-center justify-between">
                                Local Store/Lab
                                <button className="text-[8px] bg-slate-800 text-white px-1.5 py-0.5 rounded shadow hover:bg-slate-700">MAPS</button>
                            </h4>
                            <iframe 
                              src={`https://maps.google.com/maps?q=${encodeURIComponent(msg.diagnosis.recommendedSpecialist)}+near+${location.lat},${location.lon}&t=&z=12&ie=UTF8&iwloc=&output=embed`} 
                              width="100%" height="120" className="rounded-xl border border-slate-200" allowFullScreen loading="lazy">
                            </iframe>
                          </div>
                        )}
                        
                        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-50">
                            <button className="flex-1 bg-emerald-50 text-emerald-700 py-2 rounded-lg text-[10px] font-bold border border-emerald-100 hover:bg-emerald-100">Share Report</button>
                            <button 
                                onClick={() => {
                                    if(!reported[msg.id]) {
                                        setReported(prev => ({...prev, [msg.id]: true}));
                                        alert("Report sent to Regional Agriculture Department");
                                    }
                                }}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold border ${reported[msg.id] ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {reported[msg.id] ? 'Reported ✓' : 'Report Disease'}
                            </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-3xl rounded-tl-sm p-4 shadow-sm flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        
        {isCameraOpen && (
          <div className="rounded-3xl overflow-hidden bg-black shadow-2xl relative aspect-[3/4] w-full max-w-[280px] mx-auto animate-in zoom-in-95">
             <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
             <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-6 px-4">
                 <button onClick={stopCamera} className="w-12 h-12 rounded-full bg-slate-800/80 text-white flex items-center justify-center backdrop-blur-md">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
                 <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl p-1">
                   <div className="w-full h-full rounded-full border-2 border-slate-900"></div>
                 </button>
                 <div className="w-12"></div>
             </div>
             <canvas ref={canvasRef} className="hidden" />
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input Tray */}
      <div className="bg-white border-t border-slate-100 p-4 pb-24 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] focus-within:shadow-[0_-10px_40px_rgba(16,185,129,0.05)] transition-shadow relative z-20">
        
        {temporaryAttachment && (
            <div className="mb-3 relative inline-block animate-in slide-in-from-bottom-2">
                {temporaryAttachment.mimeType.includes('image') ? (
                    <img src={`data:${temporaryAttachment.mimeType};base64,${temporaryAttachment.data}`} className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-sm" alt="Preview"/>
                ) : (
                    <div className="h-16 px-4 flex items-center bg-slate-100 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-600">
                        📄 {temporaryAttachment.name.slice(0, 10)}...
                    </div>
                )}
                <button onClick={() => setTemporaryAttachment(null)} className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full shadow-lg hover:bg-rose-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        )}

        <div className="flex items-end space-x-2">
          <div className="flex bg-slate-50 border border-slate-200 rounded-2xl flex-1 items-end focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all p-1">
            <div className="relative">
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-3 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                {showMenu && (
                  <div className="absolute bottom-full left-0 mb-2 flex flex-col bg-white border border-slate-100 shadow-xl rounded-2xl overflow-hidden min-w-[140px] animate-in slide-in-from-bottom-2 z-50">
                     <button onClick={() => { setShowMenu(false); startCamera(); }} className="px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center border-b border-slate-50">
                         <span className="text-emerald-500 mr-2">📷</span> Camera
                     </button>
                     <label className="px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center cursor-pointer">
                         <span className="text-blue-500 mr-2">🖼️</span> Upload
                         <input type="file" className="hidden" accept="image/*,video/*,.pdf" onChange={(e) => { setShowMenu(false); handleImageUpload(e); }} />
                     </label>
                  </div>
                )}
            </div>
            
            <textarea
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              placeholder="Type or speak..."
              className="flex-1 max-h-32 bg-transparent p-3 text-sm font-medium text-slate-800 outline-none resize-none"
              rows={1}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                  }
              }}
            />
            
            <div className="p-1">
               <MicButton onTranscription={handleTranscription} languageCode={language.code} isOnline={isOnline} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 shadow-sm active:scale-95 hover:text-emerald-600 transition-all" />
            </div>
          </div>
          
          <button 
            onClick={sendMessage}
            disabled={!temporaryAttachment && !userQuestion.trim()}
            className="p-3.5 rounded-2xl bg-emerald-600 text-white shadow-lg disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-all active:scale-95 flex-shrink-0"
          >
            <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
      
    </div>
  );
};

export default FarmingAssistant;
