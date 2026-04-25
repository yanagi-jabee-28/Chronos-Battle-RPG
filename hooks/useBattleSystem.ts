'use client';

import { useState, useEffect, useCallback } from 'react';
import { STATUS_EFFECTS, SKILLS, INITIAL_CHARACTERS, BASE_WAIT_TIME } from '@/constants/game-data';
import { useAudio } from './useAudio';
import { determineBestAction, TacticType } from '@/lib/ai-system';

export type BattleState = 'INIT' | 'CALCULATING' | 'PROCESSING_TURN' | 'WAITING_INPUT' | 'AI_THINKING' | 'EXECUTING' | 'END';

export interface EnemyKnowledge {
  resistedEffects: string[];
  weaknesses: string[];
  favoriteSkills?: string[];
  actionHistory?: string[];
}

export interface FutureState {
  turn: number;
  actor: any;
  predictedAction?: string;
  tacticalThreat: number; // 0-100
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
  const [enemyKnowledge, setEnemyKnowledge] = useState<Record<string, EnemyKnowledge>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem('ctb_enemy_knowledge');
    if (!saved) return {};
    try {
      return JSON.parse(saved);
    } catch {
      return {};
    }
  });
  const [history, setHistory] = useState<any[]>([]);
  const [aiCoverageMode, setAiCoverageMode] = useState(false);
  const [usedSkills, setUsedSkills] = useState<Record<string, string[]>>({});
  const [battleLog, setBattleLog] = useState<Array<{ actor: string; skill: string; target: string; damage?: number }>>([]);

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

        if (!target.isDead && (skill.type.includes('status') || skill.type.includes('buff') || skill.type.includes('debuff') || skill.effect || skill.bonusEffect)) {
          const effectIds = [skill.effect, skill.bonusEffect].filter(Boolean);
          effectIds.forEach((effectId: string) => {
            const newEffect = (STATUS_EFFECTS as any)[effectId];
            if (!newEffect) return;
            if (newEffect.type === 'good') playSound('buff');
            else playSound('debuff');

            const applyStacks = skill.stackAmount || 1;
            const applyLimit = skill.stackLimit || newEffect.maxStack;

            if (newEffect.type === 'bad' && target.resistances?.includes(effectId)) {
              results.push(`${target.name} は ${newEffect.name} をレジストした！`);
              appendDetailedLog(`  -> [${target.id}] Effect Blocked: Resisted ${newEffect.id}`);
              if (target.isEnemy) {
                setEnemyKnowledge(prev => {
                  const currentResisted = prev[target.id]?.resistedEffects || [];
                  if (currentResisted.includes(effectId)) return prev;
                  return {
                    ...prev,
                    [target.id]: { ...prev[target.id], resistedEffects: [...currentResisted, effectId], weaknesses: prev[target.id]?.weaknesses || [] }
                  };
                });
              }
              return;
            }

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
              const existingEffect = target.effects.find((e: any) => e.id === effectId);
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
                target.effects.push({ id: effectId, duration: newEffect.duration, stacks: Math.min(applyStacks, applyLimit) });
                results.push(`${target.name} に ${newEffect.name} を付与した！`);
                appendDetailedLog(`  -> [${target.id}] Effect Applied: ${newEffect.id}`);
              }
            }
          });
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
  }, [getEffectiveStats, addLog, appendDetailedLog, endTurn, playSound, logs, detailedLogs, currentActorId]);

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
        const isAutoMode = actor.isEnemy || isAutoBattle;
        setBattleState(isAutoMode ? 'AI_THINKING' : 'WAITING_INPUT');
    }
  }, [appendDetailedLog, addLog, endTurn, playSound, isAutoBattle]);

  useEffect(() => {
    if (isAutoBattle && battleState === 'WAITING_INPUT') {
      setTimeout(() => setBattleState('AI_THINKING'), 0);
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

  // 敵の行動パターン分析
  const predictEnemyAction = useCallback((enemy: any) => {
    const knowledge = enemyKnowledge[enemy.id];
    if (!knowledge?.actionHistory || knowledge.actionHistory.length === 0) return 'attack';
    
    // 最も使われたスキルを返す（簡易AI学習）
    const frequency: Record<string, number> = {};
    knowledge.actionHistory.forEach(skill => {
      frequency[skill] = (frequency[skill] || 0) + 1;
    });
    return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]?.[0] || 'attack';
  }, [enemyKnowledge]);

  // 複数ターン先までのシミュレーション・脅威度計算
  const analyzeFutureThreats = useCallback((timeline: any[], chars: any[]) => {
    const threats: FutureState[] = [];
    const nextTurns = timeline.slice(0, 5); // 5ターン先まで
    
    nextTurns.forEach((tl, idx) => {
      const actor = chars.find(c => c.id === tl.id);
      if (!actor) return;
      
      let threat = 10; // Base
      if (actor.isEnemy) {
        threat += (actor.hp / actor.maxHp) * 30; // 敵のHP割合
        threat += (actor.atk / 30) * 20; // ATK強度
        const skillPower = actor.skills?.length ? 15 : 0;
        threat += skillPower;
      }
      
      threats.push({
        turn: idx,
        actor,
        predictedAction: actor.isEnemy ? predictEnemyAction(actor) : undefined,
        tacticalThreat: Math.min(100, threat)
      });
    });
    
    return threats;
  }, [predictEnemyAction]);

  // 先読みボーナススコア（将来の脅威に対する防御策）
  const calculateLookaheadBonus = useCallback((actor: any, skill: any, timeline: any[], chars: any[]) => {
    if (!actor.isEnemy) {
      // 味方AI用：敵の強力な攻撃を先読みして防御準備
      const futureThreats = analyzeFutureThreats(timeline, chars);
      const nextEnemyTurns = futureThreats.filter(t => t.actor.isEnemy).slice(0, 3);
      
      if (nextEnemyTurns.length > 0 && skill.type.includes('buff')) {
        // 敵の行動が近い場合、防御バフのスコア UP
        const enemyComesNextTurn = nextEnemyTurns[0]?.turn === 1;
        if (enemyComesNextTurn && skill.effect === 'DEF_UP') {
          return 150; // 敵が次ターンに来るなら防御UP
        }
        if (skill.id === 'warcry' || skill.id === 'guard_stance') {
          return nextEnemyTurns.length > 0 ? 100 : 0;
        }
      }
      
      // 味方が複数ダメージを受ける予測 → ヒール準備
      const damagedAllies = chars.filter(c => !c.isEnemy && !c.isDead && c.hp / c.maxHp < 0.6).length;
      if (damagedAllies >= 2 && skill.type.includes('heal') && skill.target === 'ally_all') {
        return 200; // 複数人ダメージ → エリアヒール重視
      }
    } else {
      // 敵AI用：強力な攻撃を同期させる
      const allyDamageSkills = actor.skills
        ?.map((id: string) => (SKILLS as any)[id])
        .filter((s: any) => s?.type.includes('damage'))
        .sort((a: any, b: any) => (b?.power || 0) - (a?.power || 0)) || [];
      
      const nextAllyTurns = timeline.filter(t => !chars.find(c => c.id === t.id)?.isEnemy).slice(0, 3);
      if (nextAllyTurns.length === 0 && skill.type.includes('damage')) {
        return 80; // 味方がいない間に高火力を溜める
      }
    }
    
    return 0;
  }, [analyzeFutureThreats]);

  // Utility-Based Scoring Function
  const calculateUtilityScore = useCallback((actor: any, skill: any, target: any, chars: any[]) => {
    const evaluatedTarget = target ?? actor;

    if (actor.mp < skill.cost && !actor.debug?.isInfiniteMp) return -1;
    if (!evaluatedTarget) return -1;
    let score = 10; // Base score

    // AI Coverage Mode: Force unused skills
    if (aiCoverageMode && (!usedSkills[actor.id] || !usedSkills[actor.id].includes(skill.id))) {
      score += 10000;
    }

    const targetHpRatio = evaluatedTarget.hp / evaluatedTarget.maxHp;

    // Damage Skills
    if (skill.type.includes('damage')) {
      score += skill.power * 20;
      if (targetHpRatio < 0.3) score += 50; // Kill focus
      if (skill.target === 'enemy_all') score += 15;
    }

    // Healing Skills
    if (skill.type.includes('heal') && !skill.type.includes('heal_mp')) {
      if (targetHpRatio < 0.5) score += (1 - targetHpRatio) * 200;
      else score -= 100; // Don't heal full HP
      if (skill.target === 'ally_all') {
        const allies = chars.filter(c => c.isEnemy === actor.isEnemy && !c.isDead);
        const totalMaxHp = allies.reduce((sum, c) => sum + c.maxHp, 0);
        const totalCurrentHp = allies.reduce((sum, c) => sum + c.hp, 0);
        const partyHpRatio = totalCurrentHp / Math.max(1, totalMaxHp);
        const debuffedCount = allies.filter(c => c.effects.some((e: any) => (STATUS_EFFECTS as any)[e.id]?.type === 'bad')).length;

        if (partyHpRatio < 0.6) {
          score += (1 - partyHpRatio) * 500;
          score += allies.filter(c => c.hp / c.maxHp < 0.6).length * 100;
          if (skill.id === 'blessing' && (partyHpRatio < 0.4 || debuffedCount >= 2)) {
            score += 600;
          }
        } else {
          score -= 100;
        }
      } else if (skill.id === 'cure' || skill.id === 'blessing') {
        const badEffects = evaluatedTarget.effects.filter((e: any) => (STATUS_EFFECTS as any)[e.id]?.type === 'bad');
        score += badEffects.length * 80;
        if (evaluatedTarget.effects.some((e: any) => e.id === 'SPD_DOWN' && e.stacks >= 2)) score += 200;
      }
    }
    if (skill.type.includes('heal_mp')) {
      const mpRatio = evaluatedTarget.maxMp > 0 ? evaluatedTarget.mp / evaluatedTarget.maxMp : 0;
      if (mpRatio < 0.3) score += 100;
      else score -= 50;
      if (skill.target === 'self' && evaluatedTarget.id === actor.id) {
        score += mpRatio < 0.5 ? 35 : -25;
      }
      if (skill.id === 'prayer' && evaluatedTarget.id === 'p2' && mpRatio < 0.3) {
        score += 250;
      }
    }

    // Buffs/Debuffs & Knowledge Base
    if (skill.effect) {
      const effectDef = (STATUS_EFFECTS as any)[skill.effect];
      if (effectDef?.type === 'bad' && evaluatedTarget.isEnemy) {
        if (evaluatedTarget.resistances?.includes(skill.effect)) {
          return 0;
        }
        if (enemyKnowledge[evaluatedTarget.id]?.resistedEffects?.includes(skill.effect)) {
          return 0; // Knowledge: Do not use resisted effects
        }
      }
      // Don't stack if already has max stacks
      const existing = evaluatedTarget.effects.find((e: any) => e.id === skill.effect);
      const stackLimit = skill.stackLimit || effectDef?.maxStack || 1;
      if (existing && existing.stacks >= stackLimit) {
        score -= 80;
      } else {
        score += effectDef?.type === 'bad' ? 35 : 30;
      }
    }

    // Personality Multipliers
    if (actor.id === 'e1') { // 魔将軍 (Boss)
      if (targetHpRatio < 0.3) score *= 2.5; // Kill focus
      if (evaluatedTarget.id === 'p3') score *= 1.5; // Healer focus
      if (skill.id === 'intimidate') {
        const debuffedAllies = chars.filter(c => !c.isEnemy && c.effects.some((e: any) => e.id === 'ATK_DOWN' && e.stacks >= 2));
        if (debuffedAllies.length >= 2) score -= 150;
      }
      if (skill.id === 'demon_slash' && actor.mp < actor.maxMp * 0.4) {
        score -= 100;
      }
    } else if (actor.id === 'p1') { // 剣士アルス
      if (skill.id === 'power_slash' && evaluatedTarget.effects.some((e: any) => e.id === 'DEF_DOWN')) {
        score += 200;
      }
      if (skill.id === 'warcry' && actor.effects.some((e: any) => e.id === 'ATK_DOWN')) {
        score += 300;
      }
    } else if (actor.id === 'e2') { // 重装兵 (Tank)
      const boss = chars.find(c => c.id === 'e1');
      if (boss && boss.hp / boss.maxHp < 0.5 && skill.id === 'provoke') score *= 5; // Protect boss
    } else if (actor.id === 'p3') { // 神官セシル
      const criticalAlly = chars.some(c => !c.isEnemy && !c.isDead && c.hp / c.maxHp < 0.3);
      const allyDebuffed = chars.some(c => !c.isEnemy && !c.isDead && c.effects.some((e: any) => (STATUS_EFFECTS as any)[e.id]?.type === 'bad'));
      if (criticalAlly && skill.type.includes('damage')) {
        score -= 300;
      }
      if (allyDebuffed && (skill.id === 'cure' || skill.id === 'blessing')) {
        score += 100;
      }
      if (chars.filter(c => !c.isEnemy && !c.isDead && c.hp / c.maxHp < 0.4).length >= 2 && skill.id === 'blessing') {
        score += 180;
      }
    } else if (actor.id === 'e3') { // 妖術師 (Mage)
      if ((evaluatedTarget.id === 'p1' || evaluatedTarget.id === 'p2') && skill.type.includes('debuff')) score *= 2; // Debuff DPS
      if (skill.target === 'enemy_all') {
        const aliveEnemies = chars.filter(c => c.isEnemy !== actor.isEnemy && !c.isDead).length;
        if (aliveEnemies === 1) score -= 150;
      }
    }

    return score;
  }, [aiCoverageMode, usedSkills, enemyKnowledge]);

  useEffect(() => {
    if (battleState !== 'AI_THINKING') return;
    
    let isCancelled = false;
    let timer: any;

    timer = setTimeout(() => {
      if (isCancelled) return;

      const actor = characters.find(c => c.id === currentActorId);
      if (!actor) return;

    // 敵の場合は固定作戦(または固有ルーチン)、味方の場合は設定された作戦を使用
      if (actor.isEnemy) {
        let selectedSkillId = 'attack';
        let targetIds: string[] = [];
        const aliveAllies = characters.filter(c => c.isEnemy && !c.isDead);
        const aliveEnemies = characters.filter(c => !c.isEnemy && !c.isDead);

        const getValidSkill = (id: string) => {
          const s = (SKILLS as any)[id];
          return (actor.skills.includes(id) && (actor.mp >= s.cost || actor.debug?.isInfiniteMp)) ? id : 'attack';
        };

        if (actor.id === 'e1') {
          // 【魔将軍：指揮官AI】
          const aliveMinions = aliveAllies.filter(c => c.id !== 'e1').length;
          if (aliveMinions > 0) {
            const needsBuff = aliveAllies.some(c => !c.effects.some((e: any) => e.id === 'ATK_UP'));
            if (needsBuff && Math.random() < 0.6) {
              selectedSkillId = getValidSkill('dark_command');
              targetIds = aliveAllies.map(c => c.id);
            } else {
              selectedSkillId = Math.random() < 0.3 ? getValidSkill('demon_slash') : 'attack';
              if (selectedSkillId === 'demon_slash') targetIds = aliveEnemies.map(c => c.id);
              else targetIds = [aliveEnemies[0]?.id];
            }
          } else {
            // 本気モード
            const hasAura = actor.effects.some((e: any) => e.id === 'ATK_UP');
            if (!hasAura) {
              selectedSkillId = getValidSkill('boss_aura');
              targetIds = [actor.id];
            } else {
              selectedSkillId = getValidSkill('demon_slash');
              targetIds = aliveEnemies.map(c => c.id);
            }
          }
        } else if (actor.id === 'e2') {
          // 【重装兵：タンクAI】
          const hasProvoke = actor.effects.some((e: any) => e.id === 'PROVOKE');
          const teamNeedsDef = aliveAllies.some(c => !c.effects.some((e: any) => e.id === 'DEF_UP'));
          
          if (!hasProvoke) {
            selectedSkillId = getValidSkill('provoke');
            targetIds = [actor.id];
          } else if (teamNeedsDef && Math.random() < 0.5) {
            selectedSkillId = getValidSkill('guard_stance');
            targetIds = aliveAllies.map(c => c.id);
          } else {
            selectedSkillId = 'attack';
            targetIds = [aliveEnemies[0]?.id];
          }
        } else if (actor.id === 'e3') {
          // 【妖術師：ジャマーAI】
          const enemiesWithoutPoison = aliveEnemies.filter(c => !c.effects.some((e: any) => e.id === 'POISON'));
          if (enemiesWithoutPoison.length > 0 && Math.random() < 0.7) {
            selectedSkillId = getValidSkill('dark_mist');
            targetIds = aliveEnemies.map(c => c.id);
          } else if (Math.random() < 0.5) {
            selectedSkillId = getValidSkill('slow');
            targetIds = [[...aliveEnemies].sort((a, b) => b.spd - a.spd)[0]?.id];
          } else {
            selectedSkillId = 'attack';
            targetIds = [aliveEnemies[0]?.id];
          }
        } else {
          // 汎用敵AIフォールバック
          const { skillId, targetIds: tIds } = determineBestAction(actor, characters, 'OFFENSE');
          selectedSkillId = skillId;
          targetIds = tIds;
        }

        const skill = (SKILLS as any)[selectedSkillId];
        
        console.log(`\n=== ENEMY AI: ${actor.name} ===`);
        console.log(`  => SELECTED: [${skill.id}] -> ${targetIds.join(', ')}\n`);

        setUsedSkills(prev => ({ ...prev, [actor.id]: [...(prev[actor.id] || []), selectedSkillId] }));
        setEnemyKnowledge(prev => ({
          ...prev,
          [actor.id]: {
            ...prev[actor.id],
            actionHistory: [...(prev[actor.id]?.actionHistory || []), selectedSkillId].slice(-10)
          }
        }));
        
        executeAction(actor.id, skill, targetIds.filter(Boolean), characters);

      } else {
        // 味方の場合は設定された作戦を使用
        const tactic = actor.tactic || 'SURVIVAL';
        const { skillId, targetIds } = determineBestAction(actor, characters, tactic);
        const skill = (SKILLS as any)[skillId];

        setUsedSkills(prev => ({ ...prev, [actor.id]: [...(prev[actor.id] || []), skillId] }));
        executeAction(actor.id, skill, targetIds, characters);
      }

    }, 1000); // 思考中のウェイト

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
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

    if (currentActorId && (battleState === 'WAITING_INPUT' || battleState === 'AI_THINKING')) {
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
    setAiCoverageMode,
    analyzeFutureThreats,
    predictEnemyAction
  };
};
