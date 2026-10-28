// Chess: the move generator against the known "perft" numbers.
import { test, eq } from './harness.js';
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
