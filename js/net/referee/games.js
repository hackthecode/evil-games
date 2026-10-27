// Игрите със скрита информация, които се водят от сървъра-съдия.
export const REFEREED = ['belot', 'santase', 'blato'];

const loaders = {
  belot: () => import('../../games/belot/referee.js'),
  santase: () => import('../../games/santase/referee.js'),
  blato: () => import('../../games/blato/referee.js'),
};

export async function reducerFor(gameId) {
  const mod = await loaders[gameId]();
  return mod.default;
}
