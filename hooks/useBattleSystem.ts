'use client';

import { useState, useEffect, useCallback } from 'react';
import { STATUS_EFFECTS, SKILLS, INITIAL_CHARACTERS, BASE_WAIT_TIME } from '@/constants/game-data';
import { useAudio } from './useAudio';

export type BattleState = 'INIT' | 'CALCULATING' | 'PROCESSING_TURN' | 'WAITING_INPUT' | 'ENEMY_AI' | 'THINKING' | 'EXECUTING' | 'END';

export const useBattleSystem = () => {
  const { playSound } = useAudio();
  const [characters, setCharacters] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [detailedLogs, setDetailedLogs] = useState("");
  const [currentActorId, setCurrentActorId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<any>(null);
  const [battleState, setBattleState] = useState<BattleState>('INIT');
  const [targetSelectionMode, setTargetSelectionMode] = useState<string | false>(false);

  const addLog = useCallback((message: string) => setLogs(prev => [...prev, message]), []);
  const appendDetailedLog = useCallback((msg: string) => setDetailedLogs(prev => prev + msg + "\n"), []);

  const getEffectiveStats = useCallback((char: any) => {
    let multipliers: any = { atk: 1.0, def: 1.0, spd: 1.0 };
    
    char.effects.forEach((eff: any) => {
      const statusDef = (STATUS_EFFECTS as any)[eff.id];
      if (statusDef && statusDef.stat) {
        multipliers[statusDef.stat] += (statusDef.amount * eff.stacks);
      }
    });

    const applyCap = (val: number) => Math.max(0.3, Math.min(2.5, val));

    return {
      atk: Math.floor(char.atk * applyCap(multipliers.atk)),
      def: Math.floor(char.def * applyCap(multipliers.def)),
      spd: Math.floor(char.spd * applyCap(multipliers.spd)),
    };
  }, []);

  const endTurn = useCallback((actorId: string, currentChars: any[]) => {
    let newChars = [...currentChars];
    const actorIndex = newChars.findIndex(c => c.id === actorId);
    
    if (newChars[actorIndex] && !newChars[actorIndex].isDead) {
        const stats = getEffectiveStats(newChars[actorIndex]);
        let nextWait = Math.floor(BASE_WAIT_TIME / stats.spd);
        
        if (newChars[actorIndex]._nextWaitMultiplier) {
            nextWait = Math.floor(nextWait * newChars[actorIndex]._nextWaitMultiplier);
            delete newChars[actorIndex]._nextWaitMultiplier;
        }
        
        newChars[actorIndex].wait = nextWait;
        appendDetailedLog(`  -> Next Wait set to: ${nextWait} (Effective SPD: ${stats.spd})`);
    }

    setCharacters(newChars);
    setSelectedSkill(null);
    setTargetSelectionMode(false);
    setCurrentActorId(null);
    setBattleState('CALCULATING');
  }, [getEffectiveStats, appendDetailedLog]);

  const executeAction = useCallback((actorId: string, skill: any, targetIds: string[], currentChars: any[]) => {
    setBattleState('EXECUTING');
    let charsCopy = [...currentChars];
    const actorIndex = charsCopy.findIndex(c => c.id === actorId);
    let actor = charsCopy[actorIndex];
    const actorStats = getEffectiveStats(actor);

    if (!actor.debug?.isInfiniteMp) {
        actor.mp -= skill.cost;
    }
    
    addLog(`${actor.name} の ${skill.name}！`);
    appendDetailedLog(`Action: [${skill.name}] Target:[${targetIds.join(',')}]`);

    if (skill.postWaitMultiplier) {
        actor._nextWaitMultiplier = skill.postWaitMultiplier;
    }

    // Provoke logic
    if (skill.target.includes('single') && !['focus', 'renki', 'prayer'].includes(skill.id)) {
        let newTargetIds: string[] = [];
        targetIds.forEach(tId => {
            const originalTarget = charsCopy.find(c => c.id === tId);
            if (!originalTarget) return;

            const provokingAlly = charsCopy.find(c => c.isEnemy === originalTarget.isEnemy && !c.isDead && c.effects.some((e: any) => e.id === 'PROVOKE'));
            
            if (provokingAlly && provokingAlly.id !== tId && (skill.type.includes('damage') || skill.type.includes('debuff') || skill.type.includes('status'))) {
                newTargetIds.push(provokingAlly.id);
                addLog(`${provokingAlly.name} が攻撃を引き付けた！`);
                appendDetailedLog(`  -> Target Redirected to [${provokingAlly.id}] by PROVOKE`);
            } else {
                newTargetIds.push(tId);
            }
        });
        targetIds = newTargetIds;
    }

    setTimeout(() => {
      let results: string[] = [];
      let totalAbsorb = 0;
      let totalMpAbsorb = 0;

      targetIds.forEach(targetId => {
        const tIndex = charsCopy.findIndex(c => c.id === targetId);
        let target = { ...charsCopy[tIndex] };
        
        if (target.isDead && skill.type !== 'revive') return;
        if (!target.isDead && skill.type === 'revive') return;

        if (skill.type === 'revive') {
          playSound('heal');
          target.isDead = false;
          target.hp = Math.floor(target.maxHp * skill.power);
          target.effects = []; 
          target.wait = BASE_WAIT_TIME;
          results.push(`${target.name} は息を吹き返した！`);
          appendDetailedLog(`  -> [${target.id}] Revived (HP:${target.hp}/${target.maxHp})`);
          charsCopy[tIndex] = target;
          return; 
        }

        const targetStats = getEffectiveStats(target);
        let finalDmg = 0;

        if (skill.id === 'renki') {
            playSound('buff');
            const hpCost = Math.floor(target.maxHp * 0.15);
            target.hp = Math.max(1, target.hp - hpCost);
            target.mp = Math.min(target.maxMp, target.mp + 40);
            results.push(`${target.name} は身を削り、MPを回復した！`);
            appendDetailedLog(`  -> [${target.id}] Self DMG: ${hpCost}, MP Heal: 40`);
        }

        if (skill.type.includes('damage')) {
          const isMagic = skill.type.includes('magic');
          const defMultiplier = isMagic ? 0.3 : 0.5;
          let baseDmg = (actorStats.atk * skill.power) - (targetStats.def * defMultiplier);
          baseDmg = Math.max(1, baseDmg); 
          finalDmg = Math.max(1, Math.floor(baseDmg * (0.9 + Math.random() * 0.2)));
          
          if (target.debug?.isInvincible) finalDmg = 0;
          if (actor.debug?.isOneHitKill && target.isEnemy !== actor.isEnemy) finalDmg = 9999;

          target.hp = Math.max(0, target.hp - finalDmg);
          if (finalDmg > 0) playSound('attack');
          results.push(`${target.name} に ${finalDmg} のダメージ！`);
          appendDetailedLog(`  -> [${target.id}] DMG Calc: Base:${Math.floor(baseDmg)} => Final:${finalDmg} (Remain HP:${target.hp}/${target.maxHp})`);
          
          if (target.hp === 0) {
            target.isDead = true;
            target.effects = []; 
            results.push(`${target.name} を倒した！`);
            appendDetailedLog(`  -> [${target.id}] Died.`);
          }
        }

        if (skill.type.includes('absorb_mp') && finalDmg > 0) {
            const mpDrain = Math.min(target.mp, Math.max(1, Math.floor(finalDmg * 0.4)));
            if (mpDrain > 0) {
                target.mp -= mpDrain;
                totalMpAbsorb += mpDrain;
                results.push(`${target.name} からMPを ${mpDrain} 奪った！`);
                appendDetailedLog(`  -> [${target.id}] MP Drained: ${mpDrain} (Remain MP:${target.mp})`);
            }
        }

        if (skill.type.includes('absorb') && !skill.type.includes('absorb_mp') && finalDmg > 0) {
          totalAbsorb += Math.floor(finalDmg * 0.5);
        }

        if (skill.type.includes('heal') && !skill.type.includes('heal_mp')) {
          playSound('heal');
          const healAmount = Math.floor(actorStats.atk * skill.power * (0.9 + Math.random() * 0.2));
          target.hp = Math.min(target.maxHp, target.hp + healAmount);
          results.push(`${target.name} は ${healAmount} 回復した！`);
          appendDetailedLog(`  -> [${target.id}] Heal: ${healAmount} (Now HP:${target.hp}/${target.maxHp})`);
        }

        if (skill.type.includes('heal_mp')) {
          playSound('buff');
          const mpHeal = Math.floor(target.maxMp * skill.power);
          target.mp = Math.min(target.maxMp, target.mp + mpHeal);
          results.push(`${target.name} はMPを ${mpHeal} 回復した！`);
          appendDetailedLog(`  -> [${target.id}] MP Heal: ${mpHeal} (Now MP:${target.mp}/${target.maxMp})`);
        }

        if (skill.type.includes('cure')) {
          playSound('heal');
          target.effects = target.effects.filter((e: any) => (STATUS_EFFECTS as any)[e.id].type === 'good');
          results.push(`${target.name} の状態異常が回復した！`);
          appendDetailedLog(`  -> [${target.id}] Cured bad status.`);
        }

        if (!target.isDead && (skill.type.includes('status') || skill.type.includes('buff') || skill.type.includes('debuff') || skill.effect)) {
          const newEffect = (STATUS_EFFECTS as any)[skill.effect];
          if (newEffect.type === 'good') playSound('buff');
          else playSound('debuff');
          
          const applyStacks = skill.stackAmount || 1;
          const applyLimit = skill.stackLimit || newEffect.maxStack;
          
          if (newEffect.type === 'bad' && target.resistances.includes(skill.effect)) {
            results.push(`${target.name} は ${newEffect.name} をレジストした！`);
            appendDetailedLog(`  -> [${target.id}] Effect Blocked: Resisted ${newEffect.id}`);
          } else {
            const oppositeIndex = target.effects.findIndex((e: any) => e.id === newEffect.opposite);
            
            if (oppositeIndex !== -1) {
              target.effects[oppositeIndex].stacks -= applyStacks;
              if (target.effects[oppositeIndex].stacks <= 0) {
                target.effects.splice(oppositeIndex, 1);
                results.push(`${target.name} のステータス変化が相殺された！`);
              } else {
                results.push(`${target.name} のステータス変化が相殺され減少した！`);
              }
              appendDetailedLog(`  -> [${target.id}] Effect Canceled: ${newEffect.id} vs ${newEffect.opposite} (-${applyStacks} stack)`);
            } else {
              const existingEffect = target.effects.find((e: any) => e.id === skill.effect);
              if (existingEffect) {
                if (existingEffect.stacks >= applyLimit) {
                   results.push(`${target.name} の ${newEffect.name} はこれ以上重ねられない！(x${existingEffect.stacks})`);
                   appendDetailedLog(`  -> [${target.id}] Effect Stack Limit Reached: ${newEffect.id} (Limit:${applyLimit})`);
                } else {
                   existingEffect.stacks = Math.min(applyLimit, existingEffect.stacks + applyStacks);
                   existingEffect.duration = newEffect.duration; 
                   results.push(`${target.name} の ${newEffect.name} が重なった！(x${existingEffect.stacks})`);
                   appendDetailedLog(`  -> [${target.id}] Effect Stacked: ${newEffect.id} (x${existingEffect.stacks})`);
                }
              } else {
                target.effects.push({ id: skill.effect, duration: newEffect.duration, stacks: Math.min(applyStacks, applyLimit) });
                results.push(`${target.name} に ${newEffect.name} を付与した！`);
                appendDetailedLog(`  -> [${target.id}] Effect Applied: ${newEffect.id}`);
              }
            }
          }
        }

        charsCopy[tIndex] = target;
      });

      if (totalAbsorb > 0 && !actor.isDead) {
        actor.hp = Math.min(actor.maxHp, actor.hp + totalAbsorb);
        results.push(`${actor.name} はHPを ${totalAbsorb} 吸収した！`);
        appendDetailedLog(`  -> [${actor.id}] HP Absorb: ${totalAbsorb} (Now HP:${actor.hp}/${actor.maxHp})`);
      }
      
      if (totalMpAbsorb > 0 && !actor.isDead) {
        actor.mp = Math.min(actor.maxMp, actor.mp + totalMpAbsorb);
        results.push(`${actor.name} はMPを ${totalMpAbsorb} 吸収した！`);
        appendDetailedLog(`  -> [${actor.id}] MP Absorb: ${totalMpAbsorb} (Now MP:${actor.mp}/${actor.maxMp})`);
      }

      charsCopy[actorIndex] = actor;
      setCharacters(charsCopy);
      results.forEach(msg => addLog(msg));

      setTimeout(() => {
        endTurn(actorId, charsCopy);
      }, 1000);

    }, 500); 
  }, [getEffectiveStats, addLog, appendDetailedLog, endTurn, playSound]);

  const handleTurnStartEffects = useCallback((actorId: string, currentChars: any[]) => {
    let charsCopy = [...currentChars];
    let actorIndex = charsCopy.findIndex(c => c.id === actorId);
    let actor = { ...charsCopy[actorIndex] };
    let skipTurn = false;
    let logMessages: string[] = [];
    
    appendDetailedLog(`\n--- Turn: ${actor.name} ---`);

    if (actor.mp < actor.maxMp) {
      const mpRegen = Math.max(1, Math.floor(actor.maxMp * 0.05));
      actor.mp = Math.min(actor.maxMp, actor.mp + mpRegen);
      appendDetailedLog(`MP Regen: +${mpRegen} (Now: ${actor.mp})`);
    }

    actor.effects = actor.effects.map((eff: any) => ({ ...eff, duration: eff.duration - 1 })).filter((eff: any) => {
      if (eff.id === 'POISON') {
        if (!actor.debug?.isInvincible) {
          playSound('debuff');
          const dmg = Math.floor(actor.maxHp * 0.05 * eff.stacks); 
          actor.hp = Math.max(0, actor.hp - dmg);
          logMessages.push(`${actor.name} は毒で ${dmg} のダメージを受けた！`);
          appendDetailedLog(`Poison DMG (x${eff.stacks}): ${dmg} (Remain HP:${actor.hp}/${actor.maxHp})`);
          if (actor.hp === 0) {
              actor.isDead = true;
              logMessages.push(`${actor.name} は倒れた！`);
          }
        }
      } else if (eff.id === 'STUN') {
        skipTurn = true;
        logMessages.push(`${actor.name} はスタンしていて動けない！`);
        appendDetailedLog(`Status: Stunned.`);
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
        endTurn(actorId, charsCopy);
    } else if (skipTurn) {
        setTimeout(() => endTurn(actorId, charsCopy), 1000);
    } else {
        setBattleState(actor.isEnemy ? 'ENEMY_AI' : 'WAITING_INPUT');
    }
  }, [appendDetailedLog, addLog, endTurn, playSound]);

  useEffect(() => {
    if (battleState === 'INIT') {
      const initChars = INITIAL_CHARACTERS.map(c => ({
        ...c,
        wait: Math.floor(BASE_WAIT_TIME / c.spd) + Math.floor(Math.random() * 10)
      }));
      
      setTimeout(() => {
        setCharacters(initChars);
        addLog('戦闘開始！');
        
        let initLog = "--- BATTLE START ---\n[Init State]\n";
        initChars.forEach(c => {
          initLog += `${c.id}(${c.name}): HP${c.hp} MP${c.mp} ATK${c.atk} DEF${c.def} SPD${c.spd} Wait:${c.wait}\n`;
        });
        appendDetailedLog(initLog);

        setBattleState('CALCULATING');
      }, 0);
    }
  }, [battleState, addLog, appendDetailedLog]);

  useEffect(() => {
    if (battleState !== 'CALCULATING') return;

    const aliveChars = characters.filter(c => !c.isDead);
    
    setTimeout(() => {
      if (aliveChars.filter(c => c.isEnemy).length === 0) {
        playSound('victory');
        addLog('敵を全滅させた！戦闘勝利！');
        appendDetailedLog("--- BATTLE END: WIN ---");
        setBattleState('END');
        return;
      }
      if (aliveChars.filter(c => !c.isEnemy).length === 0) {
        playSound('defeat');
        addLog('パーティは全滅した……。');
        appendDetailedLog("--- BATTLE END: LOSE ---");
        setBattleState('END');
        return;
      }

      setBattleState('PROCESSING_TURN');

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
      setCurrentActorId(nextActor!.id);
      playSound('turn');
      
      setTimeout(() => {
        handleTurnStartEffects(nextActor!.id, newChars);
      }, 500);
    }, 0);
  }, [battleState, characters, addLog, appendDetailedLog, handleTurnStartEffects, playSound]);

  useEffect(() => {
    if (battleState !== 'ENEMY_AI') return;
    
    setTimeout(() => {
      setBattleState('THINKING');

      const actor = characters.find(c => c.id === currentActorId);
      if (!actor) return;

      setTimeout(() => {
        const aliveAllies = characters.filter(c => c.isEnemy && !c.isDead);
        const aliveEnemies = characters.filter(c => !c.isEnemy && !c.isDead);
        
        const getValidSkill = (preferredId: string, fallbackId = 'attack') => {
          const skill = (SKILLS as any)[preferredId];
          return (actor.mp >= skill.cost || actor.debug?.isInfiniteMp) ? preferredId : fallbackId;
        };

        let selectedSkillId = 'attack';
        let targets: string[] = [];

        if (actor.id === 'e1') {
          const debuffCount = actor.effects.filter((e: any) => (STATUS_EFFECTS as any)[e.id].type === 'bad').reduce((acc: number, curr: any) => acc + curr.stacks, 0);
          
          if (debuffCount >= 2 && Math.random() < 0.8) {
              selectedSkillId = getValidSkill('boss_aura');
              targets = [actor.id];
          } else {
              const notDebuffedAllies = aliveEnemies.filter(c => !c.effects.some((e: any) => e.id === 'ATK_DOWN')).length;
              if (notDebuffedAllies >= 2 && Math.random() < 0.5) selectedSkillId = getValidSkill('intimidate');
              else if (Math.random() < 0.4) selectedSkillId = getValidSkill('demon_slash');
              else selectedSkillId = 'attack';
          }
        } else if (actor.id === 'e2') {
          const hasProvoke = actor.effects.some((e: any) => e.id === 'PROVOKE');
          const lowHpAlly = aliveAllies.find(c => c.hp < c.maxHp * 0.5 && c.id !== actor.id);
          
          if (!hasProvoke && Math.random() < 0.6) {
              selectedSkillId = getValidSkill('provoke');
              targets = [actor.id];
          } else if (lowHpAlly && Math.random() < 0.7) {
              selectedSkillId = getValidSkill('dark_heal');
              targets = [lowHpAlly.id];
          } else if (Math.random() < 0.3) {
              selectedSkillId = getValidSkill('guard_stance');
          } else {
              selectedSkillId = 'attack';
          }
        } else if (actor.id === 'e3') {
          const debuffedAlly = aliveAllies.find(c => c.effects.some((e: any) => e.id === 'DEF_DOWN' || e.id === 'SPD_DOWN' || e.id === 'POISON'));
          if (debuffedAlly && Math.random() < 0.6) {
              selectedSkillId = getValidSkill('clear');
              targets = [debuffedAlly.id];
          } else if (Math.random() < 0.5) {
              selectedSkillId = Math.random() > 0.5 ? getValidSkill('curse') : getValidSkill('slow');
          } else {
              selectedSkillId = 'attack';
          }
        }

        const skill = (SKILLS as any)[selectedSkillId];

        if (targets.length === 0) {
          if (skill.target === 'enemy_single') targets = [[...aliveEnemies].sort((a, b) => a.hp - b.hp)[0].id];
          else if (skill.target === 'enemy_all') targets = aliveEnemies.map(c => c.id);
          else if (skill.target === 'ally_single') targets = [actor.id];
          else if (skill.target === 'ally_all') targets = aliveAllies.map(c => c.id);
        }

        executeAction(actor.id, skill, targets, characters);
      }, 1000);
    }, 0);
  }, [battleState, characters, currentActorId, executeAction]);

  const generateSimulatedTimeline = useCallback(() => {
    let simChars = characters.filter(c => !c.isDead && !c.debug?.isFrozen).map(c => ({
      id: c.id,
      name: c.name,
      isEnemy: c.isEnemy,
      simWait: c.wait,
      spd: getEffectiveStats(c).spd 
    }));

    let tl: any[] = [];
    if (simChars.length === 0) return tl;

    if (currentActorId && (battleState === 'WAITING_INPUT' || battleState === 'ENEMY_AI' || battleState === 'THINKING')) {
       const activeActor = simChars.find(c => c.id === currentActorId);
       if (activeActor) activeActor.simWait = 0;
    }

    for (let i = 0; i < 15; i++) {
      simChars.sort((a, b) => a.simWait - b.simWait);
      let next = simChars[0];
      
      tl.push({ id: next.id, name: next.name, isEnemy: next.isEnemy });
      
      let passTime = next.simWait;
      simChars.forEach(c => c.simWait -= passTime);
      next.simWait = Math.floor(BASE_WAIT_TIME / next.spd);
    }
    return tl;
  }, [characters, currentActorId, battleState, getEffectiveStats]);

  return {
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
    getEffectiveStats
  };
};
