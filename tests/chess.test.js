// Chess: the move generator against the known "perft" numbers.
import { test, eq, ok } from './harness.js';
import { fromFEN, legalMoves, makeMove, START_FEN, gameStatus } from '../js/games/chess/engine.js';

const perft = (st, d) => (d === 0 ? 1 : legalMoves(st).reduce((n, m) => n + perft(makeMove(st, m), d - 1), 0));

test('chess: perft from the starting position (depth 3 = 8902)', () => eq(perft(fromFEN(START_FEN), 3), 8902));
test('chess: perft "Kiwipete" (castling, en passant; depth 2 = 2039)', () => eq(perft(fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), 2), 2039));
test('chess: position 3 (depth 3 = 2812)', () => eq(perft(fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 3), 2812));
test('chess: checkmate and stalemate are detected', () => {
  eq(gameStatus(fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')), { over: true, reason: 'checkmate', winner: 'b' });
  eq(gameStatus(fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), { over: true, reason: 'stalemate' });
  eq(gameStatus(fromFEN(START_FEN)), null);
});

test('chess help: warns before a move that loses the queen, and about a mate in one', async () => {
  const { blunder, threats } = await import('../js/games/chess/help.js');
  const { sqFromName } = await import('../js/games/chess/engine.js');
  const st = fromFEN('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
  const mv = (from, to) => legalMoves(st).find((m) => m.from === sqFromName(from) && m.to === sqFromName(to));
  eq(blunder(st, mv('d1', 'g4'))?.kind, 'loss', 'Qg4 hangs the queen to Bc8');
  eq(blunder(st, mv('g1', 'f3')), null, 'Nf3 is safe');
  // fool's mate: after 1.f3 e5 2.g4?? black mates with Qh4
  const fm = fromFEN('rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2');
  const g4 = legalMoves(fm).find((m) => m.from === sqFromName('g2') && m.to === sqFromName('g4'));
  eq(blunder(fm, g4)?.kind, 'mate');
  // threats: the knight on f3 attacked by a pawn
  const t = fromFEN('rnbqkbnr/pppp1ppp/8/8/4p3/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2');
  ok(threats(t, 'w').some((x) => x.sq === sqFromName('f3')), 'the knight is in danger');
});
