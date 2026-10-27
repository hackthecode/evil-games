import { fromFEN } from './engine.js';
import { search, LEVELS } from './ai.js';

self.onmessage = (e) => {
  const { fen, level, id } = e.data;
  const m = search(fromFEN(fen), LEVELS[level] || LEVELS.medium);
  self.postMessage({ id, move: m && { from: m.from, to: m.to, promo: m.promo || null } });
};
