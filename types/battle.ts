export type EffectType = 'good' | 'bad';

export interface StatusEffectDefinition {
  id: string;
  name: string;
  type: EffectType;
  duration: number;
  maxStack: number;
  description?: string;
  stat?: 'atk' | 'def' | 'spd';
  amount?: number;
  opposite?: string;
}

export interface ActiveEffect {
  id: string;
  duration: number;
  stacks: number;
}

export type SkillType = 
  | 'damage_phys' 
  | 'damage_phys_debuff' 
  | 'damage_phys_status' 
  | 'damage_phys_absorb'
  | 'damage_phys_absorb_mp'
  | 'damage_magic' 
  | 'heal' 
  | 'heal_mp'
  | 'heal_cure'
  | 'cure' 
  | 'cure_buff'
  | 'cure_enemy'
  | 'revive' 
  | 'buff' 
  | 'debuff' 
  | 'status'
  | 'special_mp';

export type TargetType = 
  | 'enemy_single' 
  | 'enemy_all' 
  | 'ally_single' 
  | 'ally_all' 
  | 'ally_dead' 
  | 'self';

export interface SkillDefinition {
  id: string;
  name: string;
  type: SkillType;
  power?: number;
  target: TargetType;
  cost: number;
  description: string;
  effect?: string;
  bonusEffect?: string;
  stackAmount?: number;
  stackLimit?: number;
  postWaitMultiplier?: number;
}

export interface DebugFlags {
  isFrozen: boolean;
  isInvincible: boolean;
  isInfiniteMp: boolean;
  isOneHitKill?: boolean;
}

export type TacticType = 'MANUAL' | 'OFFENSE' | 'DEFENSE' | 'SURVIVAL' | 'CONSERVE_MP' | 'NO_MP';

export interface Character {
  id: string;
  name: string;
  isEnemy: boolean;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  skills: string[];
  effects: ActiveEffect[];
  resistances: string[];
  wait: number;
  isDead: boolean;
  debug: DebugFlags;
  tactic: TacticType;
  imageUrl?: string;
  frenzyMode?: boolean;
  _nextWaitMultiplier?: number;
}

export type BattleState = 
  | 'INIT' 
  | 'CALCULATING' 
  | 'PROCESSING_TURN' 
  | 'WAITING_INPUT' 
  | 'AI_THINKING' 
  | 'EXECUTING' 
  | 'END';

export interface EnemyKnowledge {
  resistedEffects: string[];
  weaknesses: string[];
  favoriteSkills?: string[];
  actionHistory?: string[];
}

export interface FutureState {
  turn: number;
  actor: Character;
  predictedAction?: string;
  tacticalThreat: number;
}

export interface BattleHistoryItem {
  characters: Character[];
  logs: string[];
  detailedLogs: string;
  currentActorId: string | null;
  battleState: BattleState;
}
