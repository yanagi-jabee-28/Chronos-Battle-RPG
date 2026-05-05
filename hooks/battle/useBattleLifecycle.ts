import { useCallback, useEffect, useMemo } from 'react';
import { Character, BattleState } from '@/types/battle';
import { STATUS_EFFECTS, BASE_WAIT_TIME } from '@/constants/game-data';

export const useBattleLifecycle = (
  battleState: BattleState,
  setBattleState: (s: BattleState) => void,
  characters: Character[],
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>,
  currentActorId: string | null,
  setCurrentActorId: (id: string | null) => void,
  addLog: (msg: string) => void,
  appendDetailedLog: (msg: string) => void,
  playSound: (type: any) => void,
  isAutoBattle: boolean
) => {

  const handleTurnStartEffects = useCallback((actorId: string, currentChars: Character[]) => {
    console.group(`🔔 Turn Start: ${actorId}`);
    let charsCopy = [...currentChars];
    let actorIndex = charsCopy.findIndex(c => c.id === actorId);
    let actor = { ...charsCopy[actorIndex] };
    let skipTurn = false;
    let logMessages: string[] = [];
    
    appendDetailedLog(`\n--- Turn: ${actor.name} ---`);
    console.log('[Lifecycle] Processing start-of-turn effects for:', actor.name);

    // MP Regen
    if (actor.mp < actor.maxMp) {
      const mpRegen = Math.max(1, Math.floor(actor.maxMp * 0.05));
      actor.mp = Math.min(actor.maxMp, actor.mp + mpRegen);
    }

    // Process Status Effects
    actor.effects = actor.effects.map((eff) => ({ ...eff, duration: eff.duration - 1 })).filter((eff) => {
      if (eff.id === 'POISON') {
        if (!actor.debug?.isInvincible) {
          const dmg = Math.floor(actor.maxHp * 0.05 * eff.stacks); 
          actor.hp = Math.max(0, actor.hp - dmg);
          logMessages.push(`${actor.name} は毒で ${dmg} のダメージを受けた！`);
          playSound('debuff');
          if (actor.hp === 0) actor.isDead = true;
        }
      } else if (eff.id === 'STUN') {
        skipTurn = true;
        logMessages.push(`${actor.name} はスタンしていて動けない！`);
      }
      
      if (eff.duration <= 0) {
        logMessages.push(`${actor.name} の ${(STATUS_EFFECTS as any)[eff.id]?.name} が切れた。`);
        return false;
      }
      return true;
    });

    charsCopy[actorIndex] = actor;
    setCharacters(charsCopy);
    logMessages.forEach(msg => addLog(msg));

    if (actor.isDead) {
      console.log('[Lifecycle] Actor is dead at turn start. Moving to next turn.');
      setBattleState('CALCULATING');
    } else if (skipTurn) {
      console.log('[Lifecycle] Actor turn skipped (Status Effect).');
      setTimeout(() => setBattleState('CALCULATING'), 1000);
    } else {
      const isAutoMode = actor.isEnemy || isAutoBattle;
      console.log('[Lifecycle] Transitioning to thinking mode:', isAutoMode ? 'AI' : 'INPUT');
      setBattleState(isAutoMode ? 'AI_THINKING' : 'WAITING_INPUT');
    }
    console.groupEnd();
  }, [appendDetailedLog, addLog, setCharacters, setBattleState, playSound, isAutoBattle]);

  const advanceTurn = useCallback(() => {
    if (battleState !== 'CALCULATING') return;
    
    if (characters.length === 0) {
      console.warn('[Lifecycle] advanceTurn called but characters list is empty. Waiting for initialization...');
      return;
    }

    console.group('⏳ Turn Advancement');
    const aliveChars = characters.filter(c => !c.isDead);
    
    // Victory/Defeat Checks
    if (aliveChars.filter(c => c.isEnemy).length === 0) {
      console.log('[Lifecycle] Victory detected.');
      playSound('victory');
      addLog('敵を全滅させた！戦闘勝利！');
      setBattleState('END');
      console.groupEnd();
      return;
    }
    if (aliveChars.filter(c => !c.isEnemy).length === 0) {
      console.log('[Lifecycle] Defeat detected.');
      playSound('defeat');
      addLog('パーティは全滅した……。');
      setBattleState('END');
      console.groupEnd();
      return;
    }

    // Find next actor
    let nextActor = aliveChars.find(c => c.wait <= 0 && !c.debug?.isFrozen);
    let newChars = [...characters];

    if (!nextActor) {
      const activeChars = aliveChars.filter(c => !c.debug?.isFrozen);
      if(activeChars.length === 0) {
        console.warn('[Lifecycle] No active characters found (all frozen?). Battle stalled.');
        console.groupEnd();
        return;
      }
      
      const minWait = Math.min(...activeChars.map(c => c.wait));
      console.log(`[Lifecycle] No one ready. Reducing wait times by: ${minWait}`);
      newChars = newChars.map(c => (c.isDead || c.debug?.isFrozen) ? c : { ...c, wait: c.wait - minWait });
      nextActor = newChars.find(c => !c.isDead && !c.debug?.isFrozen && c.wait <= 0);
    }

    setCharacters(newChars);
    if (nextActor) {
      console.log('[Lifecycle] Next actor found:', nextActor.name);
      setCurrentActorId(nextActor.id);
      playSound('turn');
      setBattleState('PROCESSING_TURN');
      setTimeout(() => handleTurnStartEffects(nextActor!.id, newChars), 150);
    } else {
      console.error('[Lifecycle] Critical: nextActor not found even after wait reduction.');
    }
    console.groupEnd();
  }, [battleState, characters, addLog, setCharacters, setBattleState, setCurrentActorId, playSound, handleTurnStartEffects]);

  return useMemo(() => ({ advanceTurn }), [advanceTurn]);
};
