import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    aiInstance = new GoogleGenAI(apiKey);
  }
  return aiInstance;
}

export async function generateGameAssets() {
  const ai = getAi();
  if (!ai) {
    throw new Error("API key should be set when using the Gemini API.");
  }
  const prompts = [
    { name: 'ars', prompt: 'Anime style character illustration of a heroic male swordsman named Ars, wearing blue and silver plate armor, holding a glowing steel sword, determined expression, white background, high quality, fantasy RPG art.' },
    { name: 'luna', prompt: 'Anime style character illustration of a beautiful female mage named Luna, wearing purple robes with gold trim, holding a crystal staff, casting a small purple flame, white background, high quality, fantasy RPG art.' },
    { name: 'cecil', prompt: 'Anime style character illustration of a gentle female priest named Cecil, wearing white and gold clerical robes, holding a holy scepter, soft glowing aura, white background, high quality, fantasy RPG art.' },
    { name: 'shion', prompt: 'Anime style character illustration of a cool male thief named Shion, wearing dark leather armor and a green scarf, holding twin daggers, agile pose, white background, high quality, fantasy RPG art.' },
    { name: 'boss', prompt: 'Anime style character illustration of a menacing Demon General, massive dark obsidian armor, glowing red eyes, holding a giant jagged greatsword, dark aura, white background, high quality, fantasy RPG art.' },
    { name: 'background', prompt: 'Epic fantasy background illustration of a dark throne room for a final boss battle, crumbling stone pillars, purple magical flames, dramatic lighting, high quality, cinematic RPG environment.' }
  ];

  const results: any = {};

  for (const item of prompts) {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: item.prompt }] },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0 || !candidates[0].content) continue;

    const parts = candidates[0].content.parts;
    if (!parts) continue;

    for (const part of parts) {
      if (part.inlineData) {
        results[item.name] = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }

  return results;
}
