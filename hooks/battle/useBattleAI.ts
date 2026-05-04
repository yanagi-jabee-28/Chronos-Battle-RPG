import { useCallback } from 'react';
import { Character, SkillDefinition, EnemyKnowledge, FutureState } from '@/types/battle';
import { SKILLS, STATUS_EFFECTS } from '@/constants/game-data';
import { determineBestAction } from '@/lib/ai-system';

export const useBattleAI = (
  characters: Character[],
  enemyKnowledge: Record<string, EnemyKnowledge>,
  aiCoverageMode: boolean,
  usedSkills: Record<string, string[]>,
  addLog: (msg: string) => void
) => {

  // --- Prediction & Analysis ---

  const predictEnemyAction = useCallback((enemy: Character) => {
    const knowledge = enemyKnowledge[enemy.id];
    if (!knowledge?.actionHistory || knowledge.actionHistory.length === 0) return 'attack';
    
    const frequency: Record<string, number> = {};
    knowledge.actionHistory.forEach(skill => {
      frequency[skill] = (frequency[skill] || 0) + 1;
    });
    return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]?.[0] || 'attack';
  }, [enemyKnowledge]);

  const analyzeFutureThreats = useCallback((timeline: {id: string}[], chars: Character[]) => {
    const threats: FutureState[] = [];
    const nextTurns = timeline.slice(0, 5); 
    
    nextTurns.forEach((tl, idx) => {
      const actor = chars.find(c => c.id === tl.id);
      if (!actor) return;
      
      let threat = 10; 
      if (actor.isEnemy) {
        threat += (actor.hp / actor.maxHp) * 30;
        threat += (actor.atk / 30) * 20;
        threat += actor.skills?.length ? 15 : 0;
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

  // --- AI Decision Logic ---

  const decideAction = useCallback((actorId: string) => {
    const actor = characters.find(c => c.id === actorId);
    if (!actor) return null;

    // Boss/Minion Specific Scripted Logic
    if (actor.isEnemy) {
      return decideEnemyAction(actor, characters, addLog);
    }

    // Generic Utility-based AI for allies (Auto-Battle)
    return determineBestAction(actor, characters, actor.tactic);
  }, [characters, addLog]);

  return { decideAction, analyzeFutureThreats, predictEnemyAction };
};

// --- Scripted AI Routines ---

const decideEnemyAction = (actor: Character, characters: Character[], addLog: (msg: string) => void) => {
  const getValidSkill = (id: string) => {
    const s = (SKILLS as any)[id];
    return (actor.skills.includes(id) && (actor.mp >= s.cost || actor.debug?.isInfiniteMp)) ? id : 'attack';
  };

  const aliveAllies = characters.filter(c => c.isEnemy && !c.isDead);
  const aliveEnemies = characters.filter(c => !c.isEnemy && !c.isDead);

  if (actor.id === 'e1') { // Boss: Demon General
    const aliveMinions = aliveAllies.filter(c => c.id !== 'e1').length;
    
    if (aliveMinions === 0) {
      if (!actor.frenzyMode) {
        addLog("魔将軍の瞳に昏い光が宿る……「貴様ら、生かしては帰さぬぞ！」");
        // Frenzy mode activation logic is handled by caller (updating actor state)
        return { skillId: 'boss_aura', targetIds: [actor.id], forceFrenzy: true };
      }

      const hasAura = actor.effects.some((e) => e.id === 'ATK_UP');
      if (!hasAura) return { skillId: getValidSkill('boss_aura'), targetIds: [actor.id] };
      
      if (Math.random() < 0.5) {
        const target = [...aliveEnemies].sort((a, b) => b.hp - a.hp)[0];
        return { skillId: getValidSkill('death_bringer'), targetIds: [target.id] };
      }
      return { skillId: getValidSkill('demon_slash'), targetIds: aliveEnemies.map(c => c.id) };
    } else {
      const needsBuff = aliveAllies.some(c => !c.effects.some((e) => e.id === 'ATK_UP'));
      if (needsBuff && Math.random() < 0.7) {
        return { skillId: getValidSkill('dark_command'), targetIds: aliveAllies.map(c => c.id) };
      }
      return { skillId: Math.random() < 0.4 ? getValidSkill('demon_slash') : 'attack', targetIds: aliveEnemies.map(c => c.id) };
    }
  }

  if (actor.id === 'e2') { // Tank: Heavy Soldier
    const hasProvoke = actor.effects.some((e) => e.id === 'PROVOKE');
    if (!hasProvoke) return { skillId: getValidSkill('provoke'), targetIds: [actor.id] };
    return { skillId: Math.random() < 0.6 ? getValidSkill('stun_blow') : 'attack', targetIds: [aliveEnemies[0].id] };
  }

  if (actor.id === 'e3') { // Mage: Dark Mage
    const hurtAlly = aliveAllies.find(c => c.hp < c.maxHp * 0.7);
    const enemiesWithoutPoison = aliveEnemies.filter(c => !c.effects.some((e) => e.id === 'POISON'));

    if (hurtAlly) return { skillId: getValidSkill('dark_heal'), targetIds: [hurtAlly.id] };
    if (enemiesWithoutPoison.length > 0 && Math.random() < 0.8) return { skillId: getValidSkill('dark_mist'), targetIds: aliveEnemies.map(c => c.id) };
    if (Math.random() < 0.5) {
      const target = [...aliveEnemies].sort((a, b) => b.spd - a.spd)[0];
      return { skillId: getValidSkill('slow'), targetIds: [target.id] };
    }
  }

  // Fallback for generic enemies
  return determineBestAction(actor, characters, 'OFFENSE');
};
