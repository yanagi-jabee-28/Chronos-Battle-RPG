import { Sword, Shield, Zap, Heart, Skull, Clock, Activity } from 'lucide-react';

export const STATUS_EFFECTS = {
  POISON: { id: 'POISON', name: '毒', type: 'bad', duration: 3, maxStack: 3, description: '行動開始時にスタックに応じたダメージ' },
  STUN: { id: 'STUN', name: 'スタン', type: 'bad', duration: 1, maxStack: 1, description: '行動を1回スキップ' },
  PROVOKE: { id: 'PROVOKE', name: '挑発', type: 'good', duration: 2, maxStack: 1, description: '単体攻撃を自身に集中させる' },
  ATK_UP: { id: 'ATK_UP', name: '攻↑', type: 'good', duration: 3, stat: 'atk', amount: 0.3, maxStack: 3, opposite: 'ATK_DOWN' },
  DEF_UP: { id: 'DEF_UP', name: '防↑', type: 'good', duration: 3, stat: 'def', amount: 0.4, maxStack: 3, opposite: 'DEF_DOWN' },
  SPD_UP: { id: 'SPD_UP', name: '速↑', type: 'good', duration: 3, stat: 'spd', amount: 0.3, maxStack: 3, opposite: 'SPD_DOWN' },
  ATK_DOWN: { id: 'ATK_DOWN', name: '攻↓', type: 'bad', duration: 3, stat: 'atk', amount: -0.25, maxStack: 3, opposite: 'ATK_UP' },
  DEF_DOWN: { id: 'DEF_DOWN', name: '防↓', type: 'bad', duration: 3, stat: 'def', amount: -0.3, maxStack: 3, opposite: 'DEF_UP' },
  SPD_DOWN: { id: 'SPD_DOWN', name: '速↓', type: 'bad', duration: 3, stat: 'spd', amount: -0.25, maxStack: 3, opposite: 'SPD_UP' },
} as const;

