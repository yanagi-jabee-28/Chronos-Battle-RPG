'use client';

import React, { useState } from 'react';
import { useBattleSystem } from '@/hooks/useBattleSystem';
import { useAudio } from '@/hooks/useAudio';
import { Timeline } from './Timeline';
import { CharacterCard } from './CharacterCard';
import { ActionMenu } from './ActionMenu';
import { LogPanel } from './LogPanel';
import { DebugPanel } from './DebugPanel';
import { APP_LAST_UPDATED, BG_IMAGE } from '@/constants/game-data';
import { generateGameAssets } from '@/lib/asset-generator';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Activity } from 'lucide-react';
import Image from 'next/image';

export const BattleField: React.FC = () => {
  const {
    characters,
    setCharacters,
    logs,
    detailedLogs,
    currentActorId,
    selectedSkill,
    setSelectedSkill,
    battleState,
    targetSelectionMode,
    setTargetSelectionMode,
    executeAction,
    generateSimulatedTimeline,
    isAutoBattle,
    setIsAutoBattle,
    resetBattle,
    undoTurn,
    history,
    enemyKnowledge,
    setEnemyKnowledge,
    aiCoverageMode,
    setAiCoverageMode
  } = useBattleSystem();

  const { playSound } = useAudio();
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customBg, setCustomBg] = useState<string | null>(null);

  const timeline = generateSimulatedTimeline();
  const currentActor = characters.find(c => c.id === currentActorId);

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    try {
      const assets = await generateGameAssets();
      if (assets.background) setCustomBg(assets.background);
      
      setCharacters(prev => prev.map(c => {
        let newUrl = c.imageUrl;
        if (c.id === 'p1' && assets.ars) newUrl = assets.ars;
        if (c.id === 'p2' && assets.luna) newUrl = assets.luna;
        if (c.id === 'p3' && assets.cecil) newUrl = assets.cecil;
        if (c.id === 'p4' && assets.shion) newUrl = assets.shion;
        if (c.id === 'e1' && assets.boss) newUrl = assets.boss;
        return { ...c, imageUrl: newUrl };
      }));
    } catch (e) {
      console.error('Failed to generate assets:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleDebug = (charId: string, flag: string) => {
    playSound('click');
    setCharacters(prev => prev.map(c => 
      c.id === charId ? { ...c, debug: { ...c.debug, [flag]: !c.debug[flag] } } : c
    ));
  };

  const handleCopyLogs = () => {
    playSound('select');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(detailedLogs);
    } else {
      // Fallback for environments where clipboard is not available (e.g. non-HTTPS)
      const textArea = document.createElement("textarea");
      textArea.value = detailedLogs;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
      }
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectSkill = (skillId: string) => {
    playSound('select');
    
    const actor = characters.find(c => c.id === currentActorId);
    const skill = (require('@/constants/game-data').SKILLS)[skillId];

    setSelectedSkill(skill);

    if (skill.target === 'enemy_all') {
      executeAction(actor.id, skill, characters.filter(c => c.isEnemy && !c.isDead).map(c => c.id), characters);
    } else if (skill.target === 'ally_all') {
      executeAction(actor.id, skill, characters.filter(c => !c.isEnemy && !c.isDead).map(c => c.id), characters);
    } else if (skill.target === 'self' || ['renki', 'prayer'].includes(skill.id)) {
      executeAction(actor.id, skill, [actor.id], characters);
    } else {
      if (skill.target === 'enemy_single') setTargetSelectionMode('enemy');
      else if (skill.target === 'ally_single') setTargetSelectionMode('ally');
      else if (skill.target === 'ally_dead') setTargetSelectionMode('ally_dead');
    }
  };

  return (
    <div className="relative h-screen max-h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <Image 
          src={customBg || BG_IMAGE} 
          alt="Battlefield" 
          fill 
          sizes="100vw"
          className="object-cover opacity-40 blur-[2px]"
          priority
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950" />
      </div>

      {isAutoBattle && (
        <div 
          className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 px-4 py-1 rounded-full font-black tracking-widest text-[10px] md:text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse cursor-pointer hover:bg-emerald-500/30 transition-colors"
          onClick={() => {
            playSound('cancel');
            setIsAutoBattle(false);
          }}
        >
          AUTO BATTLE ACTIVE - CLICK TO CANCEL
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto w-full h-full flex flex-col p-2 md:p-4 overflow-hidden">
        {/* Top Bar: Timeline */}
        <div className="flex-shrink-0 h-[10vh] min-h-[60px] mb-2 flex items-center gap-4">
          <div className="flex-grow">
            <Timeline timeline={timeline} currentActorId={currentActorId} />
          </div>
          <button
            onClick={() => {
              playSound('click');
              setIsAutoBattle(!isAutoBattle);
            }}
            className={`px-4 py-2 h-12 rounded-lg font-black transition-all border-2 flex items-center gap-2 flex-shrink-0 text-sm
              ${isAutoBattle 
                ? 'bg-yellow-500 border-yellow-400 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
                : 'bg-slate-800 border-slate-700 text-slate-400 opacity-60 hover:opacity-100'}
            `}
          >
            <Activity size={18} className={isAutoBattle ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">AUTO</span> {isAutoBattle ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Main Battle Area */}
        <div className="flex-grow flex flex-col md:flex-row gap-2 md:gap-6 mb-2 items-center justify-center overflow-hidden">
          {/* Players Side */}
          <div className="w-full md:w-1/3 flex flex-col gap-2 md:gap-3 h-full justify-center overflow-y-auto custom-scrollbar py-2">
            {characters.filter(c => !c.isEnemy).map(char => (
              <div key={char.id} className="flex-shrink-0">
                <CharacterCard 
                  char={char}
                  isCurrent={char.id === currentActorId}
                  isTargetable={targetSelectionMode === 'ally' || (targetSelectionMode === 'ally_dead' && char.isDead)}
                  onSelect={(id) => {
                    executeAction(currentActorId!, selectedSkill, [id], characters);
                    setTargetSelectionMode(false);
                  }}
                />
              </div>
            ))}
          </div>

          {/* VS Divider */}
          <div className="hidden md:flex flex-col items-center justify-center opacity-10 px-2 flex-shrink-0">
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-500 to-transparent" />
            <span className="text-2xl font-black italic tracking-tighter text-slate-500 my-2">VS</span>
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-500 to-transparent" />
          </div>

          {/* Enemies Side */}
          <div className="w-full md:w-1/3 flex flex-col gap-2 md:gap-3 h-full justify-center overflow-y-auto custom-scrollbar py-2">
            {characters.filter(c => c.isEnemy).map(char => (
              <div key={char.id} className="flex-shrink-0">
                <CharacterCard 
                  char={char}
                  isCurrent={char.id === currentActorId}
                  isTargetable={targetSelectionMode === 'enemy'}
                  onSelect={(id) => {
                    executeAction(currentActorId!, selectedSkill, [id], characters);
                    setTargetSelectionMode(false);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom UI: Controls & Logs */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3 h-[28vh] md:h-[35vh] min-h-[180px] max-h-[280px]">
          <ActionMenu 
            actor={currentActor}
            battleState={battleState}
            targetSelectionMode={targetSelectionMode}
            isAutoBattle={isAutoBattle}
            onSelectSkill={handleSelectSkill}
            onCancel={() => {
              setSelectedSkill(null);
              setTargetSelectionMode(false);
            }}
            onToggleAuto={() => setIsAutoBattle(prev => !prev)}
            onReset={resetBattle}
          />
          <LogPanel logs={logs} />
        </div>
      </div>

      {/* Floating Debug Toggle */}
      <button 
        onClick={() => {
          playSound('click');
          setShowDebug(!showDebug);
        }}
        className="fixed bottom-6 right-6 z-50 p-3 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-full shadow-xl hover:bg-slate-700 transition-all"
      >
        <Settings size={20} className={showDebug ? 'text-yellow-400 rotate-90' : 'text-slate-400'} />
      </button>

      <div className="fixed bottom-4 left-4 z-30 rounded-full border border-slate-700/50 bg-slate-950/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 backdrop-blur-md shadow-lg">
        Updated {APP_LAST_UPDATED}
      </div>

      {/* Debug Panel Overlay */}
      <AnimatePresence>
        {showDebug && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 h-full w-80 z-40 p-6 pt-20"
          >
            <DebugPanel 
              characters={characters}
              onToggleDebug={handleToggleDebug}
              onCopyLogs={handleCopyLogs}
              onGenerateAssets={handleGenerateAssets}
              isGenerating={isGenerating}
              copied={copied}
              onUndo={undoTurn}
              canUndo={history.length > 0}
              aiCoverageMode={aiCoverageMode}
              onToggleAiCoverage={() => setAiCoverageMode(!aiCoverageMode)}
              enemyKnowledge={enemyKnowledge}
              onImportKnowledge={setEnemyKnowledge}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};
