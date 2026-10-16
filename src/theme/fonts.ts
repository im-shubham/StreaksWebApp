import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

export const ICON_FONT = 'MaterialSymbolsOutlined';
export const ICON_FONT_FILLED = 'MaterialSymbolsOutlined-Filled';

export const appFonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  [ICON_FONT]: require('../../assets/fonts/MaterialSymbolsOutlined-Regular.ttf'),
  [ICON_FONT_FILLED]: require('../../assets/fonts/MaterialSymbolsOutlined-Filled.ttf'),
};
