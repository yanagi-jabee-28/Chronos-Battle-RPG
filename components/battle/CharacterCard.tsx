'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { STATUS_EFFECTS } from '@/constants/game-data';
import { motion, AnimatePresence } from 'motion/react';
import { useAudio } from '@/hooks/useAudio';
import Image from 'next/image';

interface CharacterCardProps {
  char: any;
  isCurrent: boolean;
  isTargetable: boolean;
  onSelect: (id: string) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ char, isCurrent, isTargetable, onSelect }) => {
  const { playSound } = useAudio();
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isTargetable ? { scale: 1.02 } : {}}
      onClick={() => {
        if (isTargetable) {
          playSound('select');
          onSelect(char.id);
        }
      }}
      className={`group relative p-3 rounded-xl border-2 transition-all duration-500 overflow-hidden
        ${char.isDead || char.debug?.isFrozen ? 'opacity-40 grayscale bg-slate-900/80' : 'bg-slate-800/90 backdrop-blur-sm'} 
        ${isCurrent ? 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.4)] ring-2 ring-yellow-400/20' : (char.isDead ? 'border-slate-800' : 'border-slate-700/50')}
        ${isTargetable ? 'cursor-pointer border-emerald-400 bg-slate-700/50 !opacity-100 !grayscale-0 shadow-[0_0_20px_rgba(52,211,153,0.4)] animate-pulse' : ''}
      `}
    >
      {/* Background Image Placeholder */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {char.imageUrl && (
          <Image 
            src={char.imageUrl} 
            alt={char.name} 
            fill 
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <span className={`font-black text-xs uppercase tracking-tighter ${char.isEnemy ? 'text-red-400' : 'text-blue-400'}`}>
              {char.isEnemy ? 'Enemy' : 'Player'}
            </span>
            <span className="font-bold text-sm text-white drop-shadow-md">{char.name}</span>
          </div>
          <div className="flex gap-1 flex-wrap justify-end max-w-[100px]">
            <AnimatePresence>
              {char.effects.map((eff: any) => {
                const eDef = (STATUS_EFFECTS as any)[eff.id];
                if (!eDef) return null;
                return (
                  <motion.span 
                    key={eff.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-black flex items-center shadow-sm border ${eDef.type === 'good' ? 'bg-blue-600/80 border-blue-400 text-white' : 'bg-red-600/80 border-red-400 text-white'}`}
                  >
                    {eDef.name}
                    {eff.stacks > 1 && <span className="ml-0.5 opacity-70">x{eff.stacks}</span>}
                  </motion.span>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="space-y-2">
          {/* HP Bar */}
          <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5">
              <span>HP</span>
              <span className={char.hp / char.maxHp < 0.3 ? 'text-red-400 animate-pulse' : 'text-slate-200'}>
                {char.hp} / {char.maxHp}
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (char.hp / char.maxHp) * 100)}%` }}
                className={`h-full rounded-full ${char.hp / char.maxHp > 0.3 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
              />
            </div>
          </div>
          
          {/* MP Bar */}
          <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5">
              <span>MP</span>
              <span className="text-slate-200">{char.mp} / {char.maxMp}</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (char.mp / char.maxMp) * 100)}%` }}
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
               <Clock size={10}/> 
               <span>WAIT: {char.isDead || char.debug?.isFrozen ? '--' : char.wait}</span>
            </div>
            {isCurrent && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.8)]"
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
