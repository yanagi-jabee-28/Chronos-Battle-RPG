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

  return (
    <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 border border-slate-700/50 overflow-hidden flex flex-col font-mono text-xs shadow-inner h-full">
      <h3 className="text-slate-500 mb-2 border-b border-slate-800 pb-1 text-[10px] uppercase tracking-tighter font-bold">Battle Log</h3>
      <div className="flex-grow overflow-y-auto custom-scrollbar space-y-1.5 pr-2">
        {logs.map((log, index) => (
          <div key={index} className={`leading-relaxed animate-in fade-in slide-in-from-left-2 duration-300
            ${log.includes('ダメージ') ? 'text-red-400' : ''}
            ${log.includes('回復') || log.includes('吸収') ? 'text-emerald-400' : ''}
            ${log.includes('倒した') || log.includes('倒れた') ? 'text-amber-500 font-bold' : ''}
            ${log.includes('息を吹き返した') ? 'text-cyan-400 font-bold' : ''}
            ${log.includes('相殺') || log.includes('レジスト') || log.includes('重なった') || log.includes('引き付けた') ? 'text-violet-400' : ''}
            ${!log.includes('ダメージ') && !log.includes('回復') && !log.includes('吸収') && !log.includes('倒') && !log.includes('息を吹き返した') && !log.includes('相殺') && !log.includes('レジスト') && !log.includes('重なった') && !log.includes('引き付けた') ? 'text-slate-300' : ''}
          `}>
            <span className="opacity-30 mr-2">»</span>{log}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
