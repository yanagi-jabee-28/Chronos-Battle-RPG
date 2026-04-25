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

  // スコアが最も高い行動を選択
  candidates.sort((a, b) => b.score - a.score);
  
  // デバッグログ
  console.log(`\n=== AI THINKING: ${actor.name} (${tactic}) ===`);
  candidates.slice(0, 5).forEach((c, idx) => {
    const targetNames = c.targetIds.map(id => characters.find(char => char.id === id)?.name).join(', ');
    console.log(`  ${idx + 1}. [${c.skillId}] -> ${targetNames} : ${Math.floor(c.score)} pts`);
  });
  
  // 候補がない場合はデフォルトの通常攻撃
  if (candidates.length === 0 || candidates[0].score < -5000) {
    console.log(`  -> No valid candidates found, using default attack.`);
    return { skillId: 'attack', targetIds: [aliveEnemies[0]?.id || aliveAllies[0]?.id] };
  }

  console.log(`  => SELECTED: [${candidates[0].skillId}] -> ${candidates[0].targetIds.join(', ')}\n`);
  return { skillId: candidates[0].skillId, targetIds: candidates[0].targetIds };
}

/**
 * 盤面状態と作戦に基づく統合ヒューリスティック評価関数
 * 1ダメージ = 約10pts の基準点として正規化
 */
