import { SKILLS, STATUS_EFFECTS } from '@/constants/game-data';

export type TacticType = 'MANUAL' | 'OFFENSE' | 'CONSERVE_MP' | 'NO_MP' | 'SURVIVAL';

// 行動候補の型
export interface ActionCandidate {
  skillId: string;
  targetIds: string[];
  score: number;
}

/**
 * 実行可能な全行動候補を生成し、作戦に応じたスコアをつけて最適なものを返す
 */
export function determineBestAction(
  actor: any,
  characters: any[],
  tactic: TacticType
): Omit<ActionCandidate, 'score'> {
  const aliveAllies = characters.filter(c => c.isEnemy === actor.isEnemy && !c.isDead);
  const aliveEnemies = characters.filter(c => c.isEnemy !== actor.isEnemy && !c.isDead);
  const candidates: ActionCandidate[] = [];

  // 全所持スキルに対して評価を行う
  actor.skills.forEach((skillId: string) => {
    const skill = (SKILLS as any)[skillId];
    
    // MP不足などの実行不可スキルは除外
    if (actor.mp < skill.cost && !actor.debug?.isInfiniteMp) return;

    // ターゲットの候補を生成
    let targetGroups: string[][] = [];
    if (skill.target.includes('single')) {
      const targetList = skill.target.includes('enemy') ? aliveEnemies : aliveAllies;
      targetList.forEach(t => targetGroups.push([t.id]));
    } else if (skill.target.includes('all')) {
      const targetList = skill.target.includes('enemy') ? aliveEnemies : aliveAllies;
      targetGroups.push(targetList.map(t => t.id));
    } else {
      // 自身対象など ('focus', 'renki' 等)
      targetGroups.push([actor.id]);
    }

    // 各ターゲットグループに対するスコアを計算
    targetGroups.forEach(targetIds => {
      const score = evaluateActionScore(actor, skill, targetIds, characters, tactic);
      candidates.push({ skillId, targetIds, score });
    });
  });

  // スコアが最も高い行動を選択（同点の場合はランダム性を持たせる等の調整も可能）
  candidates.sort((a, b) => b.score - a.score);
  
  // デバッグログ
  console.log(`\n=== AI THINKING: ${actor.name} (${tactic}) ===`);
  candidates.slice(0, 5).forEach((c, idx) => {
    const targetNames = c.targetIds.map(id => characters.find(char => char.id === id)?.name).join(', ');
    console.log(`  ${idx + 1}. [${c.skillId}] -> ${targetNames} : ${Math.floor(c.score)} pts`);
  });
  
  // 候補がない場合はデフォルトの通常攻撃
  if (candidates.length === 0) {
    console.log(`  -> No candidates found, using default attack.`);
    return { skillId: 'attack', targetIds: [aliveEnemies[0]?.id || aliveAllies[0]?.id] };
  }

  console.log(`  => SELECTED: [${candidates[0].skillId}] -> ${candidates[0].targetIds.join(', ')}\n`);
  return { skillId: candidates[0].skillId, targetIds: candidates[0].targetIds };
}

/**
 * 盤面状態と作戦に基づくヒューリスティック評価関数
 */
function evaluateActionScore(
  actor: any,
  skill: any,
  targetIds: string[],
  characters: any[],
  tactic: TacticType
): number {
  let score = 0;
  const targets = targetIds.map(id => characters.find(c => c.id === id)).filter(Boolean);

  switch (tactic) {
    case 'SURVIVAL':
      score = evaluateSurvivalTactic(actor, skill, targets, characters);
      break;
    case 'OFFENSE':
      // 将来実装: ダメージ効率や敵の撃破を最優先するロジック
      // 簡易的なダメージ計算を導入
      score = evaluateOffenseTactic(actor, skill, targets);
      break;
    case 'CONSERVE_MP':
      // 将来実装: MP対ダメージ効率を重視し、強力な魔法を温存するロジック
      if (skill.cost > actor.maxMp * 0.2) score -= 1000;
      else score = evaluateOffenseTactic(actor, skill, targets);
      break;
    case 'NO_MP':
      if (skill.cost > 0) return -9999;
      score = skill.power * 10;
      break;
    default:
      score = 0;
  }

  return score + (Math.random() * 5); // 同一スコア時の揺らぎ
}

function evaluateOffenseTactic(actor: any, skill: any, targets: any[]): number {
  let score = 0;
  if (skill.type.includes('damage')) {
    targets.forEach(t => {
      score += (skill.power * 100);
      const estimatedDamage = actor.atk * skill.power - t.def * 0.5;
      if (t.hp - estimatedDamage <= 0) {
        score += 1500; // 撃破ボーナス
      }
    });
  } else if (skill.type.includes('buff') && skill.effect === 'ATK_UP') {
      score += 300 * targets.length;
  } else if (skill.type.includes('debuff') && skill.effect === 'DEF_DOWN') {
      score += 400 * targets.length;
  }
  return score;
}

/**
 * [生存優先] 作戦の評価ロジック
 * 命を繋ぐこと、防御を固めることを最優先し、余力がある時のみ攻撃に転じる。
 */
