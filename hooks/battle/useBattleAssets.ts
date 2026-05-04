import { useState, useCallback } from 'react';
import { generateGameAssets } from '@/lib/asset-generator';
import { Character } from '@/types/battle';

export const useBattleAssets = (setCharacters: React.Dispatch<React.SetStateAction<Character[]>>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customBg, setCustomBg] = useState<string | null>(null);

  const handleGenerateAssets = useCallback(async () => {
    setIsGenerating(true);
    try {
      const assets = await generateGameAssets();
      if (assets.background) setCustomBg(assets.background);
      
      setCharacters(prev => prev.map(c => {
        let newUrl = c.imageUrl;
        if (c.id === 'p1' && assets.ars) newUrl = assets.ars;
        if (c.id === 'p2' && assets.luna) newUrl = assets.luna;
        if (c.id === 'p3' && assets.cecil) newUrl = assets.cecil;
        if (c.id === 'p4' && assets.shion) newUrl = assets.shion;
        if (c.id === 'e1' && assets.boss) newUrl = assets.boss;
        return { ...c, imageUrl: newUrl };
      }));
    } catch (e) {
      console.error('Failed to generate assets:', e);
    } finally {
      setIsGenerating(false);
    }
  }, [setCharacters]);

  return { isGenerating, customBg, handleGenerateAssets };
};
