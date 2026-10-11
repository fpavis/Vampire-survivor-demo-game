import { render } from 'preact';
import { App } from './App';
import { CSS } from './style';
import { ui } from './bridge';

export function mountUi(game: any) {
  if (document.getElementById('ui-root')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'ui-root';
  document.body.appendChild(root);
  ui.game = game;
  render(<App />, root);
}
