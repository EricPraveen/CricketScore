/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const CricketColors = {
  bg: '#F6F8F6',            // Soft stadium off-white/cream
  surface: '#FFFFFF',       // Pure crisp white
  surfaceWarm: '#FAF7F2',   // Cricket flannel / pitch cream
  card: '#FFFFFF',
  cardAlt: '#F0F5F1',       // Light stadium tint
  border: '#E2EBE3',        // Subtle mint/gray border
  borderLight: '#EDF2EE',
  green: '#15803D',         // Stadium grass green
  greenLight: '#DCFCE7',    // Mint tag bg
  greenDark: '#14532D',     // Deep forest green
  red: '#DC2626',           // Cricket leather red
  redLight: '#FEE2E2',      // Soft red tag bg
  redDark: '#991B1B',       // Deep cherry red
  gold: '#D97706',          // Warm gold
  goldLight: '#FEF3C7',     // Soft gold badge
  cream: '#FFFBEB',         // Cream
  purple: '#7C3AED',        // Maximum purple
  purpleLight: '#F3E8FF',
  text: '#0F172A',          // Deep slate text
  textSub: '#475569',       // Muted slate
  textMuted: '#94A3B8',     // Light slate
  white: '#FFFFFF',
};

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