function evaluateActionScore(
  actor: any,
  skill: any,
  targetIds: string[],
  characters: any[],
  tactic: TacticType
): number {
  if (actor.mp < skill.cost && !actor.debug?.isInfiniteMp) return -9999;
  
  const targets = targetIds.map(id => characters.find(c => c.id === id)).filter(Boolean);
  if (targets.length === 0) return -9999;

  let baseScore = 0;
  
  targets.forEach(t => {
    // ----------------------------------------------------
    // 1. 基本となるダメージスコア (攻撃の正規化)
    // ----------------------------------------------------
    if (skill.type.includes('damage') && !t.isDead) {
      const isMagic = skill.type.includes('magic');
      const defMultiplier = isMagic ? 0.3 : 0.5;
      const expectedDamage = Math.max(1, (actor.atk * skill.power) - (t.def * defMultiplier));
      
      let damageScore = expectedDamage * 10;
      
      // 撃破ボーナス (1確なら破格の点数)
      if (t.hp - expectedDamage <= 0) {
        damageScore += 2000;
      }
      
      // デバフ状態の敵を狙うボーナス (アーマーブレイク等とのシナジー)
      if (t.effects.some((e: any) => e.id === 'DEF_DOWN')) {
        damageScore *= 1.5;
      }
      // スタン中の敵は後回し
      if (t.effects.some((e: any) => e.id === 'STUN')) {
        damageScore *= 0.7;
      }
      
      // 吸収効果
      if (skill.type.includes('absorb') && !skill.type.includes('absorb_mp')) {
        const hpRatio = actor.hp / actor.maxHp;
        if (hpRatio < 0.5) damageScore += (expectedDamage * 0.5) * 10 * 2; // 自分自身の回復価値を加算
      }
      
      if (skill.type.includes('absorb_mp')) {
        const mpRatio = actor.mp / actor.maxMp;
        if (mpRatio < 0.5) damageScore += 1000;
      }
      
      baseScore += damageScore;
    }

    // ----------------------------------------------------
    // 2. 欠損に基づく需要評価 (回復・生存の最適化)
    // ----------------------------------------------------
    if (skill.type.includes('heal') && !skill.type.includes('heal_mp')) {
      if (t.isDead) {
        baseScore -= 9999;
      } else {
        const hpRatio = t.hp / t.maxHp;
        if (hpRatio >= 0.95) {
          baseScore -= 5000; // ほぼ無傷への回復は弾く
        } else {
          // 実質回復量
          const expectedHeal = actor.atk * (skill.power || 1.0);
          const actualHeal = Math.min(expectedHeal, t.maxHp - t.hp);
          
          // 欠損割合に応じた指数関数的な評価 (1 - hpRatio)^2 * 倍率
          const urgencyMultiplier = Math.pow((1 - hpRatio) * 2, 2) + 1; 
          baseScore += (actualHeal * 10) * urgencyMultiplier;
          
          // 瀕死(30%未満)なら緊急ボーナス
          if (hpRatio < 0.3) baseScore += 2000;
        }
      }
    }

    if (skill.type.includes('heal_mp')) {
      if (t.isDead) {
        baseScore -= 9999;
      } else {
        const mpRatio = t.maxMp > 0 ? t.mp / t.maxMp : 1;
        if (mpRatio >= 0.8) {
          baseScore -= 3000; // MPが十分ある場合は評価を下げる
        } else {
          const urgencyMultiplier = Math.pow((1 - mpRatio) * 2, 2);
          baseScore += 1000 * urgencyMultiplier;
        }
      }
    }

    // ----------------------------------------------------
    // 3. 限界効用の逓減 (状態異常・強化の重複排除)
    // ----------------------------------------------------
    if (!t.isDead && (skill.effect || skill.bonusEffect)) {
      const effectsToApply = [skill.effect, skill.bonusEffect].filter(Boolean);
      
      effectsToApply.forEach(eff => {
        const effectDef = (STATUS_EFFECTS as any)[eff];
        if (!effectDef) return;

        const isGood = effectDef.type === 'good';
        const existingEffect = t.effects.find((e: any) => e.id === eff);
        const stackLimit = skill.stackLimit || effectDef.maxStack || 1;

        if (existingEffect && existingEffect.stacks >= stackLimit) {
          // すでに上限までかかっている場合は無価値
          baseScore -= 8000;
        } else if (existingEffect) {
          // かかっているが上限ではない場合は価値を激減させる
          baseScore += 300; 
        } else {
          // 新規付与の価値
          // バフ・デバフのベース価値をダメージ100〜150相当 (1000〜1500pts) とする
          baseScore += 1200;
          
          // 特定の状況下でのシナジーボーナス
          if (eff === 'ATK_UP' || eff === 'DEF_UP') {
            // ボス戦などで影響が大きい
            if (characters.some(c => c.id === 'e1')) baseScore += 800;
          }
          if (eff === 'DEF_DOWN') {
             // 物理アタッカーが多い場合価値が上がる
             baseScore += 500;
          }
        }
      });
    }

    // 単純な状態異常付与 (毒など、effect指定ではなくスキル自体がstatusの場合)
    if (skill.type === 'status' && skill.effect) {
        // 同上だが、基本スコアを加算
        const existingEffect = t.effects.find((e: any) => e.id === skill.effect);
        if(!existingEffect) baseScore += 800;
    }

    // ----------------------------------------------------
    // 4. キュア (状態異常回復)・ディスペルの需要評価
    // ----------------------------------------------------
    if (skill.type.includes('cure') && !skill.type.includes('cure_enemy')) {
      if (t.isDead) {
        baseScore -= 9999;
      } else {
        const badEffects = t.effects.filter((e: any) => (STATUS_EFFECTS as any)[e.id]?.type === 'bad');
        if (badEffects.length === 0) {
          baseScore -= 5000; // 直すものがない
        } else {
          baseScore += badEffects.length * 1500; // 異常1つにつき150ダメージ相当の価値
          if (badEffects.some((e: any) => e.id === 'STUN' || e.id === 'DEF_DOWN')) {
            baseScore += 1000; // 重大な異常は優先度UP
          }
        }
      }
    }
    
    if (skill.type.includes('cure_enemy')) {
      if (t.isDead) {
        baseScore -= 9999;
      } else {
        const goodEffects = t.effects.filter((e: any) => (STATUS_EFFECTS as any)[e.id]?.type === 'good');
        if (goodEffects.length === 0) {
          baseScore -= 5000; // 剥がすものがない
        } else {
          baseScore += goodEffects.length * 1500;
          if (goodEffects.some((e: any) => e.id === 'ATK_UP' || e.id === 'DEF_UP')) {
            baseScore += 2000; // 危険なバフは最優先で剥がす
          }
        }
      }
    }

    // ----------------------------------------------------
    // 5. 蘇生 (Revive) の絶対的価値
    // ----------------------------------------------------
    if (skill.type === 'revive') {
      if (!t.isDead) {
        baseScore -= 9999; // 生きている相手には無効
      } else {
        baseScore += 15000; // 蘇生は最優先クラス (1500ダメージ相当)
      }
    } else if (t.isDead) {
      baseScore -= 9999; // 蘇生以外のスキルを死者に使わない
    }
  });

  // ----------------------------------------------------
  // 6. 役割 (Tactic) と MP残量に基づく最終調整
  // ----------------------------------------------------
  const myMpRatio = actor.maxMp > 0 ? actor.mp / actor.maxMp : 1;
  let finalScore = baseScore;

  switch (tactic) {
    case 'OFFENSE':
      if (skill.type.includes('damage')) {
        finalScore *= 1.3; // アタッカーはダメージの価値を高く見積もる
      }
      if (skill.id === 'attack') finalScore += 200; // MP消費なし攻撃への基礎加点
      break;

    case 'SURVIVAL':
      if (skill.type.includes('heal') || skill.type.includes('cure') || skill.effect === 'DEF_UP') {
        finalScore *= 1.3; // ヒーラーは回復・防御の価値を高く見積もる
      }
      break;

    case 'CONSERVE_MP':
      if (skill.cost > 0) {
        // MPが減るほど、MP消費スキルの評価が指数関数的に下がる
        const mpPenaltyMultiplier = Math.max(0.1, myMpRatio); // MP10%ならスコア10%に
        finalScore *= mpPenaltyMultiplier;
        
        // MPが30%を切ったら消費スキルに絶対的なマイナス補正
        if (myMpRatio < 0.3) {
            finalScore -= (skill.cost * 100);
        }
      } else if (skill.type === 'attack' || skill.id === 'focus' || skill.id === 'prayer') {
        // MPが少ないほど、通常攻撃やMP回復の価値が上がる
        finalScore += 1000 * Math.pow(1.0 - myMpRatio, 2);
      }
      break;

    case 'NO_MP':
      if (skill.cost > 0) return -9999;
      break;
  }

  // 最終的な揺らぎ (同スコア時のランダム性)
  return finalScore + (Math.random() * 10);
}
