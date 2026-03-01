______________________________________________________________________

## applyTo: "\*\*/\*.{ts,tsx}"

# TypeScript/React Style Guide

## File Organization

### Size Limits

- **Max 300 lines per component**, **max 40 lines per component function**
- Split into: sub-components, custom hooks, utility functions

### Naming & Structure

- **One component per file** (exceptions: tightly coupled sub-components, local types)
- Components: PascalCase (`TrailCard.tsx`), Hooks: `use` prefix (`useTrailQuery.ts`), Utils: camelCase
- File name must match component name

## Component Conventions

### Function Components Only

- Arrow function syntax for shared components
- `export default function` for framework route screens (e.g., file-based routing)

```tsx
// Shared component — named arrow export
export const TrailCard = ({ trail, onPress }: TrailCardProps) => { ... };

// Route screen — default function export
export default function TrailDetailScreen() { ... }
```

### Component Structure Order

1. Type definitions (props interface)
1. Hooks (`useState`, `useEffect`, custom hooks)
1. Event handlers (`handle` prefix)
1. Derived/computed values
1. Early returns (loading, error)
1. Main JSX return

```tsx
interface TrailCardProps {
  trail: Trail;
  onPress: (id: string) => void;
}

export const TrailCard = ({ trail, onPress }: TrailCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: details } = useTrailDetails(trail.id);

  const handlePress = () => onPress(trail.id);
  const totalDistance = trail.segments.reduce((sum, s) => sum + s.length, 0);

  return <View>{/* ... */}</View>;
};
```

### Import Grouping

Group: React → framework → third-party → project (`@/`), with `type` imports separate.

## TypeScript

- `interface` for props (suffix `Props`), `type` for unions/aliases
- Import types with `type` keyword
- Required type hints on all function signatures (parameters and return types)
- Use modern syntax: `string[]` not `Array<string>`

## State Management

- `useState` for local UI state
- React Query (`useQuery`, `useMutation`) for server state — never mix in `useState`
- Extract hooks to `lib/hooks/` when logic >20 lines or reused in 2+ components

### Custom Hook Pattern

```tsx
export const useTrailFilter = (initialSource?: TrailSource) => {
  const [source, setSource] = useState(initialSource ?? "planned_hikes");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const isFiltered = statusFilter !== null;

  return { source, setSource, statusFilter, setStatusFilter, isFiltered };
};
```

## Code Quality

### Before Writing New Code

1. Check `components/` for existing shared components
1. Check `lib/hooks/` for existing hooks
1. Check `lib/utils/` for existing utilities
1. No code blocks >10 lines duplicated across files

### Self-Documenting Code

- Comments only for "why", never "what"
- Extract complex conditionals to named booleans

### Theme & Styling

- **All visual properties via theme tokens** — zero hardcoded colors, spacing, sizes, radii, shadows, or font values anywhere in component code
- **No inline magic numbers** — every numeric style value must reference a token (`spacing.md`, `borderRadius.sm`, `fontSize.lg`, etc.)
- `StyleSheet.create()` at bottom of file for React Native — no large inline style objects
- Dynamic styles: use style arrays `[styles.card, { opacity: isActive ? 1 : 0.5 }]`

**Theming engine architecture** (matching meal-planner pattern):

- `lib/theme/colors.ts` — `ColorTokens` interface with semantic groups (primary, text, surface, button, border, content, trail status colors)
- `lib/theme/layout.ts` — spacing scale, border radii, icon sizes, shadows, animation constants (all `as const`)
- `lib/theme/typography.ts` — font sizes, weights, line heights, per-theme font families
- `lib/theme/styles.ts` — composed style helpers created from tokens
- `lib/theme/theme-context.tsx` — `ThemeProvider` + `useTheme()` hook providing resolved tokens
- `lib/theme/themes/` — one file per theme, self-contained `ThemeDefinition`; registry auto-collects
- `lib/theme.ts` — public API surface, re-exports only consumer-facing types and values

**Theme rules:**

- Components read from `useTheme()` — never branch on theme name/id
- Themes define behavior via config tokens (`ButtonDisplayConfig`, `StyleOverrides`, `VisibilityTokens`) not string checks
- Start with one "outdoor" light theme; the architecture must support adding themes by adding a single file

**Pre-flight checklist before writing any style value:**

1. Search theme files for existing tokens matching your value
1. Pick the nearest spacing token — consistency > pixel-perfection
1. If no token exists, add one to the theme BEFORE using the value
1. Never construct color strings at runtime (e.g., template literals with alpha)

### Component Reuse

Before writing any new visual element:

1. **Can an existing shared component do this?** Check `components/` first
1. **Can an existing component be extended?** Add a prop rather than creating a duplicate
1. **Create a new shared component** only when (1) and (2) fail
1. **Never hand-roll** a pattern that a shared component already covers — even "just this once." Inline one-offs drift from the design system and break theme consistency

Violations are a **blocking review issue**, same as hardcoded colors.

### Map Components

- `MapView` — base map component (react-leaflet `MapContainer` + tile layer), consumes theme tokens for styling
- `TrailOverlay` — reusable polyline renderer, takes trail data + theme-derived status colors
- `MarkerLayer` — reusable for POI pins, foraging emoji markers, trail start points
- Map colors (trail status, marker fills) come from theme tokens, not hardcoded hex values

## Error Handling

- Use Error Boundaries for component-level failures
- Display user-friendly error states, not raw error messages
- Log errors for debugging (gate behind `__DEV__` or equivalent in production)

## Testing

- Test hooks and utility functions — see project test conventions for thresholds
- Use `@testing-library/react` patterns (query by role/text, not test IDs)
- Mock external services — never call real APIs in tests
- Descriptive test names: `test("displays trail distance when expanded")`

## When to Split Files

1. File >300 lines → extract components, hooks, or utils
1. Component function >40 lines → extract sub-components or hooks
1. Reused logic → custom hook in `lib/hooks/`
1. Complex state → separate hook or reducer
