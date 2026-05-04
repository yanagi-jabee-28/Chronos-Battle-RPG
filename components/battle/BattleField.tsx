'use client';

import React, { useState, useEffect } from 'react';
import { useBattleSystem } from '@/hooks/useBattleSystem';
import { useAudio } from '@/hooks/useAudio';
import { useBattleAssets } from '@/hooks/battle/useBattleAssets';
import { Timeline } from './Timeline';
import { CharacterCard } from './CharacterCard';
import { ActionMenu } from './ActionMenu';
import { LogPanel } from './LogPanel';
import { DebugPanel } from './DebugPanel';
import { APP_LAST_UPDATED, BG_IMAGE, SKILLS } from '@/constants/game-data';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Activity } from 'lucide-react';
import Image from 'next/image';

export const BattleField: React.FC = () => {
  const battle = useBattleSystem();
  const { playSound } = useAudio();
  const assets = useBattleAssets(battle.setCharacters);
  
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);
  const [frenzyFlash, setFrenzyFlash] = useState(false);

  const timeline = battle.generateSimulatedTimeline();
  const currentActor = battle.characters.find(c => c.id === battle.currentActorId);

  // Detect Phase 2 Transition for Visual Effect
  useEffect(() => {
    const boss = battle.characters.find(c => c.id === 'e1');
    if (boss?.frenzyMode && !frenzyFlash) {
      setFrenzyFlash(true);
      setTimeout(() => setFrenzyFlash(false), 1000);
    }
  }, [battle.characters, frenzyFlash]);

  const handleToggleDebug = (charId: string, flag: string) => {
    playSound('click');
    battle.setCharacters(prev => prev.map(c => 
      c.id === charId ? { ...c, debug: { ...c.debug, [flag]: !(c.debug as any)[flag] } } : c
    ));
  };

  const handleCopyLogs = () => {
    playSound('select');
    navigator.clipboard.writeText(battle.detailedLogs).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSelectSkill = (skillId: string) => {
    playSound('select');
    const actor = battle.characters.find(c => c.id === battle.currentActorId);
    if (!actor) return;
    const skill = (SKILLS as any)[skillId];
    battle.setSelectedSkill(skill);

    if (skill.target === 'enemy_all') {
      battle.executeAction(actor.id, skill, battle.characters.filter(c => c.isEnemy && !c.isDead).map(c => c.id));
    } else if (skill.target === 'ally_all') {
      battle.executeAction(actor.id, skill, battle.characters.filter(c => !c.isEnemy && !c.isDead).map(c => c.id));
    } else if (skill.target === 'self' || ['renki', 'prayer'].includes(skill.id)) {
      battle.executeAction(actor.id, skill, [actor.id]);
    } else {
      if (skill.target === 'enemy_single') battle.setTargetSelectionMode('enemy');
      else if (skill.target === 'ally_single') battle.setTargetSelectionMode('ally');
      else if (skill.target === 'ally_dead') battle.setTargetSelectionMode('ally_dead');
    }
  };

  return (
    <div className="relative h-screen max-h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      <BackgroundLayer image={assets.customBg || BG_IMAGE} />

      {battle.isAutoBattle && <AutoBattleIndicator onCancel={() => (playSound('cancel'), battle.setIsAutoBattle(false))} />}

      <AnimatePresence>
        {frenzyFlash && <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0 z-[100] bg-red-600/30 pointer-events-none" />}
      </AnimatePresence>

      <div className="relative z-10 max-w-6xl mx-auto w-full h-full flex flex-col p-2 md:p-4 overflow-hidden">
        <div className="flex-shrink-0 h-[10vh] min-h-[60px] mb-2 flex items-center gap-4">
          <div className="flex-grow"><Timeline timeline={timeline} currentActorId={battle.currentActorId} /></div>
          <AutoBattleToggle isActive={battle.isAutoBattle} onToggle={() => (playSound('click'), battle.setIsAutoBattle(!battle.isAutoBattle))} />
        </div>

        <div className="flex-grow flex flex-col md:flex-row gap-2 md:gap-6 mb-2 items-center justify-center overflow-hidden">
          <CombatantsSide characters={battle.characters.filter(c => !c.isEnemy)} battle={battle} />
          <VsDivider />
          <CombatantsSide characters={battle.characters.filter(c => c.isEnemy)} battle={battle} />
        </div>

        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3 h-[28vh] md:h-[35vh] min-h-[180px] max-h-[280px]">
          <ActionMenu actor={currentActor} battleState={battle.battleState} targetSelectionMode={battle.targetSelectionMode} isAutoBattle={battle.isAutoBattle} onSelectSkill={handleSelectSkill} onCancel={() => (battle.setSelectedSkill(null), battle.setTargetSelectionMode(false))} onToggleAuto={() => battle.setIsAutoBattle(prev => !prev)} onReset={battle.resetBattle} />
          <LogPanel logs={battle.logs} />
        </div>
      </div>

      <DebugToggle showDebug={showDebug} onToggle={() => (playSound('click'), setShowDebug(!showDebug))} />
      <VersionInfo version={APP_LAST_UPDATED} />

      <AnimatePresence>
        {showDebug && (
          <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} className="fixed top-0 right-0 h-full w-80 z-40 p-6 pt-20">
            <DebugPanel characters={battle.characters} onToggleDebug={handleToggleDebug} onCopyLogs={handleCopyLogs} onGenerateAssets={assets.handleGenerateAssets} isGenerating={assets.isGenerating} copied={copied} onUndo={battle.undoTurn} canUndo={battle.history.length > 0} aiCoverageMode={battle.aiCoverageMode} onToggleAiCoverage={() => battle.setAiCoverageMode(!battle.aiCoverageMode)} enemyKnowledge={battle.enemyKnowledge} onImportKnowledge={battle.setEnemyKnowledge} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-components for BattleField ---

const BackgroundLayer = ({ image }: { image: string }) => (
  <div className="absolute inset-0 z-0">
    <Image src={image} alt="Battlefield" fill className="object-cover opacity-40 blur-[2px]" priority referrerPolicy="no-referrer" />
    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950" />
  </div>
);

const AutoBattleIndicator = ({ onCancel }: { onCancel: () => void }) => (
  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 px-4 py-1 rounded-full font-black tracking-widest text-[10px] md:text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse cursor-pointer hover:bg-emerald-500/30 transition-colors" onClick={onCancel}>
    AUTO BATTLE ACTIVE - CLICK TO CANCEL
  </div>
);

const AutoBattleToggle = ({ isActive, onToggle }: { isActive: boolean, onToggle: () => void }) => (
  <button onClick={onToggle} className={`px-4 py-2 h-12 rounded-lg font-black transition-all border-2 flex items-center gap-2 flex-shrink-0 text-sm ${isActive ? 'bg-yellow-500 border-yellow-400 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-60 hover:opacity-100'}`}>
    <Activity size={18} className={isActive ? 'animate-spin' : ''} />
    <span className="hidden sm:inline">AUTO</span> {isActive ? 'ON' : 'OFF'}
  </button>
);

const CombatantsSide = ({ characters, battle }: { characters: any[], battle: any }) => (
  <div className="w-full md:w-1/3 flex flex-col gap-2 md:gap-3 h-full justify-center overflow-y-auto custom-scrollbar py-2">
    {characters.map(char => (
      <div key={char.id} className="flex-shrink-0">
        <CharacterCard 
          char={char} isCurrent={char.id === battle.currentActorId} 
          isTargetable={battle.targetSelectionMode === 'ally' || (battle.targetSelectionMode === 'ally_dead' && char.isDead) || battle.targetSelectionMode === 'enemy'} 
          onSelect={(id) => {
            battle.executeAction(battle.currentActorId!, battle.selectedSkill, [id]);
            battle.setTargetSelectionMode(false);
          }} 
        />
      </div>
    ))}
  </div>
);

const VsDivider = () => (
  <div className="hidden md:flex flex-col items-center justify-center opacity-10 px-2 flex-shrink-0">
    <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-500 to-transparent" />
    <span className="text-2xl font-black italic tracking-tighter text-slate-500 my-2">VS</span>
    <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-500 to-transparent" />
  </div>
);

const DebugToggle = ({ showDebug, onToggle }: { showDebug: boolean, onToggle: () => void }) => (
  <button onClick={onToggle} className="fixed bottom-6 right-6 z-50 p-3 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-full shadow-xl hover:bg-slate-700 transition-all">
    <Settings size={20} className={showDebug ? 'text-yellow-400 rotate-90' : 'text-slate-400'} />
  </button>
);

const VersionInfo = ({ version }: { version: string }) => (
  <div className="fixed bottom-4 left-4 z-30 rounded-full border border-slate-700/50 bg-slate-950/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 backdrop-blur-md shadow-lg">
    Updated {version}
  </div>
);