export const SKILLS = {
  attack: { id: 'attack', name: '通常攻撃', type: 'damage_phys', power: 1.0, target: 'enemy_single', cost: 0, description: '敵単体に物理ダメージ' },
  power_slash: { id: 'power_slash', name: '渾身斬り', type: 'damage_phys', power: 2.5, target: 'enemy_single', cost: 15, description: '敵単体に大ダメージ' },
  armor_break: { id: 'armor_break', name: 'アーマーブレイク', type: 'damage_phys_debuff', power: 1.2, target: 'enemy_single', effect: 'DEF_DOWN', stackAmount: 1, stackLimit: 3, cost: 10, description: 'ダメージ＋防御↓(最大x3)' },
  fireball: { id: 'fireball', name: 'ファイアボール', type: 'damage_magic', power: 1.8, target: 'enemy_single', cost: 12, description: '敵単体に魔法ダメージ' },
  meteor: { id: 'meteor', name: 'メテオ', type: 'damage_magic', power: 1.0, target: 'enemy_all', cost: 30, description: '敵全体に魔法ダメージ' },
  holy: { id: 'holy', name: 'ホーリー', type: 'damage_magic', power: 1.6, target: 'enemy_single', cost: 15, description: '敵単体に光属性魔法ダメージ' },
  poison_dagger: { id: 'poison_dagger', name: 'ポイズンダガー', type: 'damage_phys_status', power: 0.8, target: 'enemy_single', effect: 'POISON', stackAmount: 1, stackLimit: 3, cost: 12, description: 'ダメージ＋毒付与(最大x3)' },
  stun_blow: { id: 'stun_blow', name: 'スタンブロウ', type: 'damage_phys_status', power: 1.0, target: 'enemy_single', effect: 'STUN', stackAmount: 1, stackLimit: 1, cost: 25, description: 'ダメージ＋スタン付与' },
  drain_dagger: { id: 'drain_dagger', name: 'ドレインダガー', type: 'damage_phys_absorb', power: 1.2, target: 'enemy_single', cost: 12, description: 'ダメージ＋自身のHP回復' },
  heal: { id: 'heal', name: 'ヒール', type: 'heal', power: 2.0, target: 'ally_single', cost: 10, description: '味方単体を回復' },
  area_heal: { id: 'area_heal', name: 'エリアヒール', type: 'heal', power: 1.0, target: 'ally_all', cost: 25, description: '味方全体を回復' },
  cure: { id: 'cure', name: 'キュア', type: 'cure', target: 'ally_single', cost: 8, description: '味方単体の状態異常解除' },
  blessing: { id: 'blessing', name: '女神の祝福', type: 'heal_cure', power: 0.8, target: 'ally_all', cost: 20, description: '全体小回復＋状態異常解除' },
  resurrect: { id: 'resurrect', name: 'リザレクション', type: 'revive', power: 0.5, target: 'ally_dead', cost: 40, description: '戦闘不能をHP50%で蘇生' },
  renki: { id: 'renki', name: '練気', type: 'special_mp', target: 'ally_single', cost: 0, description: '最大HPの15%を消費し、MPを40回復' },
  focus: { id: 'focus', name: '精神統一', type: 'heal_mp', power: 0.5, target: 'ally_single', effect: 'DEF_DOWN', stackAmount: 1, stackLimit: 3, cost: 0, description: 'MP50%回復＋無防備になる(防御↓)' },
  prayer: { id: 'prayer', name: '祈り', type: 'heal_mp', power: 0.4, target: 'ally_single', cost: 0, postWaitMultiplier: 1.5, description: 'MP40%回復＋行動後の隙(Wait)が長い' },
  mana_steal: { id: 'mana_steal', name: 'マナスティール', type: 'damage_phys_absorb_mp', power: 0.6, target: 'enemy_single', cost: 0, description: '敵に物理ダメージ＋MPを奪う' },
  warcry: { id: 'warcry', name: 'ウォークライ', type: 'buff', target: 'ally_all', effect: 'ATK_UP', stackAmount: 1, stackLimit: 2, cost: 15, description: '味方全体の攻撃↑(最大x2)' },
  protect: { id: 'protect', name: 'プロテクト', type: 'buff', target: 'ally_single', effect: 'DEF_UP', stackAmount: 1, stackLimit: 3, cost: 10, description: '味方単体の防御↑(最大x3)' },
  haste: { id: 'haste', name: 'ヘイスト', type: 'buff', target: 'ally_single', effect: 'SPD_UP', stackAmount: 1, stackLimit: 2, cost: 15, description: '味方単体の速度↑(最大x2)' },
  slow: { id: 'slow', name: 'スロウ', type: 'debuff', target: 'enemy_single', effect: 'SPD_DOWN', stackAmount: 1, stackLimit: 3, cost: 8, description: '敵単体の速度↓(最大x3)' },
  smoke_bomb: { id: 'smoke_bomb', name: '煙玉', type: 'debuff', target: 'enemy_all', effect: 'ATK_DOWN', stackAmount: 1, stackLimit: 1, cost: 15, description: '敵全体の攻撃↓(これのみではx1まで)' },
  demon_slash: { id: 'demon_slash', name: '魔将の薙ぎ払い', type: 'damage_phys', power: 1.3, target: 'enemy_all', cost: 20, description: '全体ダメージ' },
  intimidate: { id: 'intimidate', name: '威圧', type: 'debuff', target: 'enemy_all', effect: 'ATK_DOWN', stackAmount: 1, stackLimit: 2, cost: 12, description: '全体攻撃↓(最大x2)' },
  guard_stance: { id: 'guard_stance', name: '防御陣形', type: 'buff', target: 'ally_all', effect: 'DEF_UP', stackAmount: 1, stackLimit: 2, cost: 15, description: '全体防御↑(最大x2)' },
  dark_heal: { id: 'dark_heal', name: 'ダークヒール', type: 'heal', power: 2.0, target: 'ally_single', cost: 25, description: '単体中回復' },
  curse: { id: 'curse', name: '呪詛', type: 'status', target: 'enemy_single', effect: 'POISON', stackAmount: 1, stackLimit: 3, cost: 10, description: '毒付与' },
  clear: { id: 'clear', name: '浄化', type: 'cure', target: 'ally_single', cost: 10, description: '味方の状態異常解除' },
  provoke: { id: 'provoke', name: '忠義の盾', type: 'buff', target: 'ally_single', effect: 'PROVOKE', stackAmount: 1, stackLimit: 1, cost: 8, description: '自身に単体攻撃を集中させる' },
  boss_aura: { id: 'boss_aura', name: '魔将の覇気', type: 'cure_buff', target: 'ally_single', effect: 'ATK_UP', stackAmount: 2, stackLimit: 3, cost: 40, description: '自身のデバフ全解除＋攻撃↑x2' },
} as const;

