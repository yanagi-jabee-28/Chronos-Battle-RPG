# Chronos Battle RPG

A high-performance, visually stunning RPG battle system built with Next.js and Framer Motion.

## 🚀 Key Features

- **CTB (Conditional Turn-Based) System**: Dynamic turn ordering based on character speed and action delay.
- **Utility-Based AI**: Intelligent automated decision-making for both enemies and allies.
- **Strategic Combat**: Status effects, elemental resistances, and unique character roles (Tank, Mage, Priest, Swordsman).
- **Time Travel Debugging**: Undo functionality and GM tools for testing complex battle scenarios.
- **Rich Visuals**: Pulsating auras, screen flashes, and fluid animations for an immersive experience.

## 🏗️ Architecture

The project follows a modular, "FSD-lite" architecture for maximum maintainability:

### Core Layers
- **`/hooks/battle`**: Modularized logic hooks (`useBattleState`, `useBattleActions`, `useBattleAI`, `useBattleLifecycle`).
- **`/lib/battle`**: Pure business logic engine (damage formulas, speed calculations).
- **`/components/battle/ui`**: Atomic UI components for reusability.
- **`/types`**: Strict TypeScript definitions for the entire game domain.

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Animation**: Framer Motion (motion/react)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## 📖 Documentation
Detailed technical documentation can be found in [ARCHITECTURE.md](./ARCHITECTURE.md).
