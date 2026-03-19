
import React, { useState } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { useAuth } from '../contexts/AuthContext';
import { addHistory } from '../utils/historyStore';
import PaymentModal from './PaymentModal';
import { useLanguage } from '../contexts/LanguageContext';
import MicButton from './MicButton';

interface HealthAssistantProps {
  isOnline: boolean;
}

const HealthAssistant: React.FC<HealthAssistantProps> = ({ isOnline }) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachment, setAttachment] = useState<{name: string, data: string, mimeType: string, isVideo: boolean} | null>(null);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [reported, setReported] = useState(false);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => console.log('Location access denied', err)
      );
    }
  }, []);

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
    setSymptoms(prev => (prev + ' ' + text).trim());
  };

  const checkSymptoms = async () => {
    if (!symptoms.trim() && !attachment) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            attachment ? { inlineData: { mimeType: attachment.mimeType, data: attachment.data } } : { text: '' },
            { text: `Patient describes symptoms: "${symptoms}". Analyze this text and any attached image/video/document, and provide: 
          1. Possible cause 
          2. Safe home remedies 
          3. Safe Over-The-Counter medicines (e.g. Paracetamol, ORS) 
          4. Safety Warning.
          5. A dynamic Google Maps search term for the specific specialist needed (e.g., "Dermatologist clinic", "Cardiologist", "Pediatrician", "General Hospital").
          Format response as JSON in ${language.name}.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              condition: { type: Type.STRING },
              remedies: { type: Type.ARRAY, items: { type: Type.STRING } },
              medicines: { type: Type.ARRAY, items: { type: Type.STRING } },
              warning: { type: Type.STRING },
              recommendedClinic: { type: Type.STRING, description: "A highly specific search phrase for Google Maps (e.g. 'Eye clinic', 'Dentist', 'Neurologist near me')." },
              summaryForSpeech: { type: Type.STRING, description: "A concise summary of the advice to be spoken." }
            },
            required: ['condition', 'remedies', 'medicines', 'warning', 'recommendedClinic', 'summaryForSpeech']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      setAnalysis(result);

      if (user) {
        addHistory(
          user.id, 
          'health', 
          symptoms, 
          `Diagnosis: ${result.condition}\nRemedies: ${result.remedies?.join(', ')}\nMedicines: ${result.medicines?.join(', ')}\nWarning: ${result.warning}`, 
          language.code
        );
      }
    } catch (error) {
      console.error('Health analysis failed:', error);
      alert('Could not complete analysis. Please try again.');
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
        contents: [{ parts: [{ text: `Say calmly and clearly: ${analysis.summaryForSpeech}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
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
      console.error('TTS failed:', error);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">{t('health.title')}</h2>
      
      {!analysis ? (
        <div className="bg-rose-50 rounded-3xl p-6 mb-8 border border-rose-100 shadow-sm">
          <h3 className="font-bold text-rose-800 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            {t('health.checker.title')}
          </h3>
          <p className="text-sm text-rose-700/80 mb-4">{t('health.checker.desc')}</p>
          
          <div className="mb-4">
            <div className="relative mb-3">
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full h-24 bg-white/50 border border-rose-200 rounded-2xl p-4 pr-12 text-slate-800 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
                placeholder={t('health.input.placeholder')}
              />
              <div className="absolute right-3 bottom-4">
                <MicButton 
                  onTranscription={handleTranscription} 
                  languageCode={language.code} 
                  isOnline={isOnline} 
                  className="p-2 rounded-full transition-all shadow-md bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <label className="flex items-center justify-center px-4 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl cursor-pointer hover:bg-rose-50 transition-colors font-bold text-xs shadow-sm active:scale-95">
                <input type="file" className="hidden" accept="image/*,video/*,.pdf" onChange={handleFileUpload} />
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                {t('health.btn.attach')}
              </label>
              
              {attachment && (
                <div className="flex-1 flex items-center justify-between bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-xl">{attachment.isVideo ? '🎥' : attachment.mimeType.includes('pdf') ? '📄' : '📷'}</span>
                    <span className="text-xs font-semibold text-rose-800 truncate">{attachment.name}</span>
                  </div>
                  <button onClick={() => setAttachment(null)} className="p-1 text-rose-400 hover:text-rose-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={checkSymptoms}
            disabled={loading || (!symptoms.trim() && !attachment)}
            className={`w-full mt-2 py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center ${
              loading || (!symptoms.trim() && !attachment) ? 'bg-slate-300' : 'bg-rose-600'
            }`}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : t('health.btn.analyze')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md mb-8 animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-bold text-slate-800 pr-8">{analysis.condition}</h3>
            <button 
              onClick={speakAdvice}
              disabled={isSpeaking}
              className={`p-3 rounded-full transition-all ${isSpeaking ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-500 active:bg-slate-200'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            </button>
          </div>

          <div className="mb-6 p-4 bg-rose-50 text-rose-800 rounded-2xl flex items-start space-x-3 border border-rose-100">
            <svg className="w-6 h-6 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <p className="text-sm font-bold leading-snug">{analysis.warning}</p>
          </div>

          <div className="space-y-6">
            <section>
              <h4 className="flex items-center text-sm font-bold text-slate-800 mb-3 uppercase tracking-tighter">
                <span className="w-1 h-4 bg-rose-500 rounded mr-2"></span>
                {t('health.remedies')}
              </h4>
              <div className="space-y-2">
                {analysis.remedies.map((remedy: string, idx: number) => (
                  <div key={idx} className="flex items-start space-x-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold text-rose-600">✓</span>
                    <p>{remedy}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="flex items-center text-sm font-bold text-slate-800 mb-3 uppercase tracking-tighter">
                <span className="w-1 h-4 bg-blue-500 rounded mr-2"></span>
                {t('health.medicines')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.medicines.map((med: string, idx: number) => (
                  <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-blue-100">
                    {med}
                  </span>
                ))}
              </div>
            </section>
          </div>
          
          {location && (
            <div className="mt-8">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                   <span className="text-lg">🏥</span>
                   <div>
                     <p className="text-[10px] font-bold text-sky-800 uppercase tracking-wider leading-none">{t('health.hospital')}</p>
                     <p className="text-sm font-bold text-sky-900 leading-none mt-1">City Care Hospital</p>
                   </div>
                </div>
                <button className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm active:scale-95">
                  {t('health.btn.call')}
                </button>
              </div>
              
              <h4 className="flex items-center text-sm font-bold text-slate-800 mb-3 uppercase tracking-tighter">
                <span className="w-1 h-4 bg-emerald-500 rounded mr-2"></span>
                {t('health.nearby', { type: analysis.recommendedClinic || 'Clinics' })}
              </h4>
              <iframe 
                src={`https://maps.google.com/maps?q=${encodeURIComponent(analysis.recommendedClinic || 'hospitals clinics')}+near+${location.lat},${location.lon}&t=&z=13&ie=UTF8&iwloc=&output=embed`} 
                width="100%" 
                height="280" 
                className="rounded-2xl border border-slate-200 shadow-sm" 
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          )}

          {hasPaid ? (
            <a 
              href="https://wa.me/1234567890" 
              target="_blank" 
              rel="noreferrer"
              className="w-full mt-6 py-4 rounded-xl bg-green-600 text-white font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>{t('health.btn.whatsapp')}</span>
            </a>
          ) : (
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="w-full mt-6 py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2 border-2 border-blue-500"
            >
              <span>{t('health.btn.doctor')}</span>
            </button>
          )}

          <button 
            onClick={() => {
              if (!reported) {
                setReported(true);
                alert("Epidermic Alert logged. Health condition data reported anonymously to the Municipal Health Department.");
              }
            }}
            className={`w-full mt-3 py-4 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center space-x-2 border-2 ${
              reported ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <span>{reported ? t('health.btn.reported') : t('health.btn.report')}</span>
          </button>

          <button 
            onClick={() => {setSymptoms(''); setAnalysis(null); setHasPaid(false); setReported(false);}}
            className="w-full mt-3 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all"
          >
            {t('health.btn.clear')}
          </button>
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal 
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            setHasPaid(true);
          }}
          amount={299}
          title={t('health.modal.title')}
          description={t('health.modal.desc')}
        />
      )}

      <div className="mb-8 bg-gradient-to-br from-rose-50 to-orange-50 rounded-3xl p-6 shadow-sm border border-rose-100/50">
        <h3 className="text-lg font-bold text-rose-900 mb-5 flex items-center px-1">
          <span className="text-2xl mr-2">🌟</span> {t('health.tips.title') || 'Daily Wellness Tips'}
        </h3>
        <div className="space-y-3">
          {[
            t('health.tips.1') || "Drink at least 3 liters of water to keep your kidneys healthy.",
            t('health.tips.2') || "Eat seasonal fruits to naturally boost your immunity.",
            t('health.tips.3') || "A 30-minute daily walk can drastically reduce heart disease risk.",
            "Practice deep breathing exercises to reduce stress levels.",
            "Ensure 7-8 hours of sleep for optimum cellular repair."
          ].map((tip, idx) => (
            <div key={idx} className="bg-white/80 border border-white p-4 rounded-2xl flex items-start space-x-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-2 h-2 rounded-full bg-rose-400 mt-2 flex-shrink-0 shadow-[0_0_8px_rgba(251,113,133,0.8)]"></div>
              <p className="text-sm font-semibold text-rose-900 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden">
        <h3 className="font-bold mb-2">{t('health.emergency.title')}</h3>
        <p className="text-slate-400 text-xs mb-4">{t('health.emergency.desc')}</p>
        <button className="bg-rose-600 w-full py-3 rounded-xl font-bold shadow-lg shadow-rose-900/40 active:scale-[0.98] transition-transform">
          {t('health.emergency.btn')}
        </button>
      </div>
    </div>
  );
};

export default HealthAssistant;