function evaluateSurvivalTactic(actor: any, skill: any, targets: any[], characters: any[]): number {
  let score = 0;

  // 1. 蘇生 (厳密なチェックを追加)
  if (skill.type === 'revive') {
    if (targets.every(t => !t.isDead)) return -9999; // 誰も死んでいなければ選択肢から除外
    score += 10000;
  }

  // 2. ボスの超強化に対する絶対カウンター (神官セシル・魔術師ルナ)
  if (skill.id === 'holy' || skill.id === 'dispel') {
    targets.forEach(t => {
      const hasStrongBuff = t.effects.some((e: any) => e.id === 'ATK_UP' || e.id === 'DEF_UP');
      if (hasStrongBuff) score += 9000; 
    });
  }

  // 3. 手遅れになる前の安全な回復 (神官セシル)
  if (skill.type === 'heal' || skill.type === 'area_heal') {
    targets.forEach(t => {
      const hpRatio = t.hp / t.maxHp;
      if (hpRatio < 0.2) score += 10000;
      else if (hpRatio <= 0.5) score += 6000; 
      else score -= 2000; // 過剰回復はしない
    });
  }

  // 4. 状態異常回復の評価
  if (skill.type.includes('cure') && !skill.type.includes('cure_enemy')) {
    targets.forEach(t => {
      const hasBadStatus = t.effects.some((e: any) => (STATUS_EFFECTS as any)[e.id]?.type === 'bad');
      if (hasBadStatus) score += 2500;
    });
  }
  
  // 敵へのキュア (ディスペル)
  if (skill.type.includes('cure_enemy')) {
    targets.forEach(t => {
      const hasGoodStatus = t.effects.some((e: any) => (STATUS_EFFECTS as any)[e.id]?.type === 'good');
      if (hasGoodStatus) score += 2500;
    });
  }

  // 5. 防御系・速度系バフの評価 (維持コストを考慮)
  if (skill.effect === 'DEF_UP' || skill.effect === 'SPD_UP' || skill.effect === 'ATK_UP') {
    targets.forEach(t => {
      const effect = t.effects.find((e: any) => e.id === skill.effect);
      if (!effect) {
        score += 1500; // 未付与なら高評価
      } else if (effect.duration === 1) {
        score += 800;  // 次で切れるなら更新を検討
      } else {
        score -= 500;  // 維持されているなら優先度を下げる
      }
    });
  }
  
  // 6. 敵へのデバフ (攻撃力ダウンやスタン) ＆ 無駄撃ち防止
  if (skill.type === 'debuff' || skill.type === 'damage_phys_debuff') {
    targets.forEach(t => {
      const existingDebuff = t.effects.find((e: any) => e.id === skill.effect);
      if (existingDebuff && existingDebuff.stacks >= (skill.stackLimit || 3)) {
        score -= 5000; // すでに限界まで下げているなら絶対に使わない
      }
    });
  }

  if (skill.effect === 'ATK_DOWN' || skill.effect === 'STUN' || skill.effect === 'SPD_DOWN' || skill.effect === 'DEF_DOWN') {
    targets.forEach(t => {
      const effect = t.effects.find((e: any) => e.id === skill.effect);
      if (!effect) {
        score += 2000;
      } else if (effect.duration === 1) {
        score += 800;
      } else {
        score -= 500;
      }
    });
  }

  // 7. MP管理 (MPが枯渇しそうな時に優先しつつ、無駄撃ちを防ぐ)
  if (skill.cost > 0) {
    const mpRatio = actor.mp / actor.maxMp;
    if (mpRatio < 0.2) score -= 2000; // MPが2割を切ったら通常スキル使用を控える
  }
  
  if (skill.type.includes('heal_mp') || skill.id === 'renki') {
    const targetMpRatio = targets[0]?.mp / targets[0]?.maxMp;
    if (targetMpRatio < 0.2) score += 4000;
    else if (targetMpRatio < 0.5) score += 1000;
    else score -= 2000; // 無駄な回復を抑制
  }

  // 8. 爽快コンボ：デバフ状態の敵を徹底的に狙い撃つ（剣士アルス・魔術師ルナ）
  if (skill.type.includes('damage')) {
    let baseDamageScore = skill.power * 500;
    
    targets.forEach(t => {
      // アーマーブレイク（防御DOWN）が入っている敵には大技のスコアを激増させる
      if (t.effects.some((e: any) => e.id === 'DEF_DOWN') && skill.power >= 2.0) {
        baseDamageScore += 3000; // コンボボーナス！
      }
      // スロウ（速度DOWN）やスタンが入っている敵は後回しにし、動ける敵を優先する
      if (t.effects.some((e: any) => e.id === 'STUN')) {
        baseDamageScore -= 1000; 
      }
      
      const estimatedDamage = actor.atk * skill.power - t.def * 0.5; // 簡易計算
      if (t.hp - estimatedDamage <= 0) {
        baseDamageScore += 1500;
      }
    });
    
    if (skill.target.includes('all')) score += baseDamageScore * targets.filter(t => !t.isDead).length * 0.8;
    else score += baseDamageScore;
    
    // 吸収攻撃は評価アップ
    if (skill.type.includes('absorb')) score += 1000;
  }

  return score;
}
