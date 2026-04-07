'use client';

import React from 'react';
import { Settings, Zap, Shield, Snowflake, Clipboard, Check, Skull, Undo2, Brain, Download, Upload } from 'lucide-react';

interface DebugPanelProps {
  characters: any[];
  onToggleDebug: (charId: string, flag: string) => void;
  onCopyLogs: () => void;
  onGenerateAssets: () => void;
  isGenerating: boolean;
  copied: boolean;
  onUndo: () => void;
  canUndo: boolean;
  aiCoverageMode: boolean;
  onToggleAiCoverage: () => void;
  enemyKnowledge: any;
  onImportKnowledge: (data: any) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  characters, onToggleDebug, onCopyLogs, onGenerateAssets, isGenerating, copied,
  onUndo, canUndo, aiCoverageMode, onToggleAiCoverage, enemyKnowledge, onImportKnowledge
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 shadow-2xl">
      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Settings size={14} /> GM Debug Tools
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={onGenerateAssets}
            disabled={isGenerating}
            className={`p-1.5 rounded-md text-[10px] flex items-center gap-1 transition-colors border
              ${isGenerating ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-amber-900/40 text-amber-300 border-amber-800 hover:bg-amber-800/60'}
            `}
          >
            {isGenerating ? 'Generating...' : 'Gen Assets'}
          </button>
          <button 
            onClick={onCopyLogs}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-[10px] flex items-center gap-1 transition-colors border border-slate-700"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Clipboard size={12} />}
            {copied ? 'Copied' : 'Copy Logs'}
          </button>
        </div>
      </div>

      {/* AI & Time Travel Section */}
      <div className="mb-4 border-b border-slate-800 pb-3 space-y-2">
        <div className="flex gap-2">
          <button 
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-all border
              ${!canUndo ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-indigo-900/60 text-indigo-300 border-indigo-700 hover:bg-indigo-800'}
            `}
          >
            <Undo2 size={12} /> UNDO TURN
          </button>
          <button 
            onClick={onToggleAiCoverage}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-all border
              ${aiCoverageMode ? 'bg-fuchsia-900/80 text-fuchsia-300 border-fuchsia-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}
            `}
          >
            <Brain size={12} /> AI COVERAGE
          </button>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(enemyKnowledge, null, 2));
              alert('Knowledge exported to clipboard!');
            }}
            className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[9px] flex items-center justify-center gap-1 transition-colors border border-slate-700"
          >
            <Download size={10} /> Export KB
          </button>
          <button 
            onClick={() => {
              const data = prompt('Paste Knowledge JSON:');
              if (data) {
                try {
                  onImportKnowledge(JSON.parse(data));
                  alert('Knowledge imported successfully!');
                } catch (e) {
                  alert('Invalid JSON');
                }
              }
            }}
            className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[9px] flex items-center justify-center gap-1 transition-colors border border-slate-700"
          >
            <Upload size={10} /> Import KB
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
        {characters.map(char => (
          <div key={char.id} className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-300">{char.name}</span>
              <span className="text-[9px] text-slate-500">ID: {char.id}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => onToggleDebug(char.id, 'isInfiniteMp')}
                className={`flex-1 py-1 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all
                  ${char.debug?.isInfiniteMp ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}
                `}
              >
                <Zap size={10} /> INF MP
              </button>
              <button 
                onClick={() => onToggleDebug(char.id, 'isInvincible')}
                className={`flex-1 py-1 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all
                  ${char.debug?.isInvincible ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}
                `}
              >
                <Shield size={10} /> GOD
              </button>
              <button 
                onClick={() => onToggleDebug(char.id, 'isFrozen')}
                className={`flex-1 py-1 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all
                  ${char.debug?.isFrozen ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}
                `}
              >
                <Snowflake size={10} /> FREEZE
              </button>
              <button 
                onClick={() => onToggleDebug(char.id, 'isOneHitKill')}
                className={`flex-1 py-1 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all
                  ${char.debug?.isOneHitKill ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}
                `}
              >
                <Skull size={10} /> KILL
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
