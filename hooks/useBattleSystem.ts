'use client';

import { useState, useEffect, useCallback } from 'react';
import { STATUS_EFFECTS, SKILLS, INITIAL_CHARACTERS, BASE_WAIT_TIME } from '@/constants/game-data';
import { useAudio } from './useAudio';

export type BattleState = 'INIT' | 'CALCULATING' | 'PROCESSING_TURN' | 'WAITING_INPUT' | 'ENEMY_AI' | 'ALLY_AI' | 'THINKING' | 'EXECUTING' | 'END';

export interface EnemyKnowledge {
  resistedEffects: string[];
  weaknesses: string[];
}

export const useBattleSystem = () => {
  const { playSound } = useAudio();
  const [characters, setCharacters] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [detailedLogs, setDetailedLogs] = useState("");
  const [currentActorId, setCurrentActorId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<any>(null);
  const [battleState, setBattleState] = useState<BattleState>('INIT');
  const [targetSelectionMode, setTargetSelectionMode] = useState<string | false>(false);
  const [isAutoBattle, setIsAutoBattle] = useState(false);
  const [battleCount, setBattleCount] = useState(0);

  // --- Advanced AI & Debug States ---
  const [enemyKnowledge, setEnemyKnowledge] = useState<Record<string, EnemyKnowledge>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [aiCoverageMode, setAiCoverageMode] = useState(false);
  const [usedSkills, setUsedSkills] = useState<Record<string, string[]>>({});

  // Load Knowledge on Mount
  useEffect(() => {
    const saved = localStorage.getItem('ctb_enemy_knowledge');
    if (saved) {
      try { setEnemyKnowledge(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  // Save Knowledge on Battle End
  useEffect(() => {
    if (battleState === 'END') {
      localStorage.setItem('ctb_enemy_knowledge', JSON.stringify(enemyKnowledge));
    }
  }, [battleState, enemyKnowledge]);

  const undoTurn = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const lastState = newHistory.pop();
      if (lastState) {
        setCharacters(lastState.characters);
        setLogs(lastState.logs);
        setDetailedLogs(lastState.detailedLogs);
        setCurrentActorId(lastState.currentActorId);
        setBattleState(lastState.battleState);
        playSound('cancel');
      }
      return newHistory;
    });
  }, [playSound]);

  const resetBattle = useCallback(() => {
    setCharacters([]);
    setLogs([]);
    setDetailedLogs("");
    setCurrentActorId(null);
    setSelectedSkill(null);
    setBattleState('INIT');
    setTargetSelectionMode(false);
    setBattleCount(prev => prev + 1);
  }, []);

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
    // Snapshot state for Time Travel BEFORE executing
    setHistory(prev => [...prev, {
      characters: JSON.parse(JSON.stringify(currentChars)),
      logs: [...logs],
      detailedLogs,
      currentActorId,
      battleState: 'WAITING_INPUT'
    }].slice(-10)); // Keep last 10 turns

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
            // Record Knowledge
            if (target.isEnemy) {
              setEnemyKnowledge(prev => {
                const currentResisted = prev[target.id]?.resistedEffects || [];
                if (currentResisted.includes(skill.effect)) return prev;
                return {
                  ...prev,
                  [target.id]: { ...prev[target.id], resistedEffects: [...currentResisted, skill.effect], weaknesses: prev[target.id]?.weaknesses || [] }
                };
              });
            }
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
      }, 300);

    }, 150); 
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
        setBattleState(actor.isEnemy ? 'ENEMY_AI' : (isAutoBattle ? 'ALLY_AI' : 'WAITING_INPUT'));
    }
  }, [appendDetailedLog, addLog, endTurn, playSound, isAutoBattle]);

  useEffect(() => {
    if (isAutoBattle && battleState === 'WAITING_INPUT') {
      setTimeout(() => setBattleState('ALLY_AI'), 0);
    }
  }, [isAutoBattle, battleState]);

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
      }, 150);
    }, 0);
  }, [battleState, characters, addLog, appendDetailedLog, handleTurnStartEffects, playSound]);

  // Utility-Based Scoring Function
  const calculateUtilityScore = useCallback((actor: any, skill: any, target: any, chars: any[]) => {
    if (actor.mp < skill.cost && !actor.debug?.isInfiniteMp) return -1;
    let score = 10; // Base score

    // AI Coverage Mode: Force unused skills
    if (aiCoverageMode && (!usedSkills[actor.id] || !usedSkills[actor.id].includes(skill.id))) {
      score += 10000;
    }

    const targetHpRatio = target.hp / target.maxHp;

    // Damage Skills
    if (skill.type.includes('damage')) {
      score += skill.power * 20;
      if (targetHpRatio < 0.3) score += 50; // Kill focus
    }

    // Healing Skills
    if (skill.type.includes('heal') && !skill.type.includes('heal_mp')) {
      if (targetHpRatio < 0.5) score += (1 - targetHpRatio) * 200;
      else score -= 100; // Don't heal full HP
    }
    if (skill.type.includes('heal_mp')) {
      if (target.mp / target.maxMp < 0.3) score += 100;
      else score -= 50;
    }

    // Buffs/Debuffs & Knowledge Base
    if (skill.effect) {
      const effectDef = (STATUS_EFFECTS as any)[skill.effect];
      if (effectDef.type === 'bad' && target.isEnemy) {
        if (enemyKnowledge[target.id]?.resistedEffects.includes(skill.effect)) {
          return 0; // Knowledge: Do not use resisted effects
        }
      }
      // Don't stack if already has max stacks
      const existing = target.effects.find((e: any) => e.id === skill.effect);
      if (existing && existing.stacks >= effectDef.maxStack) {
        score -= 50;
      } else {
        score += 40;
      }
    }

    // Personality Multipliers
    if (actor.id === 'e1') { // 魔将軍 (Boss)
      if (targetHpRatio < 0.3) score *= 2.5; // Kill focus
      if (target.id === 'p3') score *= 1.5; // Healer focus
    } else if (actor.id === 'e2') { // 重装兵 (Tank)
      const boss = chars.find(c => c.id === 'e1');
      if (boss && boss.hp / boss.maxHp < 0.5 && skill.id === 'provoke') score *= 5; // Protect boss
    } else if (actor.id === 'e3') { // 妖術師 (Mage)
      if ((target.id === 'p1' || target.id === 'p2') && skill.type.includes('debuff')) score *= 2; // Debuff DPS
    }

    return score;
  }, [aiCoverageMode, usedSkills, enemyKnowledge]);

  useEffect(() => {
    if (battleState !== 'ENEMY_AI' && battleState !== 'ALLY_AI') return;
    
    let isCancelled = false;
    let timer: any;

    timer = setTimeout(() => {
      if (isCancelled) return;

      const actor = characters.find(c => c.id === currentActorId);
      if (!actor) return;
      
      if (!actor.isEnemy && !isAutoBattle) {
        setBattleState('WAITING_INPUT');
        return;
      }

      const opposingTeam = actor.isEnemy ? characters.filter(c => !c.isEnemy && !c.isDead) : characters.filter(c => c.isEnemy && !c.isDead);
      const alliedTeam = actor.isEnemy ? characters.filter(c => c.isEnemy && !c.isDead) : characters.filter(c => !c.isEnemy && !c.isDead);
      const deadAllies = characters.filter(c => c.isEnemy === actor.isEnemy && c.isDead);

      // Provoke check
      const provokedBy = opposingTeam.find(c => c.effects.some((e: any) => e.id === 'PROVOKE'));

      let bestAction: { skill: any, targets: string[] } | null = null;
      let bestScore = -Infinity;

      const availableSkills = actor.skills.map((id: string) => (SKILLS as any)[id]).filter((s: any) => actor.mp >= s.cost || actor.debug?.isInfiniteMp);

      availableSkills.forEach((skill: any) => {
        let validTargets: any[] = [];
        
        if (skill.target === 'enemy_single') {
          validTargets = provokedBy ? [provokedBy] : opposingTeam;
        } else if (skill.target === 'ally_single') {
          validTargets = alliedTeam;
        } else if (skill.target === 'enemy_all') {
          validTargets = [opposingTeam]; // Array of array
        } else if (skill.target === 'ally_all') {
          validTargets = [alliedTeam];
        } else if (skill.target === 'ally_dead') {
          validTargets = deadAllies;
        } else if (['focus', 'renki', 'prayer'].includes(skill.id)) {
          validTargets = [actor];
        }

        validTargets.forEach(targetGroup => {
          const evalTarget = Array.isArray(targetGroup) ? targetGroup[0] : targetGroup;
          if (!evalTarget) return;

          const score = calculateUtilityScore(actor, skill, evalTarget, characters);
          
          if (score > bestScore) {
            bestScore = score;
            bestAction = { 
              skill, 
              targets: Array.isArray(targetGroup) ? targetGroup.map(t => t.id) : [targetGroup.id] 
            };
          }
        });
      });

      const finalAction = bestAction as { skill: any, targets: string[] } | null;
      if (finalAction) {
        setUsedSkills(prev => ({ ...prev, [actor.id]: [...(prev[actor.id] || []), finalAction.skill.id] }));
        executeAction(actor.id, finalAction.skill, finalAction.targets, characters);
      } else {
        // Fallback
        const fallbackSkill = (SKILLS as any)['attack'];
        const target = provokedBy ? provokedBy : opposingTeam[0];
        if (target) {
          executeAction(actor.id, fallbackSkill, [target.id], characters);
        }
      }

    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [battleState, characters, currentActorId, executeAction, isAutoBattle, calculateUtilityScore]);

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

    if (currentActorId && (battleState === 'WAITING_INPUT' || battleState === 'ENEMY_AI' || battleState === 'ALLY_AI' || battleState === 'THINKING')) {
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
    getEffectiveStats,
    isAutoBattle,
    setIsAutoBattle,
    resetBattle,
    undoTurn,
    history,
    enemyKnowledge,
    setEnemyKnowledge,
    aiCoverageMode,
    setAiCoverageMode
  };
};
