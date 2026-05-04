import { Character, StatusEffectDefinition, ActiveEffect, SkillDefinition } from '@/types/battle';
import { STATUS_EFFECTS } from '@/constants/game-data';

/**
 * Calculates a character's stats after applying multipliers from active effects.
 */
export const calculateEffectiveStats = (char: Character) => {
  const multipliers: Record<string, number> = { atk: 1.0, def: 1.0, spd: 1.0 };
  
  char.effects.forEach((eff: ActiveEffect) => {
    const statusDef = (STATUS_EFFECTS as Record<string, StatusEffectDefinition>)[eff.id];
    if (statusDef && statusDef.stat) {
      multipliers[statusDef.stat] += (statusDef.amount! * eff.stacks);
    }
  });

  const applyCap = (val: number) => Math.max(0.3, Math.min(2.5, val));

  return {
    atk: Math.floor(char.atk * applyCap(multipliers.atk)),
    def: Math.floor(char.def * applyCap(multipliers.def)),
    spd: Math.floor(char.spd * applyCap(multipliers.spd)),
  };
};

/**
 * Calculates damage for a given skill from actor to target.
 */
export const calculateDamage = (
  actorStats: { atk: number }, 
  targetStats: { def: number }, 
  skill: SkillDefinition,
  isInvincible: boolean = false,
  isOneHitKill: boolean = false
): number => {
  if (isInvincible) return 0;
  if (isOneHitKill) return 9999;

  const isMagic = skill.type.includes('magic');
  const defMultiplier = isMagic ? 0.3 : 0.5;
  
  let baseDmg = (actorStats.atk * (skill.power || 0)) - (targetStats.def * defMultiplier);
  baseDmg = Math.max(1, baseDmg); 
  
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.floor(baseDmg * variance));
};

/**
 * Calculates heal amount for a given skill.
 */
export const calculateHeal = (actorStats: { atk: number }, skill: SkillDefinition): number => {
  const variance = 0.9 + Math.random() * 0.2;
  return Math.floor(actorStats.atk * (skill.power || 0) * variance);
};

/**
 * Calculates the next wait time for a character.
 */
export const calculateWaitTime = (spd: number, baseWait: number, multiplier: number = 1.0): number => {
  return Math.floor((baseWait / spd) * multiplier);
};

/**
 * Generates a simulated timeline of upcoming turns.
 */
export const generateSimulatedTimeline = (characters: Character[], baseWait: number, depth: number = 20) => {
  const aliveChars = characters.filter(c => !c.isDead && !c.debug?.isFrozen);
  if (aliveChars.length === 0) return [];

  let virtualChars = aliveChars.map(c => ({ 
    id: c.id, 
    wait: c.wait, 
    spd: calculateEffectiveStats(c).spd 
  }));
  
  const timeline = [];
  for (let i = 0; i < depth; i++) {
    const next = virtualChars.sort((a, b) => a.wait - b.wait)[0];
    const char = aliveChars.find(c => c.id === next.id)!;
    timeline.push({ id: next.id, name: char.name, isEnemy: char.isEnemy, wait: next.wait });
    
    const minWait = next.wait;
    virtualChars = virtualChars.map(c => ({
      ...c,
      wait: c.id === next.id ? calculateWaitTime(c.spd, baseWait) : c.wait - minWait
    }));
  }
  return timeline;
};
