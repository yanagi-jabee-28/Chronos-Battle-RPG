'use client';

import { useState, useEffect, useCallback } from 'react';
import { STATUS_EFFECTS, SKILLS, INITIAL_CHARACTERS, BASE_WAIT_TIME } from '@/constants/game-data';
import { useAudio } from './useAudio';

export type BattleState = 'INIT' | 'CALCULATING' | 'PROCESSING_TURN' | 'WAITING_INPUT' | 'ENEMY_AI' | 'ALLY_AI' | 'THINKING' | 'EXECUTING' | 'END';

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

  useEffect(() => {
    if (battleState !== 'ENEMY_AI' && battleState !== 'ALLY_AI') return;
    
    let isCancelled = false;
    let timer: any;

    timer = setTimeout(() => {
      if (isCancelled) return;

      const actor = characters.find(c => c.id === currentActorId);
      if (!actor) return;
      
      // If it's an ally turn and auto battle was turned off, revert to manual input
      if (!actor.isEnemy && !isAutoBattle) {
        setBattleState('WAITING_INPUT');
        return;
      }

      const alivePlayers = characters.filter(c => !c.isEnemy && !c.isDead);
      const aliveEnemies = characters.filter(c => c.isEnemy && !c.isDead);
      const deadPlayers = characters.filter(c => !c.isEnemy && c.isDead);
      
      const getValidSkill = (preferredId: string, fallbackId = 'attack') => {
        const skill = (SKILLS as any)[preferredId];
        return (actor.mp >= skill.cost || actor.debug?.isInfiniteMp) ? preferredId : fallbackId;
      };

      let selectedSkillId = 'attack';
      let targets: string[] = [];

      // Check for provoke
      const opposingTeam = actor.isEnemy ? alivePlayers : aliveEnemies;
      const provokedBy = opposingTeam.find(c => c.effects.some((e: any) => e.id === 'PROVOKE'));

      if (actor.isEnemy) {
        // --- ENEMY AI ---
        if (actor.id === 'e1') { // Boss: Kill-focus & Cleanse
          const debuffCount = actor.effects.filter((e: any) => (STATUS_EFFECTS as any)[e.id].type === 'bad').reduce((acc: number, curr: any) => acc + curr.stacks, 0);
          
          if (debuffCount >= 2 && Math.random() < 0.8) {
              selectedSkillId = getValidSkill('boss_aura');
              targets = [actor.id];
          } else {
              const healer = alivePlayers.find(c => c.id === 'p3');
              const lowestHp = [...alivePlayers].sort((a, b) => a.hp - b.hp)[0];
              const target = healer || lowestHp;
              
              if (!provokedBy) targets = [target.id];

              const notDebuffedAllies = aliveEnemies.filter(c => !c.effects.some((e: any) => e.id === 'ATK_DOWN')).length;
              if (notDebuffedAllies >= 2 && Math.random() < 0.5) selectedSkillId = getValidSkill('intimidate');
              else if (Math.random() < 0.4) selectedSkillId = getValidSkill('demon_slash');
              else selectedSkillId = 'attack';
          }
        } else if (actor.id === 'e2') { // Heavy Armor: Tank & Protect Boss
          const boss = aliveEnemies.find(c => c.id === 'e1');
          const hasProvoke = actor.effects.some((e: any) => e.id === 'PROVOKE');
          
          if (boss && boss.hp < boss.maxHp * 0.5) {
              if (!hasProvoke && Math.random() < 0.8) {
                  selectedSkillId = getValidSkill('provoke');
                  targets = [actor.id];
              } else {
                  selectedSkillId = getValidSkill('guard_stance');
              }
          } else if (boss && boss.hp < boss.maxHp * 0.8 && Math.random() < 0.6) {
              selectedSkillId = getValidSkill('dark_heal');
              targets = [boss.id];
          } else if (Math.random() < 0.3) {
              selectedSkillId = getValidSkill('guard_stance');
          } else {
              selectedSkillId = 'attack'; // Rare attack
          }
        } else if (actor.id === 'e3') { // Mage: Debuffer & Counter
          const dps = alivePlayers.find(c => c.id === 'p1' || c.id === 'p2');
          const target = dps || alivePlayers[0];
          if (!provokedBy) targets = [target.id];

          const hastedAlly = alivePlayers.find(c => c.effects.some((e: any) => e.id === 'SPD_UP'));
          if (hastedAlly && Math.random() < 0.8) {
              selectedSkillId = getValidSkill('slow');
              if (!provokedBy) targets = [hastedAlly.id];
          } else if (Math.random() < 0.6) {
              selectedSkillId = getValidSkill('curse');
          } else {
              selectedSkillId = getValidSkill('slow');
          }
        }
      } else {
        // --- ALLY AI ---
        if (actor.id === 'p1') { // Ars: DPS / Break
          if (actor.mp < 15 && actor.hp > actor.maxHp * 0.3) {
            selectedSkillId = getValidSkill('renki');
            targets = [actor.id];
          } else {
            const target = aliveEnemies.find(e => !e.effects.some((ef: any) => ef.id === 'DEF_DOWN')) || [...aliveEnemies].sort((a, b) => a.hp - b.hp)[0];
            if (!provokedBy) targets = [target.id];

            if (!target.effects.some((ef: any) => ef.id === 'DEF_DOWN') && actor.mp >= (SKILLS as any).armor_break.cost) {
              selectedSkillId = getValidSkill('armor_break');
            } else {
              selectedSkillId = getValidSkill('power_slash');
            }
          }
        } else if (actor.id === 'p2') { // Luna: AoE / Control
          if (aliveEnemies.length >= 2 && actor.mp >= (SKILLS as any).meteor.cost) {
            selectedSkillId = getValidSkill('meteor');
          } else {
            const fastEnemy = aliveEnemies.find(e => e.spd >= 25 && !e.effects.some((ef: any) => ef.id === 'SPD_DOWN'));
            const target = fastEnemy || [...aliveEnemies].sort((a, b) => b.hp - a.hp)[0];
            if (!provokedBy) targets = [target.id];

            if (fastEnemy && actor.mp >= (SKILLS as any).slow.cost) {
              selectedSkillId = getValidSkill('slow');
            } else if (actor.mp >= (SKILLS as any).fireball.cost) {
              selectedSkillId = getValidSkill('fireball');
            } else if (actor.mp < 10) {
              selectedSkillId = getValidSkill('focus');
              targets = [actor.id];
            }
          }
        } else if (actor.id === 'p3') { // Cecil: Healer / Support
          const lowHpAlly = alivePlayers.find(p => p.hp < p.maxHp * 0.5);
          const debuffedAlly = alivePlayers.find(p => p.effects.some((e: any) => e.type === 'bad'));

          if (deadPlayers.length > 0 && actor.mp >= (SKILLS as any).resurrect.cost) {
            selectedSkillId = getValidSkill('resurrect');
            targets = [deadPlayers[0].id];
          } else if (alivePlayers.filter(p => p.hp < p.maxHp * 0.6).length >= 2 && actor.mp >= (SKILLS as any).area_heal.cost) {
            selectedSkillId = getValidSkill('area_heal');
          } else if (lowHpAlly && actor.mp >= (SKILLS as any).heal.cost) {
            selectedSkillId = getValidSkill('heal');
            targets = [lowHpAlly.id];
          } else if (debuffedAlly && actor.mp >= (SKILLS as any).cure.cost) {
            selectedSkillId = getValidSkill('cure');
            targets = [debuffedAlly.id];
          } else if (actor.mp < 20) {
            selectedSkillId = getValidSkill('prayer');
            targets = [actor.id];
          } else if (actor.mp >= (SKILLS as any).protect.cost) {
            selectedSkillId = getValidSkill('protect');
            targets = [alivePlayers.find(p => p.id === 'p1' || p.id === 'p2')?.id || actor.id];
          }
        } else if (actor.id === 'p4') { // Shion: Debuff / Support
          const unpoisonedEnemy = aliveEnemies.find(e => !e.effects.some((ef: any) => ef.id === 'POISON'));
          const unhastedAlly = alivePlayers.find(p => !p.effects.some((ef: any) => ef.id === 'SPD_UP'));
          const boss = aliveEnemies.find(e => e.id === 'e1');

          if (boss && actor.mp >= (SKILLS as any).smoke_bomb.cost && !boss.effects.some((e: any) => e.id === 'ATK_DOWN')) {
            selectedSkillId = getValidSkill('smoke_bomb');
          } else if (unpoisonedEnemy && actor.mp >= (SKILLS as any).poison_dagger.cost) {
            selectedSkillId = getValidSkill('poison_dagger');
            if (!provokedBy) targets = [unpoisonedEnemy.id];
          } else if (unhastedAlly && actor.mp >= (SKILLS as any).haste.cost) {
            selectedSkillId = getValidSkill('haste');
            targets = [unhastedAlly.id];
          } else if (actor.mp >= (SKILLS as any).drain_dagger.cost && actor.hp < actor.maxHp * 0.8) {
            selectedSkillId = getValidSkill('drain_dagger');
            if (!provokedBy) targets = [aliveEnemies[0].id];
          } else {
            selectedSkillId = 'attack';
          }
        }
      }

      let finalSkill = (SKILLS as any)[selectedSkillId];

      if (targets.length === 0) {
        if (finalSkill.target === 'enemy_single') targets = [[...opposingTeam].sort((a, b) => a.hp - b.hp)[0].id];
        else if (finalSkill.target === 'enemy_all') targets = opposingTeam.map(c => c.id);
        else if (finalSkill.target === 'ally_single') targets = [actor.id];
        else if (finalSkill.target === 'ally_all') targets = (actor.isEnemy ? aliveEnemies : alivePlayers).map(c => c.id);
        else if (finalSkill.target === 'ally_dead') {
           const deadAllies = characters.filter(c => c.isEnemy === actor.isEnemy && c.isDead);
           if (deadAllies.length > 0) targets = [deadAllies[0].id];
           else {
             finalSkill = (SKILLS as any)['attack'];
             targets = [[...opposingTeam].sort((a, b) => a.hp - b.hp)[0].id];
           }
        }
      }

      executeAction(actor.id, finalSkill, targets, characters);
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [battleState, characters, currentActorId, executeAction, isAutoBattle]);

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
    resetBattle
  };
};
