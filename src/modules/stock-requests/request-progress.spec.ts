import { StockRequestStatus } from '../../common/enums/stock-request-status.enum.js';
import { deliveryStatus, type LineProgress } from './request-progress.js';

const lines = [
  { id: 1, quantity: 3 },
  { id: 2, quantity: 2 },
];
const progress = (received: [number, number]) =>
  new Map<number, LineProgress>(
    lines.map((line, i) => [
      line.id,
      { received: received[i], inFlight: 0, remaining: 0 },
    ]),
  );

describe('deliveryStatus', () => {
  it('is fulfilled once every line is received in full', () => {
    expect(deliveryStatus(lines, progress([3, 2]), false)).toBe(
      StockRequestStatus.FULFILLED,
    );
  });

  it('is partially fulfilled while something is received but not all', () => {
    expect(deliveryStatus(lines, progress([1, 0]), true)).toBe(
      StockRequestStatus.PARTIALLY_FULFILLED,
    );
    expect(deliveryStatus(lines, progress([3, 0]), false)).toBe(
      StockRequestStatus.PARTIALLY_FULFILLED,
    );
  });

  it('is in transit while nothing is received and a package is on the road', () => {
    expect(deliveryStatus(lines, progress([0, 0]), true)).toBe(
      StockRequestStatus.IN_TRANSIT,
    );
  });

  it('goes back to approved when everything sent went missing', () => {
    expect(deliveryStatus(lines, progress([0, 0]), false)).toBe(
      StockRequestStatus.APPROVED,
    );
  });

  it('treats a line closed at 0 as complete', () => {
    expect(
      deliveryStatus(
        [
          { id: 1, quantity: 1 },
          { id: 2, quantity: 0 },
        ],
        progress([1, 0]),
        false,
      ),
    ).toBe(StockRequestStatus.FULFILLED);
  });
});
