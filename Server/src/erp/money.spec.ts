import { totals } from './money.js';
describe('document money', () => {
  it('rounds tax per line with decimal arithmetic', () => {
    const result = totals([
      { quantity: 3, unitPrice: 19.99, taxBps: 1000 },
      { quantity: 1, unitPrice: 0.05, taxBps: 1000 },
    ]);
    expect(result.subtotal.toString()).toBe('60.02');
    expect(result.taxTotal.toString()).toBe('6.01');
    expect(result.total.toString()).toBe('66.03');
  });
  it('requires document lines', () => {
    expect(() => totals([])).toThrow();
  });
});
