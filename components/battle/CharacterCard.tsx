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
      className={`group relative p-2 rounded-lg border transition-all duration-500 overflow-hidden h-[115px] md:h-[125px] flex flex-col
        ${char.isDead || char.debug?.isFrozen ? 'opacity-40 grayscale bg-slate-900/80' : 'bg-slate-800/90 backdrop-blur-sm'} 
        ${isCurrent ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)] ring-1 ring-yellow-400/20' : (char.isDead ? 'border-slate-800' : 'border-slate-700/50')}
        ${isTargetable ? 'cursor-pointer border-emerald-400 bg-slate-700/50 !opacity-100 !grayscale-0 shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-pulse' : ''}
      `}
    >
      {/* Background Image Placeholder */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
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

      <div className="relative z-10 flex flex-col h-full justify-between">
        {/* Top Row: Label & Buffs */}
        <div className="flex justify-between items-center h-4">
          <span className={`font-black text-[8px] md:text-[9px] uppercase tracking-widest ${char.isEnemy ? 'text-red-400' : 'text-blue-400'}`}>
            {char.isEnemy ? 'Enemy' : 'Player'}
          </span>
          <div className="flex gap-0.5 flex-wrap justify-end max-w-[80px] h-4 overflow-hidden">
            <AnimatePresence>
              {char.effects.slice(0, 3).map((eff: any) => {
                const eDef = (STATUS_EFFECTS as any)[eff.id];
                if (!eDef) return null;
                return (
                  <motion.span 
                    key={eff.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={`text-[7px] px-1 py-0 rounded font-black flex items-center shadow-sm border h-3.5 ${eDef.type === 'good' ? 'bg-blue-600/80 border-blue-400 text-white' : 'bg-red-600/80 border-red-400 text-white'}`}
                  >
                    {eDef.name.substring(0, 2)}
                  </motion.span>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Middle Row: Name & Wait */}
        <div className="flex justify-between items-center h-6 border-b border-slate-700/30">
          <span className="font-bold text-xs md:text-sm text-white drop-shadow-md truncate flex-1 pr-2">
            {char.name}
          </span>
          <div className={`flex items-center gap-1 px-1 py-0.5 rounded border text-[9px] font-black transition-colors flex-shrink-0
            ${char.isDead || char.debug?.isFrozen ? 'bg-slate-900/50 border-slate-800 text-slate-600' : 'bg-slate-950/80 border-slate-700 text-slate-200'}
          `}>
             <Clock size={8} className={char.wait <= 10 && !char.isDead ? 'text-yellow-400 animate-pulse' : ''}/> 
             <span>W: {char.isDead || char.debug?.isFrozen ? '--' : char.wait}</span>
          </div>
        </div>
        
        {/* Bottom Section: HP & MP Bars */}
        <div className="space-y-1.5 py-1">
          {/* HP Bar */}
          <div>
            <div className="flex justify-between text-[8px] md:text-[9px] font-bold text-slate-400 mb-0.5 leading-none">
              <span>HP</span>
              <span className={char.hp / char.maxHp < 0.3 ? 'text-red-400 animate-pulse' : 'text-slate-200'}>
                {char.hp}/{char.maxHp}
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 md:h-2 overflow-hidden border border-slate-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (char.hp / char.maxHp) * 100)}%` }}
                className={`h-full rounded-full ${char.hp / char.maxHp > 0.3 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
              />
            </div>
          </div>
          
          {/* MP Bar */}
          <div>
            <div className="flex justify-between text-[8px] md:text-[9px] font-bold text-slate-400 mb-0.5 leading-none">
              <span>MP</span>
              <span className="text-slate-200">{char.mp}/{char.maxMp}</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1 md:h-1.5 overflow-hidden border border-slate-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (char.mp / char.maxMp) * 100)}%` }}
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Turn Indicator Dot */}
        {isCurrent && (
          <motion.div 
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.8)]"
          />
        )}
      </div>
    </motion.div>
  );
};
