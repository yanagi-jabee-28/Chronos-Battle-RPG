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
- **Pure Functions**: Logic that doesn't depend on React state (e.g., damage formulas).
- **Stateless Engines**: AI decision-making algorithms and timeline simulators.

### 4. Hooks (`/hooks`)
- **Stateful Logic**: Managing the complex state transitions of the battle.
- **Composition**: Small hooks (State, Actions, AI) are composed into a unified `useBattleSystem`.

### 5. Components (`/components`)
- **Presentation Layer**: React components focused on rendering the battle state.
- **Modularization**: Large components like `CharacterCard` are split into specialized sub-components for better performance and reusability.

## Key Design Principles

1. **Separation of Concerns**: Business logic (how damage is calculated) is separated from state management (how the UI updates) and presentation (how the health bar looks).
2. **Deterministic Engine**: The core battle logic should be predictable and testable.
3. **Reactive UI**: Using Framer Motion (motion/react) for a fluid, dynamic battle experience.
4. **Maintenance Limit**: Files should aim to be under **200 lines** to maintain readability.
