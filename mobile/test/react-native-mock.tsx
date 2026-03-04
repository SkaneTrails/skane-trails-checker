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

export const Alert = { alert: vi.fn() };

/* Simple HTML-element wrappers */
export const View = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => React.createElement('div', { ...props, ref }),
);
View.displayName = 'View';

export const Text = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { numberOfLines?: number }>(
  ({ numberOfLines: _numberOfLines, ...props }, ref) => React.createElement('span', { ...props, ref }),
);
Text.displayName = 'Text';

export const Pressable = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { onPress?: () => void; accessibilityLabel?: string }>(
  ({ onPress, accessibilityLabel, ...props }, ref) =>
    React.createElement('button', { ...props, onClick: onPress, 'aria-label': accessibilityLabel, ref }),
);
Pressable.displayName = 'Pressable';

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => React.createElement('input', { ...props, ref }),
);
TextInput.displayName = 'TextInput';

export const ScrollView = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => React.createElement('div', { ...props, ref }),
);
ScrollView.displayName = 'ScrollView';

export const ActivityIndicator = () => React.createElement('div', { 'data-testid': 'activity-indicator' });

export const FlatList = ({ data, renderItem, ListEmptyComponent, keyExtractor }: {
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
      React.createElement('div', { key: keyExtractor?.(item, index) ?? index }, renderItem?.({ item, index })),
    ),
  );
};
