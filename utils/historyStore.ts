
import { HistoryEntry } from '../types';

const HISTORY_KEY = (userId: string) => `smartcare_history_${userId}`;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Load all history entries for a user, pruning those older than 30 days */
export const loadHistory = (userId: string): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(userId));
    if (!raw) return [];
    const entries: HistoryEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const fresh = entries.filter(e => new Date(e.timestamp).getTime() > cutoff);
    // Persist pruned list back
    if (fresh.length !== entries.length) {
      localStorage.setItem(HISTORY_KEY(userId), JSON.stringify(fresh));
    }
    return fresh.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
};

/** Add a new entry to a user's history */
export const addHistory = (
  userId: string,
  type: HistoryEntry['type'],
  question: string,
  answer: string,
  language: string
): void => {
  try {
    const existing = loadHistory(userId);
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      userId,
      type,
      question: question.trim().slice(0, 500),
      answer: answer.trim().slice(0, 2000),
      language,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(HISTORY_KEY(userId), JSON.stringify([entry, ...existing]));
  } catch {
    console.error('Failed to save history entry');
  }
};

/** Clear all history for a user */
export const clearHistory = (userId: string): void => {
  localStorage.removeItem(HISTORY_KEY(userId));
};
