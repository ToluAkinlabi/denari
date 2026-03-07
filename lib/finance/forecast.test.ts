import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { forecastNextPeriod, getConfidenceLevel } from './forecast';

describe('forecasting', () => {
  it('returns HIGH confidence for stable values', () => {
    const confidence = getConfidenceLevel([
      new Decimal(3500),
      new Decimal(3500),
      new Decimal(3490),
      new Decimal(3510),
    ]);

    expect(confidence).toBe('HIGH');
  });

  it('forecasts next period key metrics', () => {
    const forecast = forecastNextPeriod({
      currentCash: new Decimal(3345),
      recentIncome: [new Decimal(3500), new Decimal(3500), new Decimal(3400), new Decimal(3600)],
      recentSpending: [new Decimal(655), new Decimal(720), new Decimal(600), new Decimal(680)],
      recentSavings: [new Decimal(500), new Decimal(520), new Decimal(480), new Decimal(540)],
    });

    expect(forecast.income.greaterThan(0)).toBe(true);
    expect(forecast.spending.greaterThan(0)).toBe(true);
    expect(forecast.endingCash.greaterThan(new Decimal(0))).toBe(true);
  });
});
