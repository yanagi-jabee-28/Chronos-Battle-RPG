'use client';

import React, { useRef, useEffect } from 'react';

interface LogPanelProps {
  logs: string[];
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogStyle = (log: string) => {
    if (log.includes('倒した') || log.includes('倒れた')) return 'text-red-400 font-extrabold tracking-wider';
    if (log.includes('息を吹き返した')) return 'text-cyan-300 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]';
    if (log.includes('ダメージ')) return 'text-red-300';
    if (log.includes('DMG Calc:') && log.includes('Final:0')) return 'text-slate-500 line-through';
    if (log.includes('Final:') && /Final:(\d+)/.test(log) && Number(log.match(/Final:(\d+)/)?.[1]) > 50) return 'text-orange-400 font-black';
    if (log.includes('回復') || log.includes('吸収')) return 'text-emerald-300 font-medium';
    if (log.includes('相殺') || log.includes('レジスト') || log.includes('重なった') || log.includes('重ねられない')) return 'text-violet-300 italic';
    if (log.includes('Cured bad status') || log.includes('解除') || log.includes('祝福')) return 'text-sky-300 font-semibold';
    if (log.includes('引き付けた') || log.includes('挑発')) return 'text-indigo-300 font-semibold';
    if (log.includes('！')) return 'text-slate-100 font-bold';
    return 'text-slate-400';
  };

  return (
    <div className="bg-black/80 backdrop-blur-md rounded-xl p-4 border border-slate-700/50 overflow-hidden flex flex-col font-mono text-[12px] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] h-full">
      <h3 className="text-slate-400 mb-3 border-b border-slate-700/80 pb-2 text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-between">
        <span>Combat Narrative</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      </h3>
      <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-3 pb-4">
        {logs.map((log, index) => (
          <div key={index} className={`leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-300 transition-colors ${getLogStyle(log)}`}>
            <span className="opacity-40 mr-2 text-slate-500 select-none">››</span>
            <span className="drop-shadow-sm">{log}</span>
          </div>
        ))}
        <div ref={logsEndRef} className="h-1" />
      </div>
    </div>
  );
};
