import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface MicButtonProps {
  onTranscription: (text: string) => void;
  languageCode: string; // e.g., 'en-IN', 'hi-IN'
  isOnline: boolean;
  className?: string; // For customized styling
}

const MicButton: React.FC<MicButtonProps> = ({ onTranscription, languageCode, isOnline, className }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone not supported on this device or browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size > 0) {
          await processAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access the microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      // First try Web Speech API for fast, reliable results in all modes
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI && !isOnline) {
        // Offline: only use Web Speech API
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = languageCode;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) onTranscription(transcript);
        };
        recognition.onerror = () => {
          console.error('Offline speech recognition failed.');
        };
        recognition.onend = () => setIsProcessing(false);
        recognition.start();
        return;
      }

      // If online, proceed with Gemini

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64AudioUrl = reader.result as string;
          const base64Data = base64AudioUrl.split(',')[1];
          
          if (!base64Data) {
            alert('Failed to read audio data.');
            setIsProcessing(false);
            return;
          }
          
          const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  { 
                    inlineData: {
                      mimeType: 'audio/webm',
                      data: base64Data
                    }
                  },
                  {
                    text: `Transcribe exactly what is spoken in this audio clip. The speaker's language is ${languageCode}. Output ONLY the transcribed words, nothing else. No punctuation explanations, no notes.`
                  }
                ]
              }
            ]
          });

          const text = response.text?.trim() || '';
          if (text) {
            onTranscription(text);
          } else {
            // Fallback: try Web Speech API
            if (SpeechRecognitionAPI) {
              const recognition = new SpeechRecognitionAPI();
              recognition.lang = languageCode;
              recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) onTranscription(transcript);
              };
              recognition.start();
            } else {
              alert('Could not understand the audio. Please speak clearly and try again.');
            }
          }
        } catch (err) {
          console.error('Gemini Transcription Error:', err);
          // Fallback to Web Speech API on Gemini failure
          const SpeechRecognitionFallback = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognitionFallback) {
            try {
              const recognition = new SpeechRecognitionFallback();
              recognition.lang = languageCode;
              recognition.onresult = (event: any) => { 
                onTranscription(event.results[0][0].transcript); 
              };
              recognition.start();
            } catch (e) { 
              alert('Speech recognition failed. Please check your microphone.');
            }
          } else {
            alert('Transcription failed. Please try again.');
          }
        } finally {
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        alert('Failed to read audio file.');
        setIsProcessing(false);
      };
    } catch (err) {
      console.error('processAudio outer error:', err);
      setIsProcessing(false);
    }
  };

  const toggleRecording = () => {
    if (isProcessing) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const defaultClasses = `p-2 rounded-full transition-all flex items-center justify-center shadow-md active:scale-95 ${
    isRecording ? 'bg-rose-500 text-white animate-pulse' : 
    isProcessing ? 'bg-amber-400 text-white animate-spin' :
    'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-500'
  }`;

  return (
    <button 
      onClick={(e) => { e.preventDefault(); toggleRecording(); }}
      disabled={isProcessing}
      className={className || defaultClasses}
      title={isRecording ? "Stop recording" : "Start recording"}
    >
      {isProcessing ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : isRecording ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="7" y="7" width="10" height="10" rx="2" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
    </button>
  );
};

export default MicButton;
