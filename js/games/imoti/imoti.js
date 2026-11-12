// Imoti i Imperii – a property board game with its own Python server (server/imoti, run on Render).
// The interface is published as a separate site in imoti/; here it is only framed inside the portal.
import { h } from '../../ui.js';
import { txt } from '../../i18n.js';

export function mount(root) {
  const frame = h('iframe', {
    class: 'imoti-frame',
    src: 'imoti/index.html',
    title: txt('Estates & Empires'),
    allow: 'fullscreen; clipboard-write; autoplay',
  });
  frame.style.cssText = 'flex: 1; width: 100%; min-height: 0; border: 0; background: #050a14;';
  root.append(frame);
  return { destroy() { frame.remove(); } };
}
