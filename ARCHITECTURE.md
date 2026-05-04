# Chronos Battle RPG - Architecture & Technical Design

This document describes the architectural structure and design principles of the Chronos Battle RPG project.

## Directory Structure (Refined)

The project follows a modular structure inspired by Feature-Sliced Design (FSD), optimized for a focused RPG battle system.

```text
/app               # Next.js App Router (Pages & Layouts)
/components        # UI Components
  /battle          # Battle-specific components
    /ui            # Small UI pieces (Bars, Badges, etc.)
/constants         # Static data (Game stats, Skills, Status Effects)
/hooks             # Custom Hooks
  /battle          # Modular battle logic hooks
/lib               # Pure utility functions and core engines
  /battle          # Damage calculation, speed logic, AI utilities
/types             # TypeScript type definitions
```

## Layer Responsibilities

### 1. Types (`/types`)
- **Single Source of Truth**: All domain models (Character, Skill, BattleState) are strictly defined here.
- **Zero `any`**: Avoid using `any` to ensure type safety across the engine.

### 2. Constants (`/constants`)
- **Static Game Data**: Definition of characters, skills, and status effects.
- **UI Constants**: Colors, animations, and image URLs.

### 3. Lib (`/lib`)
- **Pure Functions**: Logic that doesn't depend on React state or browser APIs.
- **Deterministic Engine**: `engine.ts` centralizes damage formulas, status effect logic, and speed-based wait time calculations.
- **AI Algorithms**: Stateless threat analysis and decision-making logic.

### 4. Hooks (`/hooks`)
- **Modular State Management**: Complex battle logic is decomposed into:
    - `useBattleState`: Low-level state and logs.
    - `useBattleActions`: Pure state transitions (Damage, Buffs).
    - `useBattleAI`: Utility-based decision logic.
    - `useBattleLifecycle`: Turn progression and initialization.
    - `useBattleAssets`: Dynamic asset management and image generation.
- **Orchestration**: The main `useBattleSystem` hook orchestrates these specialized hooks into a unified API.

### 5. Components (`/components`)
- **Presentation Layer**: React components focused on rendering the battle state with Framer Motion.
- **Performance**: Large components are split into specialized sub-components (e.g., `CharacterCard` -> `HealthBar`, `StatusIcons`) to minimize unnecessary re-renders.

## Key Design Principles

1. **Separation of Concerns**: Business logic is separated from state management and presentation.
2. **Deterministic Engine**: The core battle logic is predictable, enabling features like Time Travel (Undo).
3. **Maintenance Limit**: To ensure extreme maintainability, all files MUST aim to be under **200 lines**. If a file exceeds this, it should be refactored into smaller, focused modules.
4. **Traceability**: The `APP_LAST_UPDATED` constant in `constants/game-data.ts` must be updated manually with every major architectural change to provide clear versioning in the UI.
