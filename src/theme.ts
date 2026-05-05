import { ColorSchemeName } from 'react-native';

export interface ThemeColors {
  mode: 'light' | 'dark';
  background: string;
  backgroundAccent: string;
  card: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  period: string;
  predictedPeriod: string;
  ovulation: string;
  ovulationPeak: string;
  fertile: string;
  follicular: string;
  luteal: string;
  ringTrack: string;
  today: string;
  danger: string;
  accent: string;
}

export const lightColors: ThemeColors = {
  mode: 'light',
  background: '#FCEAD3',
  backgroundAccent: '#F8D5BA',
  card: '#FFF5E8',
  surface: '#F9DEC3',
  text: '#7A5946',
  textMuted: '#A88673',
  border: '#EFCDA8',
  primary: '#C99275',
  primaryText: '#FFFFFF',
  period: '#E07083',
  predictedPeriod: '#E89B8A',
  ovulation: '#F4B5D2',
  ovulationPeak: '#C45A8E',
  fertile: '#F8E7C8',
  follicular: '#F1DDC4',
  luteal: '#EBD9C2',
  ringTrack: '#F1E1CC',
  today: '#8C6B53',
  danger: '#B5704A',
  accent: '#C99275',
};

export const darkColors: ThemeColors = {
  // "Dim" warm palette — dark mode that still feels cream-tinted, not chocolate.
  mode: 'dark',
  background: '#3F2A1B',
  backgroundAccent: '#553A26',
  card: '#4D3522',
  surface: '#553A26',
  text: '#F8E2C5',
  textMuted: '#D2B392',
  border: '#6A4D34',
  primary: '#E8B58D',
  primaryText: '#3A2D22',
  period: '#E07585',
  predictedPeriod: '#C26F60',
  ovulation: '#E093BC',
  ovulationPeak: '#B45683',
  fertile: '#D8BA92',
  follicular: '#7A5E47',
  luteal: '#735540',
  ringTrack: '#5A4534',
  today: '#F4D6B4',
  danger: '#E08962',
  accent: '#E8B58D',
};

export const resolveColors = (
  pref: 'auto' | 'light' | 'dark',
  _system: ColorSchemeName,
): ThemeColors => {
  // "Auto" defaults to the warm light palette — dark mode is opt-in only.
  // Without this, an iPhone in system dark mode flips the whole UI to brown
  // and the warm cream/peach aesthetic disappears.
  if (pref === 'dark') return darkColors;
  return lightColors;
};
