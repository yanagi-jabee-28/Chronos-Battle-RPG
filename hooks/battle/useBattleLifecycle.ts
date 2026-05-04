import { useCallback, useEffect } from 'react';
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
    let charsCopy = [...currentChars];
    let actorIndex = charsCopy.findIndex(c => c.id === actorId);
    let actor = { ...charsCopy[actorIndex] };
    let skipTurn = false;
    let logMessages: string[] = [];
    
    appendDetailedLog(`\n--- Turn: ${actor.name} ---`);

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
      setBattleState('CALCULATING');
    } else if (skipTurn) {
      setTimeout(() => setBattleState('CALCULATING'), 1000);
    } else {
      const isAutoMode = actor.isEnemy || isAutoBattle;
      setBattleState(isAutoMode ? 'AI_THINKING' : 'WAITING_INPUT');
    }
  }, [appendDetailedLog, addLog, setCharacters, setBattleState, playSound, isAutoBattle]);

  const advanceTurn = useCallback(() => {
    if (battleState !== 'CALCULATING') return;

    const aliveChars = characters.filter(c => !c.isDead);
    
    // Victory/Defeat Checks
    if (aliveChars.filter(c => c.isEnemy).length === 0) {
      playSound('victory');
      addLog('敵を全滅させた！戦闘勝利！');
      setBattleState('END');
      return;
    }
    if (aliveChars.filter(c => !c.isEnemy).length === 0) {
      playSound('defeat');
      addLog('パーティは全滅した……。');
      setBattleState('END');
      return;
    }

    // Find next actor
    let nextActor = aliveChars.find(c => c.wait <= 0 && !c.debug?.isFrozen);
    let newChars = [...characters];

    if (!nextActor) {
      const activeChars = aliveChars.filter(c => !c.debug?.isFrozen);
      if(activeChars.length === 0) return;
      
      const minWait = Math.min(...activeChars.map(c => c.wait));
      newChars = newChars.map(c => (c.isDead || c.debug?.isFrozen) ? c : { ...c, wait: c.wait - minWait });
      nextActor = newChars.find(c => !c.isDead && !c.debug?.isFrozen && c.wait <= 0);
    }

    setCharacters(newChars);
    if (nextActor) {
      setCurrentActorId(nextActor.id);
      playSound('turn');
      setBattleState('PROCESSING_TURN');
      setTimeout(() => handleTurnStartEffects(nextActor!.id, newChars), 150);
    }
  }, [battleState, characters, addLog, setCharacters, setBattleState, setCurrentActorId, playSound, handleTurnStartEffects]);

  return { advanceTurn };
};
