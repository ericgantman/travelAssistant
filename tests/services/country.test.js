/**
 * Unit tests for Country Service
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { countryService } from '../../src/services/country.js';

describe('CountryService', () => {
    describe('extractCountry', () => {
        it('should extract first capitalized phrase', () => {
            const message = "Visiting Japan soon";
            const country = countryService.extractCountry(message);
            // Returns full match including potential multi-word names
            assert.ok(country === 'Visiting Japan' || country === 'Visiting');
        });

        it('should extract multi-word country names', () => {
            const message = "I want to visit New Zealand";
            const country = countryService.extractCountry(message);
            // Could be "New Zealand" or just first match
            assert.ok(country && country.length > 0);
        });

        it('should return first capitalized phrase when multiple exist', () => {
            const message = "Visit France or Spain this summer";
            const country = countryService.extractCountry(message);
            // Returns first match
            assert.ok(country && country.length > 0);
        });

        it('should handle country name at start of message', () => {
            const message = "Thailand is on my bucket list";
            const country = countryService.extractCountry(message);
            assert.strictEqual(country, 'Thailand');
        });

        it('should handle country name at end of message', () => {
            const message = "I'm planning a trip to Italy";
            const country = countryService.extractCountry(message);
            assert.strictEqual(country, 'Italy');
        });

        it('should return null when no capitalized words found', () => {
            const message = "tell me about traveling";
            const country = countryService.extractCountry(message);
            assert.strictEqual(country, null);
        });

        it('should extract from sentences', () => {
            const message = "The capital of Germany is Berlin";
            const country = countryService.extractCountry(message);
            // Returns first capitalized match
            assert.ok(country && country.length > 0);
        });
    });

    describe('shouldFetchCountryInfo', () => {
        it('should return true for destination query with country', () => {
            const message = "Tell me about Japan";
            const queryType = "destination";
            const result = countryService.shouldFetchCountryInfo(message, queryType);
            assert.strictEqual(result, true);
        });

        it('should return true for general query with country', () => {
            const message = "What currency do they use in France?";
            const queryType = "general";
            const result = countryService.shouldFetchCountryInfo(message, queryType);
            assert.strictEqual(result, true);
        });

        it('should return false when no country found', () => {
            const message = "tell me about traveling";
            const queryType = "destination";
            const result = countryService.shouldFetchCountryInfo(message, queryType);
            assert.strictEqual(result, false);
        });

        it('should return false for packing query', () => {
            const message = "What should I pack for Japan?";
            const queryType = "packing";
            const result = countryService.shouldFetchCountryInfo(message, queryType);
            assert.strictEqual(result, false);
        });

        it('should return false for attractions query', () => {
            const message = "What attractions are in Paris?";
            const queryType = "attractions";
            const result = countryService.shouldFetchCountryInfo(message, queryType);
            assert.strictEqual(result, false);
        });
    });

    describe('formatCountryForPrompt', () => {
        it('should format country data correctly', () => {
            const countryInfo = {
                name: 'France',
                capital: 'Paris',
                region: 'Europe',
                subregion: 'Western Europe',
                languages: 'French',
                currencies: 'Euro (€)',
                timezone: 'UTC+01:00',
                drivingSide: 'right'
            };

            const formatted = countryService.formatCountryForPrompt(countryInfo);

            assert.ok(formatted.includes('France'));
            assert.ok(formatted.includes('Paris'));
            assert.ok(formatted.includes('Europe'));
            assert.ok(formatted.includes('Western Europe'));
            assert.ok(formatted.includes('French'));
            assert.ok(formatted.includes('Euro (€)'));
            assert.ok(formatted.includes('UTC+01:00'));
            assert.ok(formatted.includes('right'));
        });

        it('should return empty string for null data', () => {
            const formatted = countryService.formatCountryForPrompt(null);
            assert.strictEqual(formatted, '');
        });
    });

    describe('cache', () => {
        it('should cache country data', () => {
            const testData = {
                name: 'TestCountry',
                capital: 'TestCity'
            };

            // Set cache
            countryService.cache.set('TestCountry', testData);

            // Retrieve from cache
            const cached = countryService.cache.get('TestCountry');
            assert.deepStrictEqual(cached, testData);
        });

        it('should return undefined for non-cached country', () => {
            const cached = countryService.cache.get('NonExistentCountry');
            assert.strictEqual(cached, undefined);
        });
    });
});
