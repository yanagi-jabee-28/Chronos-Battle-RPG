'use client';

import React from 'react';
import { Sword, Bot } from 'lucide-react';
import { SKILLS } from '@/constants/game-data';
import { motion } from 'motion/react';
import { useAudio } from '@/hooks/useAudio';

interface ActionMenuProps {
  actor: any;
  battleState: string;
  targetSelectionMode: string | false;
  isAutoBattle: boolean;
  onSelectSkill: (skillId: string) => void;
  onCancel: () => void;
  onToggleAuto: () => void;
  onReset: () => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ actor, battleState, targetSelectionMode, isAutoBattle, onSelectSkill, onCancel, onToggleAuto, onReset }) => {
  const { playSound } = useAudio();

  return (
    <div className="bg-slate-800/90 backdrop-blur-md rounded-xl p-4 border border-slate-700/50 flex flex-col relative shadow-2xl h-full overflow-hidden">
      {/* Always show header */}
      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 flex-shrink-0">
        <h3 className="text-yellow-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
          <Sword size={14} /> COMMAND MENU
          {actor && battleState === 'WAITING_INPUT' && (
            <span className="text-[11px] text-white bg-blue-600 px-2 py-0.5 rounded-full ml-2 animate-pulse">
              {actor.name}&apos;S TURN
            </span>
          )}
        </h3>
        <button
          onClick={() => {
            playSound('click');
            onToggleAuto();
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
            isAutoBattle 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30' 
              : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600 hover:text-white'
          }`}
        >
          <Bot size={12} /> {isAutoBattle ? 'Auto: ON' : 'Auto: OFF'}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {battleState === 'END' ? (
          <div className="flex-grow flex flex-col items-center justify-center gap-4">
            <div className="text-xl font-black text-white tracking-tighter italic">
              BATTLE OVER
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playSound('select');
                onReset();
              }}
              className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black rounded-full shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-all uppercase tracking-widest text-xs"
            >
              Replay Battle
            </motion.button>
          </div>
        ) : !actor ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="flex gap-1">
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
            </div>
          </div>
        ) : (
          <>
            {battleState === 'WAITING_INPUT' && !targetSelectionMode && (
              <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar pr-1 h-full">
                {actor.skills.map((skillId: string) => {
                  const skill = (SKILLS as any)[skillId];
                  const canAfford = actor.mp >= skill.cost || actor.debug?.isInfiniteMp;
                  
                  return (
                    <motion.button
                      key={skillId}
                      whileHover={canAfford ? { scale: 1.02, backgroundColor: 'rgba(51, 65, 85, 1)' } : {}}
                      whileTap={canAfford ? { scale: 0.98 } : {}}
                      disabled={!canAfford}
                      onClick={() => {
                        playSound('click');
                        onSelectSkill(skillId);
                      }}
                      className={`text-left px-3 py-2.5 rounded-lg border transition-all duration-200 group relative
                        ${canAfford ? 'bg-slate-700/50 border-slate-600 hover:border-yellow-500/50' : 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed'}
                      `}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-[13px] text-slate-100">{skill.name}</span>
                        {skill.cost > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${canAfford ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-950 text-slate-600'}`}>
                            {skill.cost} MP
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight line-clamp-2">{skill.description}</div>
                    </motion.button>
                  )
                })}
              </div>
            )}

            {targetSelectionMode && (
               <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                 <motion.p 
                   animate={{ opacity: [0.5, 1, 0.5] }}
                   transition={{ repeat: Infinity, duration: 1.5 }}
                   className="text-yellow-300 text-sm font-bold mb-6 tracking-tight"
                 >
                   SELECT TARGET
                 </motion.p>
                 <button 
                   onClick={() => {
                     playSound('cancel');
                     onCancel();
                   }} 
                   className="w-full py-2 bg-slate-700 hover:bg-red-900/40 hover:text-red-300 hover:border-red-800 border border-slate-600 rounded-lg text-xs font-bold transition-all"
                 >
                   CANCEL
                 </button>
               </div>
            )}

            {(battleState === 'THINKING' || battleState === 'AI_THINKING') && (
              <div className="flex-grow flex flex-col items-center justify-center text-slate-500 italic gap-3">
                <div className="flex gap-1">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {actor.isEnemy ? 'Enemy is thinking' : 'Auto Battle Processing'}
                </span>
              </div>
            )}
            
            {(battleState === 'CALCULATING' || battleState === 'PROCESSING_TURN' || battleState === 'EXECUTING') && (
              <div className="flex-grow flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                Processing...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