export const DEFAULT_DEBUG_FLAGS = { isFrozen: false, isInvincible: false, isInfiniteMp: false };

export const INITIAL_CHARACTERS = [
  { id: 'p1', name: '剣士アルス', isEnemy: false, hp: 120, maxHp: 120, mp: 50, maxMp: 50, atk: 30, def: 20, spd: 25, skills: ['attack', 'power_slash', 'armor_break', 'warcry', 'renki'], effects: [], resistances: [], wait: 0, isDead: false, debug: { ...DEFAULT_DEBUG_FLAGS }, imageUrl: 'https://picsum.photos/seed/fantasy-swordsman-ars/400/600' },
  { id: 'p2', name: '魔術師ルナ', isEnemy: false, hp: 80, maxHp: 80, mp: 100, maxMp: 100, atk: 40, def: 12, spd: 22, skills: ['attack', 'fireball', 'meteor', 'slow', 'focus'], effects: [], resistances: [], wait: 0, isDead: false, debug: { ...DEFAULT_DEBUG_FLAGS }, imageUrl: 'https://picsum.photos/seed/fantasy-mage-luna/400/600' },
  { id: 'p3', name: '神官セシル', isEnemy: false, hp: 90, maxHp: 90, mp: 80, maxMp: 80, atk: 25, def: 18, spd: 20, skills: ['attack', 'holy', 'heal', 'area_heal', 'cure', 'blessing', 'protect', 'resurrect', 'prayer'], effects: [], resistances: [], wait: 0, isDead: false, debug: { ...DEFAULT_DEBUG_FLAGS }, imageUrl: 'https://picsum.photos/seed/fantasy-priest-cecil/400/600' },
  { id: 'p4', name: '盗賊シオン', isEnemy: false, hp: 100, maxHp: 100, mp: 60, maxMp: 60, atk: 22, def: 15, spd: 35, skills: ['attack', 'poison_dagger', 'drain_dagger', 'stun_blow', 'haste', 'smoke_bomb', 'mana_steal'], effects: [], resistances: [], wait: 0, isDead: false, debug: { ...DEFAULT_DEBUG_FLAGS }, imageUrl: 'https://picsum.photos/seed/fantasy-thief-shion/400/600' },
  { id: 'e1', name: '魔将軍', isEnemy: true, hp: 800, maxHp: 800, mp: 300, maxMp: 300, atk: 36, def: 30, spd: 28, skills: ['attack', 'demon_slash', 'intimidate', 'boss_aura'], effects: [], resistances: ['STUN'], wait: 0, isDead: false, debug: { ...DEFAULT_DEBUG_FLAGS }, imageUrl: 'https://picsum.photos/seed/dark-knight-boss/600/800' },
  { id: 'e2', name: '重装兵', isEnemy: true, hp: 250, maxHp: 250, mp: 100, maxMp: 100, atk: 20, def: 40, spd: 12, skills: ['attack', 'guard_stance', 'dark_heal', 'provoke'], effects: [], resistances: [], wait: 0, isDead: false, debug: { ...DEFAULT_DEBUG_FLAGS }, imageUrl: 'https://picsum.photos/seed/armored-soldier/400/600' },
  { id: 'e3', name: '妖術師', isEnemy: true, hp: 150, maxHp: 150, mp: 180, maxMp: 180, atk: 26, def: 15, spd: 25, skills: ['attack', 'curse', 'clear', 'slow'], effects: [], resistances: [], wait: 0, isDead: false, debug: { ...DEFAULT_DEBUG_FLAGS }, imageUrl: 'https://picsum.photos/seed/dark-mage/400/600' },
];

export const BASE_WAIT_TIME = 1000;
export const BG_IMAGE = 'https://picsum.photos/seed/dark-fantasy-battlefield/1920/1080';
