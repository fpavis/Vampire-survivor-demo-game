import { render } from 'preact';
import { App } from './App';
import { CSS, scaledCss } from './style';
import { ui } from './bridge';
import { installNav } from './nav';

export function mountUi(game: any) {
  if (document.getElementById('ui-root')) return;
  const style = document.createElement('style');
  style.textContent = scaledCss(CSS);
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'ui-root';
  document.body.appendChild(root);
  ui.game = game;
  render(<App />, root);
  installNav();
}
