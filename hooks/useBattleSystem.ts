'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { INITIAL_CHARACTERS, BASE_WAIT_TIME, SKILLS } from '@/constants/game-data';
import { useAudio } from './useAudio';
import { useBattleState } from './battle/useBattleState';
import { useBattleActions } from './battle/useBattleActions';
import { useBattleAI } from './battle/useBattleAI';
import { useBattleLifecycle } from './battle/useBattleLifecycle';
import { generateSimulatedTimeline, calculateWaitTime, calculateEffectiveStats } from '@/lib/battle/engine';
import { SkillDefinition, Character } from '@/types/battle';

export const useBattleSystem = () => {
  // Modular Hooks
  const state = useBattleState();
  const { playSound } = useAudio();
  
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);
  const [targetSelectionMode, setTargetSelectionMode] = useState<string | false>(false);
  const [isAutoBattle, setIsAutoBattle] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  
  const handleStartBattle = useCallback(() => {
    playSound('click');
    setIsStarted(true);
    if (state.battleState === 'INIT') {
      state.setBattleState('INIT'); // Re-trigger init
    }
  }, [state.battleState, playSound]);

  const [aiCoverageMode, setAiCoverageMode] = useState(false);
  const [usedSkills, setUsedSkills] = useState<Record<string, string[]>>({});
  const actions = useBattleActions(
    state.characters, state.setCharacters, 
    state.addLog, state.appendDetailedLog, 
    playSound, state.setEnemyKnowledge
  );
  const ai = useBattleAI(
    state.characters, state.enemyKnowledge, 
    aiCoverageMode, usedSkills, state.addLog
  );
  const lifecycle = useBattleLifecycle(
    state.battleState, state.setBattleState,
    state.characters, state.setCharacters,
    state.currentActorId, state.setCurrentActorId,
    state.addLog, state.appendDetailedLog,
    playSound, isAutoBattle
  );

  // --- Orchestrated Actions ---

  const executeAction = useCallback((actorId: string, skill: SkillDefinition, targetIds: string[], forceFrenzy?: boolean) => {
    console.group(`⚔️ Execute Action: ${skill.name}`);
    console.log('[BattleSystem] Actor:', actorId, 'Targets:', targetIds);
    // Snapshot state for Undo
    state.pushHistory({
      characters: state.characters,
      logs: state.logs,
      detailedLogs: state.detailedLogs,
      currentActorId: state.currentActorId,
      battleState: 'WAITING_INPUT'
    });

    state.setBattleState('EXECUTING');
    
    setTimeout(() => {
      let updatedChars = actions.executeAction(actorId, skill, targetIds);
      
      if (forceFrenzy) {
        updatedChars = updatedChars.map(c => c.id === actorId ? { ...c, frenzyMode: true } : c);
      }
      state.setEnemyKnowledge(prev => ({
        ...prev,
        [actorId]: {
          ...prev[actorId],
          actionHistory: [...(prev[actorId]?.actionHistory || []), skill.id].slice(-10)
        }
      }));

      // End Turn logic
      setTimeout(() => {
        const actorIndex = updatedChars.findIndex(c => c.id === actorId);
        if (updatedChars[actorIndex] && !updatedChars[actorIndex].isDead) {
          const stats = calculateEffectiveStats(updatedChars[actorIndex]);
          let nextWait = calculateWaitTime(stats.spd, BASE_WAIT_TIME, updatedChars[actorIndex]._nextWaitMultiplier);
          delete updatedChars[actorIndex]._nextWaitMultiplier;
          updatedChars[actorIndex].wait = nextWait;
        }
        
        state.setCharacters([...updatedChars]);
        setSelectedSkill(null);
        setTargetSelectionMode(false);
        state.setCurrentActorId(null);
        console.log('[BattleSystem] Turn processing complete. Requesting re-calculation.');
        state.setBattleState('CALCULATING');
        console.groupEnd();
      }, 300);
    }, 150);
  }, [state, actions]);

  const undoTurn = useCallback(() => {
    if (state.history.length === 0) return;
    const lastState = state.history[state.history.length - 1];
    state.setCharacters(lastState.characters);
    state.setLogs(lastState.logs);
    state.setDetailedLogs(lastState.detailedLogs);
    state.setCurrentActorId(lastState.currentActorId);
    state.setBattleState(lastState.battleState);
    state.setHistory(prev => prev.slice(0, -1));
    playSound('cancel');
  }, [state, playSound]);

  const resetBattle = useCallback(() => {
    state.setBattleState('INIT');
    state.setCharacters([]);
    state.setLogs([]);
    state.setDetailedLogs("");
    setSelectedSkill(null);
    setTargetSelectionMode(false);
  }, [state]);

  // --- Effects ---

  // Initialization
  useEffect(() => {
    if (state.battleState === 'INIT') {
      console.log('[BattleSystem] Initializing battle characters...');
      const initChars = INITIAL_CHARACTERS.map(c => ({
        ...c,
        wait: calculateWaitTime(c.spd, BASE_WAIT_TIME) + Math.floor(Math.random() * 10)
      }));
      state.setCharacters(initChars as Character[]);
      state.addLog('戦闘開始！');
      console.log('[BattleSystem] Init complete. State -> CALCULATING');
      state.setBattleState('CALCULATING');
    }
  }, [state.battleState]);

  // Turn Progression (Stable Execution)
  const advanceTurnRef = useRef(lifecycle.advanceTurn);
  useEffect(() => {
    advanceTurnRef.current = lifecycle.advanceTurn;
  }, [lifecycle.advanceTurn]);

  useEffect(() => {
    if (isStarted && state.battleState === 'CALCULATING') {
      advanceTurnRef.current();
    }
  }, [isStarted, state.battleState]);

  // AI Thinking
  useEffect(() => {
    if (state.battleState === 'AI_THINKING') {
      const timer = setTimeout(() => {
        const decision = ai.decideAction(state.currentActorId!);
        if (decision) {
          const skill = (SKILLS as any)[decision.skillId];
          executeAction(state.currentActorId!, skill, decision.targetIds, (decision as any).forceFrenzy);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.battleState, ai, state.currentActorId, executeAction]);

  return useMemo(() => ({
    ...state,
    selectedSkill, setSelectedSkill,
    targetSelectionMode, setTargetSelectionMode,
    isAutoBattle, setIsAutoBattle,
    aiCoverageMode, setAiCoverageMode,
    executeAction,
    undoTurn,
    resetBattle,
    isStarted,
    handleStartBattle,
    generateSimulatedTimeline: () => generateSimulatedTimeline(state.characters, BASE_WAIT_TIME),
    analyzeFutureThreats: (timeline: any[]) => ai.analyzeFutureThreats(timeline, state.characters),
    predictEnemyAction: ai.predictEnemyAction
  }), [
    state, selectedSkill, targetSelectionMode, isAutoBattle, aiCoverageMode, 
    executeAction, undoTurn, resetBattle, isStarted, handleStartBattle, ai.analyzeFutureThreats, ai.predictEnemyAction
  ]);
};
