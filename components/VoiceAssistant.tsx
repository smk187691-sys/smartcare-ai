
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Language } from '../types';
import { getOfflineAdvice } from '../SmartCareCore';
import { addHistory } from '../utils/historyStore';
import { useAuth } from '../contexts/AuthContext';

interface VoiceAssistantProps {
  language: Language;
  onClose: () => void;
  isOnline: boolean;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ language, onClose, isOnline }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error' | 'offline'>('connecting');
  const [transcription, setTranscription] = useState<string>('Initializing SmartCare AI...');
  const [isMutedUI, setIsMutedUI] = useState(false);
  const isMutedRef = useRef(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!isOnline);

  // Accumulate the AI's spoken text for saving to history
  const currentUserQueryRef = useRef<string>('');
  const currentAiAnswerRef = useRef<string>('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const recognitionRef = useRef<any>(null);

  // Fallback: Web Speech API for Offline Transcription
  const startOfflineRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscription("Voice recognition not supported on this device.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language.code;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setStatus('listening');
      setTranscription('Offline: Listening...');
    };

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      setTranscription(text);
      
      if (result.isFinal) {
        handleOfflineResponse(text);
      }
    };

    recognition.onerror = (e: any) => {
        console.error('Speech Recognition Error', e);
        if (isOfflineMode) setStatus('error');
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [language, isOfflineMode]);

  const handleOfflineResponse = (query: string) => {
    setStatus('speaking');
    const advice = getOfflineAdvice(query, language.code);
    setTranscription(advice);
    
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(advice);
    utterance.lang = language.code;
    utterance.onend = () => setStatus('listening');
    synth.speak(utterance);
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

  const decodeBase64 = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const encodePCM = (data: Float32Array) => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const startVoiceSession = useCallback(async () => {
    if (!isOnline) {
      setIsOfflineMode(true);
      startOfflineRecognition();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: `You are SmartCare AI — a dual expert assistant:

**As a PROFESSIONAL MEDICAL DOCTOR (General Physician):**
- Conduct a thorough symptom analysis. Identify the most likely diagnosis by name.
- Provide step-by-step first aid instructions when relevant.
- Recommend specific safe OTC medicines with exact dosages: e.g., "Take Paracetamol 500mg every 6 hours, max 4 doses per day for fever above 38°C", "Use ORS sachets dissolved in 1 litre of clean water for dehydration".
- List clear RED FLAG warning signs that require immediate hospital visit.
- Be empathetic, reassuring, and speak like a real doctor explaining to a patient.

**As a PROFESSIONAL CROP DOCTOR (Agronomist / Plant Pathologist):**
- Identify the plant disease, pest, or deficiency by its exact scientific/common name.
- Explain the cause and visible symptoms clearly.
- Give a prioritized treatment plan: (1) immediate action, (2) organic/biological control, (3) chemical control with specific product names and dilution ratios.
- Include irrigation schedule and fertilizer recommendations specific to the crop stage.
- Speak decisively like an experienced agronomist.

**General rules:**
- Always give a COMPLETE, flowing answer without unnecessary pauses.
- Do NOT add filler phrases like "I understand your concern" repeatedly.
- Speak naturally and continuously in ${language.name} (${language.nativeName}).
- At the end of every response, briefly state: what to do NOW, what to watch for, and when to seek professional help.`,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus('listening');
            setTranscription('Listening...');
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              if (isMutedRef.current) return;  // use ref — no closure staleness, no session restart
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBase64 = encodePCM(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Track user's spoken query
            if (msg.serverContent?.inputTranscription?.text) {
              currentUserQueryRef.current += msg.serverContent.inputTranscription.text;
            }

            if (msg.serverContent?.outputTranscription) {
              const text = msg.serverContent.outputTranscription.text || '';
              if (msg.serverContent.turnComplete) {
                // Save complete turn to history when AI finishes speaking
                if (user && currentUserQueryRef.current.trim() && currentAiAnswerRef.current.trim()) {
                  addHistory(user.id, 'voice', currentUserQueryRef.current.trim(), currentAiAnswerRef.current.trim(), language.code);
                }
                currentUserQueryRef.current = '';
                currentAiAnswerRef.current = '';
                setTranscription('');
              } else {
                currentAiAnswerRef.current += text;
                setTranscription(prev => prev + text);
              }
            }

            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setStatus('speaking');
              const ctx = outAudioContextRef.current!;
              const audioBuffer = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);

              // ✅ 50ms lookahead prevents gaps between audio chunks
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime + 0.05);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;

              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setStatus('listening');
              };
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              currentAiAnswerRef.current = '';
              setStatus('listening');
            }
          },
          onerror: (e) => {
            console.error('Gemini error:', e);
            setIsOfflineMode(true);
            startOfflineRecognition();
          },
          onclose: () => {
            console.log('Gemini session closed');
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Session start error:', err);
      setIsOfflineMode(true);
      startOfflineRecognition();
    }
  }, [language, isOnline, startOfflineRecognition]);  // isMuted removed — use ref instead to prevent session restart

  useEffect(() => {
    startVoiceSession();
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
      if (outAudioContextRef.current) outAudioContextRef.current.close();
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    };
  }, [startVoiceSession]);

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-between p-8 text-white transition-colors duration-700 ${isOfflineMode ? 'bg-slate-800' : 'bg-slate-900'}`}>
      <div className="w-full flex justify-between items-center">
        <button onClick={onClose} className="p-2 bg-slate-700/50 rounded-full text-slate-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center mb-1 ${isOfflineMode ? 'text-amber-400' : 'text-emerald-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse ${isOfflineMode ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
            {isOfflineMode ? 'Offline Intelligence' : 'SmartCare Live AI'}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{language.nativeName} ({language.name})</span>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="flex flex-col items-center flex-1 justify-center space-y-12">
        <div className="relative">
          {status !== 'error' && (
            <>
              <div className={`absolute inset-0 rounded-full scale-150 opacity-20 transition-colors ${isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500'} ${status === 'listening' ? 'pulse-animation' : ''}`}></div>
              <div className={`absolute inset-0 rounded-full scale-125 opacity-30 transition-colors ${isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500'} ${status === 'listening' ? 'pulse-animation' : ''} [animation-delay:0.4s]`}></div>
            </>
          )}
          
          <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 z-10 relative ${
            status === 'speaking' ? 'bg-blue-600 scale-110 shadow-lg shadow-blue-500/20' : 
            status === 'listening' ? (isOfflineMode ? 'bg-amber-600' : 'bg-emerald-600') :
            status === 'error' ? 'bg-rose-600' : 'bg-slate-700'
          }`}>
            {status === 'speaking' ? (
              <div className="flex items-end space-x-1">
                <div className="w-1.5 h-6 bg-white rounded-full animate-[bounce_1s_infinite]"></div>
                <div className="w-1.5 h-10 bg-white rounded-full animate-[bounce_1s_0.2s_infinite]"></div>
                <div className="w-1.5 h-8 bg-white rounded-full animate-[bounce_1s_0.4s_infinite]"></div>
              </div>
            ) : (
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v10a3 3 0 006 0V6a3 3 0 00-3-3z" />
              </svg>
            )}
          </div>
        </div>

        <div className="text-center max-w-xs min-h-[96px] flex flex-col justify-center">
          <p className="text-xl font-bold mb-2">
            {status === 'connecting' ? 'Initializing...' : 
             status === 'listening' ? (isOfflineMode ? 'Speak to local AI' : 'Ask anything...') :
             status === 'speaking' ? 'Assistant is responding' : 'Something went wrong'}
          </p>
          <p className={`text-sm line-clamp-4 italic transition-colors ${isOfflineMode ? 'text-amber-100/70' : 'text-slate-400'}`}>
            {transcription}
          </p>
        </div>
      </div>

      <div className="w-full flex justify-center space-x-8 pb-8">
        <button 
          onClick={() => {
            const next = !isMutedRef.current;
            isMutedRef.current = next;  // update ref immediately (no re-render, no session restart)
            setIsMutedUI(next);          // update UI state for visual feedback only
          }}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg ${
            isMutedUI ? 'bg-rose-600 shadow-rose-900/40' : 'bg-slate-700/50'
          }`}
        >
          {isMutedUI ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v10a3 3 0 006 0V6a3 3 0 00-3-3z" /></svg>
          )}
        </button>
        
        <button 
          onClick={onClose}
          className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center active:bg-slate-700 transition-colors shadow-lg"
        >
          <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VoiceAssistant;
