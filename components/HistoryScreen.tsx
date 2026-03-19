
import React, { useState, useEffect } from 'react';
import { HistoryEntry } from '../types';
import { loadHistory, clearHistory } from '../utils/historyStore';
import { useAuth } from '../contexts/AuthContext';

const TYPE_CONFIG = {
  health: { label: 'Health', color: 'rose', icon: '🏥' },
  farming: { label: 'Farming', color: 'emerald', icon: '🌾' },
  voice: { label: 'Voice', color: 'indigo', icon: '🎙️' },
};

const HistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<'health' | 'farming' | 'voice'>('health');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (user) setEntries(loadHistory(user.id));
  }, [user]);

  const handleClear = () => {
    if (user) {
      clearHistory(user.id);
      setEntries([]);
      setConfirmClear(false);
    }
  };

  const filtered = entries.filter(e => e.type === filter);

  const groupByDate = (list: HistoryEntry[]) => {
    const groups: Record<string, HistoryEntry[]> = {};
    list.forEach(e => {
      const d = new Date(e.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      let label: string;
      if (d.toDateString() === today.toDateString()) label = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(e);
    });
    return groups;
  };

  const grouped = groupByDate(filtered);

  return (
    <div className="pb-28">
      {/* Header */}
      {/* Header with visual split */}
      <div className="bg-slate-900 text-white rounded-b-[40px] pt-8 pb-6 px-6 mb-6 shadow-lg relative overflow-hidden">
         <div className="absolute -right-8 -top-8 w-32 h-32 bg-slate-800 rounded-full blur-2xl opacity-50"></div>
         <div className="relative z-10">
            <h2 className="text-3xl font-extrabold mb-1">History Ledger</h2>
            <p className="text-slate-400 text-sm font-medium">Last 30 days • {entries.length} queries</p>
         </div>
         
         {/* True Tabs */}
         <div className="flex bg-slate-800/50 p-1.5 p-1 rounded-2xl mt-6">
            {(['health', 'farming', 'voice'] as const).map(f => {
              const isActive = filter === f;
              return (
                <button 
                  key={f} 
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                    isActive ? 'text-slate-900 bg-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="relative z-10 flex items-center justify-center space-x-1.5">
                      <span className="text-lg">{TYPE_CONFIG[f].icon}</span>
                      <span>{TYPE_CONFIG[f].label}</span>
                  </span>
                </button>
              );
            })}
         </div>
      </div>

      <div className="flex justify-end px-5 pb-4">
        {filtered.length > 0 && (
          <button onClick={() => setConfirmClear(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-colors flex items-center shadow-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Clear {TYPE_CONFIG[filter as 'health'|'farming'|'voice']?.label} History
          </button>
        )}
      </div>

      {/* Clear confirm */}
      {confirmClear && (
        <div className="mx-5 mb-4 bg-rose-50 border border-rose-100 rounded-2xl p-4 animate-in zoom-in-95 duration-200">
          <p className="text-rose-800 font-bold text-sm mb-1">Clear all history?</p>
          <p className="text-rose-600 text-xs mb-3">This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmClear(false)}
              className="flex-1 py-2 rounded-xl font-bold text-xs text-slate-600 bg-white border border-slate-200">Cancel</button>
            <button onClick={handleClear}
              className="flex-1 py-2 rounded-xl font-bold text-xs text-white bg-rose-500">Clear</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center opacity-60">
          <span className="text-6xl mb-6 filter grayscale">
             {filter === 'health' ? '🏥' : filter === 'farming' ? '🌾' : '🎙️'}
          </span>
          <p className="font-extrabold text-slate-700 text-xl mb-2">No {TYPE_CONFIG[filter].label} History</p>
          <p className="text-slate-500 text-sm max-w-[250px]">
            {filter === 'voice' 
               ? "Conversations with the SmartCare Voice AI will appear here." 
               : `Your past ${TYPE_CONFIG[filter].label.toLowerCase()} diagnoses and tips will be saved here.`}
          </p>
        </div>
      )}

      {/* Entries grouped by date */}
      <div className="px-5 space-y-6">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{date}</p>
            <div className="space-y-2">
              {items.map(entry => {
                const cfg = TYPE_CONFIG[entry.type];
                const isOpen = expanded === entry.id;
                const time = new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={entry.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <button
                      className="w-full text-left px-4 py-3.5 flex items-start space-x-3"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}>
                      <span className="text-xl mt-0.5 flex-shrink-0">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider text-${cfg.color}-600`}>{cfg.label}</span>
                          <span className="text-[10px] text-slate-400">{time}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate">{entry.question}</p>
                        {!isOpen && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{entry.answer}</p>
                        )}
                      </div>
                      <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-0 border-t border-slate-50 animate-in slide-in-from-top-1 duration-200">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3 mb-1">Your Question</p>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{entry.question}</p>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3 mb-1">AI Answer</p>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed">{entry.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryScreen;
