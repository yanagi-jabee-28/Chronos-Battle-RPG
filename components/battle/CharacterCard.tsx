'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useAudio } from '@/hooks/useAudio';
import Image from 'next/image';
import { ProgressBar } from './ui/ProgressBar';
import { StatusBadges } from './ui/StatusBadges';
import { Character } from '@/types/battle';

interface CharacterCardProps {
  char: Character;
  isCurrent: boolean;
  isTargetable: boolean;
  onSelect: (id: string) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ char, isCurrent, isTargetable, onSelect }) => {
  const { playSound } = useAudio();
  
  const cardClass = `group relative p-2 rounded-lg border transition-all duration-500 overflow-hidden h-[115px] md:h-[125px] flex flex-col
    ${char.isDead || char.debug?.isFrozen ? 'opacity-40 grayscale bg-slate-900/80' : (char.frenzyMode ? 'bg-slate-900/90 border-red-500/50' : 'bg-slate-800/90 backdrop-blur-sm')} 
    ${isCurrent ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)] ring-1 ring-yellow-400/20' : (char.isDead ? 'border-slate-800' : 'border-slate-700/50')}
    ${char.frenzyMode && !char.isDead ? 'shadow-[0_0_20px_rgba(239,68,68,0.4)] border-red-500 ring-1 ring-red-500/30' : ''}
    ${isTargetable ? 'cursor-pointer border-emerald-400 bg-slate-700/50 !opacity-100 !grayscale-0 shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-pulse' : ''}
  `;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      whileHover={isTargetable ? { scale: 1.02 } : {}}
      onClick={() => isTargetable && (playSound('select'), onSelect(char.id))}
      className={cardClass}
      animate={{
        opacity: 1, 
        y: 0,
        ...(char.frenzyMode && !char.isDead ? {
          boxShadow: ["0 0 10px rgba(239,68,68,0.2)", "0 0 25px rgba(239,68,68,0.6)", "0 0 10px rgba(239,68,68,0.2)"],
          scale: [1, 1.01, 1],
        } : {})
      }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Frenzy Aura Overlay */}
      {char.frenzyMode && !char.isDead && (
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-t from-red-950/40 via-transparent to-transparent pointer-events-none z-0"
        />
      )}
      
      {/* Background Image */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        {char.imageUrl && <Image src={char.imageUrl} alt={char.name} fill className="object-cover" referrerPolicy="no-referrer" />}
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-center h-4">
          <span className={`font-black text-[8px] md:text-[9px] uppercase tracking-widest ${char.isEnemy ? 'text-red-400' : 'text-blue-400'}`}>
            {char.isEnemy ? 'Enemy' : 'Player'}
          </span>
          <StatusBadges effects={char.effects} />
        </div>

        <div className="flex justify-between items-center h-6 border-b border-slate-700/30">
          <span className="font-bold text-xs md:text-sm text-white drop-shadow-md truncate flex-1 pr-2">{char.name}</span>
          <div className={`flex items-center gap-1 px-1 py-0.5 rounded border text-[9px] font-black transition-colors flex-shrink-0
            ${char.isDead || char.debug?.isFrozen ? 'bg-slate-900/50 border-slate-800 text-slate-600' : 'bg-slate-950/80 border-slate-700 text-slate-200'}
          `}>
             <Clock size={8} className={char.wait <= 10 && !char.isDead ? 'text-yellow-400 animate-pulse' : ''}/> 
             <span>W: {char.isDead || char.debug?.isFrozen ? '--' : char.wait}</span>
          </div>
        </div>
        
        <div className="space-y-1.5 py-1">
          <ProgressBar 
            label="HP" current={char.hp} max={char.maxHp} 
            colorClass={char.hp / char.maxHp > 0.3 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'}
            subLabelClass={char.hp / char.maxHp < 0.3 ? 'text-red-400 animate-pulse' : 'text-slate-200'}
          />
          <ProgressBar 
            label="MP" current={char.mp} max={char.maxMp} 
            colorClass="bg-gradient-to-r from-blue-600 to-cyan-400"
            heightClass="h-1 md:h-1.5"
          />
        </div>
      </div>
    </motion.div>
  );
};
