/**
 * Minimal react-native stub for vitest/jsdom tests.
 *
 * Maps RN primitives to plain HTML elements so component tests
 * can render and query without loading the real react-native
 * module (which contains Flow syntax that Rollup cannot parse).
 */
import React from 'react';

export const Platform = {
  OS: 'web' as const,
  select: (obj: Record<string, unknown>) => obj.web ?? obj.default,
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
};

/** Flatten RN-style arrays into a single object for React DOM. */
function flattenStyle(style: unknown): React.CSSProperties | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
  }
  return style as React.CSSProperties;
}

export const Alert = { alert: vi.fn() };

/* Simple HTML-element wrappers */
export const View = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, ...props }, ref) => React.createElement('div', { ...props, style: flattenStyle(style), ref }),
);
View.displayName = 'View';

export const Text = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { numberOfLines?: number }
>(({ numberOfLines: _numberOfLines, style, ...props }, ref) =>
  React.createElement('span', { ...props, style: flattenStyle(style), ref }),
);
Text.displayName = 'Text';

export const Pressable = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: () => void;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: Record<string, unknown>;
    style?: unknown;
  }
>(({ onPress, accessibilityLabel, accessibilityRole: _role, accessibilityState: _state, style, ...props }, ref) => {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return React.createElement('button', {
    ...props,
    style: flattenStyle(resolved),
    onClick: onPress,
    'aria-label': accessibilityLabel,
    ref,
  });
});
Pressable.displayName = 'Pressable';

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { onChangeText?: (text: string) => void }
>(({ onChangeText, ...props }, ref) =>
  React.createElement('input', {
    ...props,
    onChange: onChangeText
      ? (e: React.ChangeEvent<HTMLInputElement>) => onChangeText(e.target.value)
      : undefined,
    ref,
  }),
);
TextInput.displayName = 'TextInput';

export const ScrollView = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => React.createElement('div', { ...props, ref }),
);
ScrollView.displayName = 'ScrollView';

export const ActivityIndicator = () =>
  React.createElement('div', { 'data-testid': 'activity-indicator' });

export const FlatList = ({
  data,
  renderItem,
  ListEmptyComponent,
  keyExtractor,
}: {
  data?: unknown[];
  renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
  contentContainerStyle?: unknown;
}) => {
  if (!data?.length) return ListEmptyComponent ?? null;
  return React.createElement(
    'div',
    null,
    data.map((item, index) =>
      React.createElement(
        'div',
        { key: keyExtractor?.(item, index) ?? index },
        renderItem?.({ item, index }),
      ),
    ),
  );
};
