import { describe, it } from 'node:test';
import assert from 'node:assert';
import { currencyService } from '../../src/services/currency.js';

describe('CurrencyService', () => {
    describe('getExchangeRate', () => {
        it('should fetch exchange rate between two currencies', async () => {
            const rate = await currencyService.getExchangeRate('USD', 'EUR');

            assert.ok(rate, 'Rate should be returned');
            assert.strictEqual(rate.from, 'USD');
            assert.strictEqual(rate.to, 'EUR');
            assert.ok(rate.rate > 0, 'Rate should be positive');
            assert.ok(rate.lastUpdate, 'Should include last update time');
        });

        it('should handle lowercase currency codes', async () => {
            const rate = await currencyService.getExchangeRate('usd', 'jpy');

            assert.ok(rate);
            assert.strictEqual(rate.from, 'USD');
            assert.strictEqual(rate.to, 'JPY');
        });

        it('should cache exchange rates', async () => {
            // First call - fresh fetch
            const rate1 = await currencyService.getExchangeRate('USD', 'GBP');

            // Second call - should use cache
            const rate2 = await currencyService.getExchangeRate('USD', 'GBP');

            assert.deepStrictEqual(rate1, rate2, 'Cached rate should match');
        });

        it('should return null for invalid currency code', async () => {
            const rate = await currencyService.getExchangeRate('USD', 'INVALID');

            assert.strictEqual(rate, null);
        });

        it('should include calculation function', async () => {
            const rate = await currencyService.getExchangeRate('USD', 'EUR');

            assert.ok(typeof rate.calculation === 'function');
            const result = rate.calculation(100);
            assert.ok(parseFloat(result) > 0);
        });
    });

    describe('convertCurrency', () => {
        it('should convert amount between currencies', async () => {
            const conversion = await currencyService.convertCurrency(100, 'USD', 'EUR');

            assert.ok(conversion, 'Conversion should be returned');
            assert.strictEqual(conversion.originalAmount, 100);
            assert.strictEqual(conversion.originalCurrency, 'USD');
            assert.strictEqual(conversion.targetCurrency, 'EUR');
            assert.ok(conversion.convertedAmount > 0);
            assert.ok(conversion.rate > 0);
            assert.ok(conversion.formatted.includes('100 USD'));
        });

        it('should handle decimal amounts', async () => {
            const conversion = await currencyService.convertCurrency(99.99, 'EUR', 'GBP');

            assert.ok(conversion);
            assert.strictEqual(conversion.originalAmount, 99.99);
            assert.ok(conversion.convertedAmount > 0);
        });

        it('should return null for invalid conversion', async () => {
            const conversion = await currencyService.convertCurrency(100, 'INVALID', 'EUR');

            assert.strictEqual(conversion, null);
        });

        it('should format result correctly', async () => {
            const conversion = await currencyService.convertCurrency(500, 'USD', 'JPY');

            assert.ok(conversion.formatted);
            assert.match(conversion.formatted, /500 USD = [\d.]+ JPY/);
        });
    });

    describe('extractCurrencies', () => {
        it('should extract currency codes from message', () => {
            const result = currencyService.extractCurrencies('Convert USD to EUR');

            assert.ok(result);
            assert.strictEqual(result.from, 'USD');
            assert.strictEqual(result.to, 'EUR');
        });

        it('should extract currencies from natural language', () => {
            const result = currencyService.extractCurrencies('how much is dollars in euros?');

            assert.ok(result);
            // Should extract both USD and EUR (order may vary based on which appears first in text)
            assert.ok(['USD', 'EUR'].includes(result.from));
            assert.ok(['USD', 'EUR'].includes(result.to));
            assert.notStrictEqual(result.from, result.to, 'Should extract two different currencies');
        });

        it('should handle currency names', () => {
            const tests = [
                { msg: 'convert pounds to yen', currencies: ['GBP', 'JPY'] },
                { msg: 'yuan to rupees', currencies: ['CNY', 'INR'] },
                { msg: 'francs to kronor', currencies: ['CHF', 'SEK'] }
            ];

            for (const test of tests) {
                const result = currencyService.extractCurrencies(test.msg);
                assert.ok(result, `Should extract from: ${test.msg}`);
                // Both currencies should be found, order may vary
                assert.ok(test.currencies.includes(result.from), `Expected from to be one of ${test.currencies}, got ${result.from}`);
                assert.ok(test.currencies.includes(result.to), `Expected to to be one of ${test.currencies}, got ${result.to}`);
                assert.notStrictEqual(result.from, result.to, 'Should extract two different currencies');
            }
        });

        it('should return null when no currencies found', () => {
            const result = currencyService.extractCurrencies('what is the weather?');

            assert.strictEqual(result, null);
        });

        it('should return null for single currency', () => {
            const result = currencyService.extractCurrencies('I have USD');

            assert.strictEqual(result, null);
        });
    });

    describe('extractAmount', () => {
        it('should extract amount with dollar sign', () => {
            const amount = currencyService.extractAmount('I have $500');

            assert.strictEqual(amount, 500);
        });

        it('should extract amount with euro sign', () => {
            const amount = currencyService.extractAmount('Convert €250.50');

            assert.strictEqual(amount, 250.50);
        });

        it('should extract amount with currency word', () => {
            const tests = [
                { msg: '100 dollars to euros', expected: 100 },
                { msg: '75.50 euros to pounds', expected: 75.50 },
                { msg: 'convert 1000 yen', expected: 1000 }
            ];

            for (const test of tests) {
                const amount = currencyService.extractAmount(test.msg);
                assert.strictEqual(amount, test.expected, `Should extract from: ${test.msg}`);
            }
        });

        it('should handle amounts with commas', () => {
            const amount = currencyService.extractAmount('$1,000.50');

            assert.strictEqual(amount, 1000.50);
        });

        it('should return null when no amount found', () => {
            const amount = currencyService.extractAmount('what is the rate?');

            assert.strictEqual(amount, null);
        });
    });

    describe('shouldFetchCurrency', () => {
        it('should return true for currency exchange queries', () => {
            const queries = [
                'what is the exchange rate for USD to EUR?',
                'convert dollars to euros',
                'how much is 100 USD worth in JPY?',
                'currency exchange rate',
                'convert 500 euros to pounds'
            ];

            for (const query of queries) {
                const result = currencyService.shouldFetchCurrency(query);
                assert.strictEqual(result, true, `Should detect: ${query}`);
            }
        });

        it('should return false for non-currency queries', () => {
            const queries = [
                'what is the weather in Paris?',
                'tell me about France',
                'what should I pack?'
            ];

            for (const query of queries) {
                const result = currencyService.shouldFetchCurrency(query);
                assert.strictEqual(result, false, `Should not detect: ${query}`);
            }
        });

        it('should be case insensitive', () => {
            const result = currencyService.shouldFetchCurrency('CONVERT USD TO EUR');

            assert.strictEqual(result, true);
        });
    });
});
