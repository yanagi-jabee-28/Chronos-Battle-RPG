import { useState, useCallback } from 'react';
import { Character, BattleState, EnemyKnowledge, BattleHistoryItem } from '@/types/battle';

export const useBattleState = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [detailedLogs, setDetailedLogs] = useState("");
  const [currentActorId, setCurrentActorId] = useState<string | null>(null);
  const [battleState, setBattleState] = useState<BattleState>('INIT');
  const [history, setHistory] = useState<BattleHistoryItem[]>([]);
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

  const addLog = useCallback((message: string) => setLogs(prev => [...prev, message]), []);
  const appendDetailedLog = useCallback((msg: string) => setDetailedLogs(prev => prev + msg + "\n"), []);

  const pushHistory = useCallback((state: BattleHistoryItem) => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(state))].slice(-10));
  }, []);

  return {
    characters, setCharacters,
    logs, setLogs, addLog,
    detailedLogs, setDetailedLogs, appendDetailedLog,
    currentActorId, setCurrentActorId,
    battleState, setBattleState,
    history, setHistory, pushHistory,
    enemyKnowledge, setEnemyKnowledge
  };
};
