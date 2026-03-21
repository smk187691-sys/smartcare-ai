
import { HistoryEntry } from '../types';

const STORAGE_KEY = 'smartcare_history';

export const loadHistory = (userId: string): HistoryEntry[] => {
  const data = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
  return data ? JSON.parse(data) : [];
};

export const addHistory = (
  userId: string,
  type: 'health' | 'farming' | 'voice',
  question: string,
  answer: string,
  language: string
) => {
  const history = loadHistory(userId);
  const newEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    userId,
    type,
    question,
    answer,
    language,
    timestamp: new Date().toISOString(),
  };
  
  const updatedHistory = [newEntry, ...history].slice(0, 100); // Keep last 100
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(updatedHistory));
};

export const clearHistory = (userId: string) => {
  localStorage.removeItem(`${STORAGE_KEY}_${userId}`);
};
