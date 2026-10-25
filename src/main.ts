import { fontsReady } from './ui/fonts';
import { startGame } from './app/game';

fontsReady().then(() => startGame());
