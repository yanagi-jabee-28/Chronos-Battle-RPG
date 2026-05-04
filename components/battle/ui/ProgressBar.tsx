import React from 'react';
import { motion } from 'motion/react';

interface ProgressBarProps {
  label: string;
  current: number;
  max: number;
  colorClass: string;
  subLabelClass?: string;
  heightClass?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  label, current, max, colorClass, subLabelClass = "text-slate-200", heightClass = "h-1.5" 
}) => {
  const percentage = Math.max(0, (current / max) * 100);

  return (
    <div>
      <div className="flex justify-between text-[8px] md:text-[9px] font-bold text-slate-400 mb-0.5 leading-none">
        <span>{label}</span>
        <span className={subLabelClass}>
          {current}/{max}
        </span>
      </div>
      <div className={`w-full bg-slate-950 rounded-full ${heightClass} overflow-hidden border border-slate-800`}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${colorClass}`}
        />
      </div>
    </div>
  );
};
