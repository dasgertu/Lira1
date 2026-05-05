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
  background: '#FBF6EF',
  backgroundAccent: '#F4EADB',
  card: '#FFFCF7',
  surface: '#F6ECDD',
  text: '#8E6F58',
  textMuted: '#B59C84',
  border: '#F1E2CB',
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
  background: '#3A2D22',
  backgroundAccent: '#4A3A2C',
  card: '#473628',
  surface: '#4F3D2D',
  text: '#F4E4CF',
  textMuted: '#C9B299',
  border: '#5A4534',
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
