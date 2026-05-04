# Chronos Battle RPG

A high-performance, visually stunning RPG battle system built with Next.js and Framer Motion.

## 🚀 Key Features

- **CTB (Conditional Turn-Based) System**: Dynamic turn ordering based on character speed and action delay, with full timeline visualization.
- **Advanced Utility-Based AI**: Intelligent automated decision-making for both enemies and allies, including threat analysis and action prediction.
- **Enemy Knowledge System**: Import/Export enemy behavior patterns to optimize AI decision-making.
- **Strategic Combat**: Status effects, elemental resistances, and unique character roles (Tank, Mage, Priest, Swordsman).
- **Phase Transitions**: Dynamic boss AI that triggers phase-specific visual effects and skill sets (e.g., Demon General's Frenzy mode).
- **Time Travel Debugging**: Robust Undo functionality and GM tools for testing complex battle scenarios.
- **Rich Visuals**: Pulsating auras, screen flashes, and fluid Framer Motion animations.

## 🏗️ Architecture

The project follows a modular "FSD-lite" architecture, separating pure logic from stateful React code:

### Core Layers
- **`/hooks/battle`**: Specialized state hooks (`useBattleState`, `useBattleActions`, `useBattleAI`, `useBattleLifecycle`, `useBattleAssets`).
- **`/lib/battle`**: The deterministic `engine.ts` handling damage formulas, speed calculations, and timeline simulations.
- **`/components/battle/ui`**: Highly reusable atomic UI components (Bars, Badges, CharacterCards).
- **`/types`**: Strict TypeScript domain models ensuring zero `any` usage in the core engine.

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Animation**: Framer Motion (motion/react)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## 📖 Documentation
Detailed technical documentation can be found in [ARCHITECTURE.md](./ARCHITECTURE.md).
