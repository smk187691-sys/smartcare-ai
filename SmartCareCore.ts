
import { Language, LocalAdvice } from './types';

// Pre-seeded knowledge base in multiple languages (simulated offline intelligence)
const ADVICE_DB: Record<string, LocalAdvice[]> = {
  'en': [
    { keywords: ['fever', 'hot', 'headache'], category: 'health', response: "For fever or headache, rest and drink plenty of water. You may take Paracetamol (500mg) every 6 hours if needed. If fever exceeds 103°F or lasts 3 days, see a doctor." },
    { keywords: ['diarrhea', 'stomach', 'loose'], category: 'health', response: "Drink Oral Rehydration Salts (ORS) frequently to stay hydrated. Avoid spicy food. Seek help if there is blood or severe pain." },
    { keywords: ['water', 'irrigation', 'plants'], category: 'farming', response: "For best results, water your plants early in the morning or late in the evening to reduce evaporation. Check soil moisture by hand." },
    { keywords: ['wound', 'cut', 'bleed'], category: 'health', response: "Clean the wound with clean water and soap immediately. Apply an antiseptic cream and cover with a clean bandage." },
    { keywords: ['cough', 'cold', 'sore throat'], category: 'health', response: "Drink warm water with honey. You can use common saline nasal drops. If you have trouble breathing, go to the clinic immediately." }
  ],
  'hi': [
    { keywords: ['बुखार', 'सिरदर्द', 'गर्म'], category: 'health', response: "बुखार या सिरदर्द के लिए, आराम करें और खूब पानी पिएं। जरूरत पड़ने पर आप हर 6 घंटे में पैरासิตामोल (500mg) ले सकते हैं। अगर बुखार 3 दिन से ज्यादा रहे तो डॉक्टर को दिखाएं।" },
    { keywords: ['दस्त', 'पेट', 'उल्टी'], category: 'health', response: "हाइड्रेटेड रहने के लिए बार-बार ओआरएस (ORS) पिएं। तीखे खाने से बचें।" }
  ],
  'bho': [
    { keywords: ['बुखार', 'देहि गरम', 'मूर चकर'], category: 'health', response: "अगर देहि गरम बा या मूर चकराता, त आराम करीं अउर खूब पानी पीहीं। जरूरत पड़ला पर हर 6 घंटा पर पैरासिटामोल (500mg) ले सकेनी। अगर बुखार 3 दिन से बेसी रहे त डॉक्टर के दिखाईं।" },
    { keywords: ['पेचास', 'पेट झरल', 'उलटी'], category: 'health', response: "पानी के कमी ना होखे दीं, बार-बार ओआरएस (ORS) पीहीं। तीखा खाना से परहेज करीं।" },
    { keywords: ['खेती', 'पानी', 'पटवन'], category: 'farming', response: "खेती खातिर सबले नीमन समय बिहान सबेरे या संझा के बा, जवना से पानी उड़े ना। माटी के नमी हाथ से चेक करीं।" }
  ]
};

export const getOfflineAdvice = (query: string, langCode: string): string => {
  const db = ADVICE_DB[langCode] || ADVICE_DB['en'];
  const lowerQuery = query.toLowerCase();
  
  const match = db.find(item => 
    item.keywords.some(kw => lowerQuery.includes(kw))
  );

  return match 
    ? match.response 
    : "हम अभी ऑफलाइन बानी। आराम करीं अउर साफ पानी पीहीं। बेसी जानकारी खातिर अपना गाँव के डॉक्टर से मिलीं।";
};

export const getFallbackDiagnosis = (cropName: string, langCode: string): any => {
    const isBho = langCode === 'bho';
    return {
        cropName: cropName || (isBho ? "पेड़-पौधा" : "Unknown Plant"),
        condition: isBho ? "जाँच जरूरी बा (ऑफलाइन)" : "Manual Check Required (Offline)",
        confidence: 0.5,
        description: isBho 
          ? "अभी इंटरनेट नइखे, त फोटो के जाँच नइखे हो पावत। लेकिन ज्यादातर पौधा में पानी के कमी या खाद के जरूरत होला।" 
          : "In offline mode, I cannot analyze images. However, common issues involve over-watering or nutrient deficiency.",
        treatment: isBho ? [
            "माटी के नमी देख लीं",
            "पत्ता के नीचे कीड़ा देख लीं",
            "पौधा के घाम में राखीं",
            "जैविक खाद के प्रयोग करीं"
        ] : [
            "Check soil moisture levels",
            "Examine leaves for small insects",
            "Ensure the plant is receiving adequate sunlight",
            "Try local organic fertilizers"
        ]
    };
};
