import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { getEnv } from './env';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  overlay: string;
  mapAccent: string;
  bidHighlight: string;
  otpAccent: string;
}

export interface ThemeSpacing {
  xxs: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeTypography {
  fontFamily: string;
  fontFamilyDisplay: string;
  sizes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    hero: number;
  };
  weights: {
    regular: TextStyle['fontWeight'];
    medium: TextStyle['fontWeight'];
    semibold: TextStyle['fontWeight'];
    bold: TextStyle['fontWeight'];
  };
}

export interface ThemeRadii {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

export interface AppTheme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  radii: ThemeRadii;
  shadow: (elevation?: number) => ViewStyle;
}

const spacing: ThemeSpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const typography: ThemeTypography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: 'Inter, system-ui, -apple-system, sans-serif',
    default: 'System',
  }) as string,
  fontFamilyDisplay: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: '"DM Sans", Inter, system-ui, sans-serif',
    default: 'System',
  }) as string,
  sizes: { xs: 11, sm: 13, md: 15, lg: 17, xl: 22, xxl: 28, hero: 36 },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

const radii: ThemeRadii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
};

function buildColors(primary: string, secondary: string): ThemeColors {
  return {
    primary,
    primaryDark: secondary,
    secondary,
    background: '#F4F7F8',
    surface: '#FFFFFF',
    surfaceMuted: '#E8F6F8',
    border: '#D5E4E7',
    text: '#1A2B2E',
    textMuted: '#6B7C80',
    textInverse: '#FFFFFF',
    success: '#1B7F4E',
    warning: '#E67E22',
    danger: '#C0392B',
    info: '#1F6F8B',
    overlay: 'rgba(8, 30, 34, 0.45)',
    mapAccent: primary,
    bidHighlight: '#E6F7F9',
    otpAccent: primary,
  };
}

export function createTheme(overrides?: Partial<{ primary: string; secondary: string }>): AppTheme {
  const env = getEnv();
  const primary = overrides?.primary ?? env.brandPrimary;
  const secondary = overrides?.secondary ?? env.brandSecondary;
  const colors = buildColors(primary, secondary);

  return {
    colors,
    spacing,
    typography,
    radii,
    shadow: (elevation = 2): ViewStyle => {
      if (Platform.OS === 'web') {
        const y = Math.max(1, elevation);
        const blur = elevation * 4;
        return {
          boxShadow: `0 ${y}px ${blur}px rgba(8, 20, 16, 0.12)`,
        } as ViewStyle;
      }
      if (Platform.OS === 'android') {
        return { elevation };
      }
      return {
        shadowColor: '#081410',
        shadowOffset: { width: 0, height: Math.max(1, elevation / 2) },
        shadowOpacity: 0.12 + elevation * 0.02,
        shadowRadius: elevation * 1.5,
      };
    },
  };
}

export const defaultTheme = createTheme();
