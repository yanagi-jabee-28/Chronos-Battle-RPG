import { useCallback } from 'react';
import { Character, SkillDefinition, StatusEffectDefinition, ActiveEffect, EnemyKnowledge } from '@/types/battle';
import { STATUS_EFFECTS } from '@/constants/game-data';
import { calculateEffectiveStats, calculateDamage, calculateHeal } from '@/lib/battle/engine';

export const useBattleActions = (
  characters: Character[],
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>,
  addLog: (msg: string) => void,
  appendDetailedLog: (msg: string) => void,
  playSound: (type: any) => void,
  setEnemyKnowledge: React.Dispatch<React.SetStateAction<Record<string, EnemyKnowledge>>>
) => {
  const executeAction = useCallback((actorId: string, skill: SkillDefinition, targetIds: string[]) => {
    let charsCopy = [...characters];
    const actorIndex = charsCopy.findIndex(c => c.id === actorId);
    let actor = { ...charsCopy[actorIndex] };
    const actorStats = calculateEffectiveStats(actor);

    if (!actor.debug?.isInfiniteMp) {
      actor.mp -= skill.cost;
    }
    
    addLog(`${actor.name} の ${skill.name}！`);
    appendDetailedLog(`Action: [${skill.name}] Target:[${targetIds.join(',')}]`);

    if (skill.postWaitMultiplier) {
      actor._nextWaitMultiplier = skill.postWaitMultiplier;
    }

    // Provoke logic (Target redirection)
    if (skill.target.includes('single') && !['focus', 'renki', 'prayer'].includes(skill.id)) {
      let redirectedTargetIds: string[] = [];
      targetIds.forEach(tId => {
        const originalTarget = charsCopy.find(c => c.id === tId);
        if (!originalTarget) return;

        const provokingAlly = charsCopy.find(c => 
          c.isEnemy === originalTarget.isEnemy && 
          !c.isDead && 
          c.effects.some((e: ActiveEffect) => e.id === 'PROVOKE')
        );
        
        if (provokingAlly && provokingAlly.id !== tId && (skill.type.includes('damage') || skill.type.includes('debuff') || skill.type.includes('status'))) {
          redirectedTargetIds.push(provokingAlly.id);
          addLog(`${provokingAlly.name} が攻撃を引き付けた！`);
          appendDetailedLog(`  -> Target Redirected to [${provokingAlly.id}] by PROVOKE`);
        } else {
          redirectedTargetIds.push(tId);
        }
      });
      targetIds = redirectedTargetIds;
    }

    let results: string[] = [];
    let totalAbsorb = 0;
    let totalMpAbsorb = 0;

    targetIds.forEach(targetId => {
      const tIndex = charsCopy.findIndex(c => c.id === targetId);
      if (tIndex === -1) return;
      let target = { ...charsCopy[tIndex] };
      
      if (target.isDead && skill.type !== 'revive') return;
      if (!target.isDead && skill.type === 'revive') return;

      // Processing different skill types
      if (skill.type === 'revive') {
        processRevive(target, skill, results, appendDetailedLog, playSound);
      } else if (skill.id === 'renki') {
        processRenki(target, results, appendDetailedLog, playSound);
      } else {
        const targetStats = calculateEffectiveStats(target);
        let finalDmg = 0;

        // Damage Calculation
        if (skill.type.includes('damage')) {
          finalDmg = calculateDamage(actorStats, targetStats, skill, target.debug?.isInvincible, actor.debug?.isOneHitKill);
          target.hp = Math.max(0, target.hp - finalDmg);
          if (finalDmg > 0) playSound('attack');
          results.push(`${target.name} に ${finalDmg} のダメージ！`);
          appendDetailedLog(`  -> [${target.id}] Final DMG:${finalDmg} (Remain HP:${target.hp}/${target.maxHp})`);
          
          if (target.hp === 0) {
            target.isDead = true;
            target.effects = []; 
            results.push(`${target.name} を倒した！`);
          }
        }

        // Absorbs
        if (skill.type.includes('absorb_mp') && finalDmg > 0) {
          const mpDrain = Math.min(target.mp, Math.max(1, Math.floor(finalDmg * 0.4)));
          if (mpDrain > 0) {
            target.mp -= mpDrain;
            totalMpAbsorb += mpDrain;
            results.push(`${target.name} からMPを ${mpDrain} 奪った！`);
          }
        }
        if (skill.type.includes('absorb') && !skill.type.includes('absorb_mp') && finalDmg > 0) {
          totalAbsorb += Math.floor(finalDmg * 0.5);
        }

        // Healing
        if (skill.type.includes('heal') && !skill.type.includes('heal_mp')) {
          const healAmount = calculateHeal(actorStats, skill);
          target.hp = Math.min(target.maxHp, target.hp + healAmount);
          results.push(`${target.name} は ${healAmount} 回復した！`);
          playSound('heal');
        }
        if (skill.type.includes('heal_mp')) {
          const mpHeal = Math.floor(target.maxMp * (skill.power || 0));
          target.mp = Math.min(target.maxMp, target.mp + mpHeal);
          results.push(`${target.name} はMPを ${mpHeal} 回復した！`);
          playSound('buff');
        }

        // Cures & Status Effects
        if (skill.type.includes('cure')) {
          target.effects = target.effects.filter((e: ActiveEffect) => (STATUS_EFFECTS as any)[e.id].type === 'good');
          results.push(`${target.name} の状態異常が回復した！`);
          playSound('heal');
        }

        if (!target.isDead && (skill.type.includes('status') || skill.type.includes('buff') || skill.type.includes('debuff') || skill.effect || skill.bonusEffect)) {
          applyStatusEffects(target, skill, results, appendDetailedLog, playSound, setEnemyKnowledge);
        }
      }

      charsCopy[tIndex] = target;
    });

    // Final Actor Adjustments
    if (totalAbsorb > 0 && !actor.isDead) {
      actor.hp = Math.min(actor.maxHp, actor.hp + totalAbsorb);
      results.push(`${actor.name} はHPを ${totalAbsorb} 吸収した！`);
    }
    if (totalMpAbsorb > 0 && !actor.isDead) {
      actor.mp = Math.min(actor.maxMp, actor.mp + totalMpAbsorb);
      results.push(`${actor.name} はMPを ${totalMpAbsorb} 吸収した！`);
    }

    charsCopy[actorIndex] = actor;
    setCharacters(charsCopy);
    results.forEach(msg => addLog(msg));

    return charsCopy;
  }, [characters, setCharacters, addLog, appendDetailedLog, playSound, setEnemyKnowledge]);

  return { executeAction };
};

