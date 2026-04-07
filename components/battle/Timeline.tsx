'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface TimelineProps {
  timeline: any[];
  currentActorId: string | null;
}

export const Timeline: React.FC<TimelineProps> = ({ timeline, currentActorId }) => {
  return (
    <div className="bg-slate-800/80 backdrop-blur-sm p-3 rounded-t-xl border-b border-slate-700/50 mb-4 shadow-lg flex flex-col">
      <h2 className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2 font-bold">
        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        CTB Timeline
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {timeline.slice(0, 15).map((t, idx) => (
          <div key={`${t.id}-${idx}`} className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-300
            ${idx === 0 && t.id === currentActorId ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300 scale-105 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 
              t.isEnemy ? 'bg-red-900/40 border-red-800/50 text-red-300' : 'bg-blue-900/40 border-blue-800/50 text-blue-300'}
          `}>
            <span className="truncate max-w-[80px]">{t.name}</span>
            {idx < timeline.length - 1 && <ChevronRight size={10} className="opacity-30 ml-1" />}
          </div>
        ))}
      </div>
    </div>
  );
};
