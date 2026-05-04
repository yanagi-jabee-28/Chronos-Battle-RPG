import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { STATUS_EFFECTS } from '@/constants/game-data';
import { ActiveEffect } from '@/types/battle';

interface StatusBadgesProps {
  effects: ActiveEffect[];
}

export const StatusBadges: React.FC<StatusBadgesProps> = ({ effects }) => {
  return (
    <div className="flex gap-0.5 flex-wrap justify-end max-w-[80px] h-4 overflow-hidden">
      <AnimatePresence>
        {effects.slice(0, 3).map((eff) => {
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
              {eDef.name.substring(0, 2)}{eff.stacks > 1 ? `x${eff.stacks}` : ''}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