// --- Helper Functions to keep executeAction cleaner ---

const processRevive = (target: Character, skill: SkillDefinition, results: string[], appendDetailedLog: any, playSound: any) => {
  playSound('heal');
  target.isDead = false;
  target.hp = Math.floor(target.maxHp * (skill.power || 0));
  target.effects = []; 
  target.wait = 1000; // BASE_WAIT_TIME
  results.push(`${target.name} は息を吹き返した！`);
  appendDetailedLog(`  -> [${target.id}] Revived (HP:${target.hp}/${target.maxHp})`);
};

const processRenki = (target: Character, results: string[], appendDetailedLog: any, playSound: any) => {
  playSound('buff');
  const hpCost = Math.floor(target.maxHp * 0.15);
  target.hp = Math.max(1, target.hp - hpCost);
  target.mp = Math.min(target.maxMp, target.mp + 40);
  results.push(`${target.name} は身を削り、MPを回復した！`);
  appendDetailedLog(`  -> [${target.id}] Self DMG: ${hpCost}, MP Heal: 40`);
};

const applyStatusEffects = (
  target: Character, 
  skill: SkillDefinition, 
  results: string[], 
  appendDetailedLog: any, 
  playSound: any,
  setEnemyKnowledge: any
) => {
  const effectIds = [skill.effect, skill.bonusEffect].filter(Boolean) as string[];
  effectIds.forEach((effectId) => {
    const newEffect = (STATUS_EFFECTS as Record<string, StatusEffectDefinition>)[effectId];
    if (!newEffect) return;
    
    if (newEffect.type === 'good') playSound('buff');
    else playSound('debuff');

    const applyStacks = skill.stackAmount || 1;
    const applyLimit = skill.stackLimit || newEffect.maxStack;

    // Resistance Check
    if (newEffect.type === 'bad' && target.resistances?.includes(effectId)) {
      results.push(`${target.name} は ${newEffect.name} をレジストした！`);
      if (target.isEnemy) {
        setEnemyKnowledge((prev: any) => {
          const currentResisted = prev[target.id]?.resistedEffects || [];
          if (currentResisted.includes(effectId)) return prev;
          return {
            ...prev,
            [target.id]: { ...prev[target.id], resistedEffects: [...currentResisted, effectId] }
          };
        });
      }
      return;
    }

    // Opposite Effect Cancellation
    const oppositeIndex = target.effects.findIndex((e) => e.id === newEffect.opposite);
    if (oppositeIndex !== -1) {
      target.effects[oppositeIndex].stacks -= applyStacks;
      if (target.effects[oppositeIndex].stacks <= 0) {
        target.effects.splice(oppositeIndex, 1);
        results.push(`${target.name} のステータス変化が相殺された！`);
      } else {
        results.push(`${target.name} のステータス変化が相殺され減少した！`);
      }
    } else {
      const existingEffect = target.effects.find((e) => e.id === effectId);
      if (existingEffect) {
        if (existingEffect.stacks >= applyLimit) {
          results.push(`${target.name} の ${newEffect.name} はこれ以上重ねられない！`);
        } else {
          existingEffect.stacks = Math.min(applyLimit, existingEffect.stacks + applyStacks);
          existingEffect.duration = newEffect.duration;
          results.push(`${target.name} の ${newEffect.name} が重なった！(x${existingEffect.stacks})`);
        }
      } else {
        target.effects.push({ id: effectId, duration: newEffect.duration, stacks: Math.min(applyStacks, applyLimit) });
        results.push(`${target.name} に ${newEffect.name} を付与した！`);
      }
    }
  });
};
