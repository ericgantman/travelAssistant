import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hotelService } from '../../src/services/hotels.js';

describe('HotelService', () => {
    describe('extractCity', () => {
        it('should extract city from "hotel in" pattern', () => {
            const city = hotelService.extractCity('Find hotel in Tokyo');
            assert.strictEqual(city, 'Tokyo');
        });

        it('should extract city from "hotels in" pattern', () => {
            const city = hotelService.extractCity('Where are hotels in Paris?');
            assert.strictEqual(city, 'Paris');
        });

        it('should extract city from "stay in" pattern', () => {
            const city = hotelService.extractCity('Where to stay in Barcelona');
            assert.strictEqual(city, 'Barcelona');
        });

        it('should extract city from "accommodation in" pattern', () => {
            const city = hotelService.extractCity('Looking for accommodation in London');
            assert.strictEqual(city, 'London');
        });

        it('should extract city from "visiting" pattern', () => {
            const city = hotelService.extractCity('I am visiting Rome');
            assert.strictEqual(city, 'Rome');
        });

        it('should extract multi-word city names', () => {
            const city = hotelService.extractCity('Where to stay in New York?');
            assert.strictEqual(city, 'New York');
        });

        it('should handle lowercase input', () => {
            const city = hotelService.extractCity('hotel in tokyo');
            assert.ok(city); // Should extract something even if lowercase
        });

        it('should use fallback for simple capitalized words', () => {
            const city = hotelService.extractCity('I want to visit Paris');
            assert.strictEqual(city, 'Paris');
        });
    });

    describe('getBudgetSuggestions', () => {
        it('should return budget tier object for "budget"', () => {
            const suggestions = hotelService.getBudgetSuggestions('budget');
            assert.ok(suggestions);
            assert.ok(suggestions.range);
            assert.ok(Array.isArray(suggestions.types));
            assert.ok(Array.isArray(suggestions.tips));
        });

        it('should return mid-range suggestions', () => {
            const suggestions = hotelService.getBudgetSuggestions('mid-range');
            assert.ok(suggestions.range.includes('50'));
            assert.ok(suggestions.types.length > 0);
        });

        it('should return luxury suggestions', () => {
            const suggestions = hotelService.getBudgetSuggestions('luxury');
            assert.ok(suggestions.range.includes('150'));
            assert.ok(suggestions.types.some(t => t.toLowerCase().includes('luxury') || t.includes('star')));
        });

        it('should default to mid-range for unknown budget level', () => {
            const suggestions = hotelService.getBudgetSuggestions('unknown');
            assert.ok(suggestions);
            assert.ok(suggestions.range);
        });
    });

    describe('shouldFetchHotels', () => {
        it('should return true for hotel queries', () => {
            assert.strictEqual(hotelService.shouldFetchHotels('Where should I find a hotel in Paris?'), true);
        });

        it('should return true for accommodation queries', () => {
            assert.strictEqual(hotelService.shouldFetchHotels('Find accommodation in Tokyo'), true);
        });

        it('should return true for "where to stay" queries', () => {
            assert.strictEqual(hotelService.shouldFetchHotels('Where to stay in Rome?'), true);
        });

        it('should return false for non-hotel queries', () => {
            assert.strictEqual(hotelService.shouldFetchHotels('What is the weather?'), false);
        });

        it('should be case insensitive', () => {
            assert.strictEqual(hotelService.shouldFetchHotels('HOTEL in Paris'), true);
        });

        it('should detect hostel queries', () => {
            assert.strictEqual(hotelService.shouldFetchHotels('Are there hostels available?'), true);
        });

        it('should detect resort queries', () => {
            assert.strictEqual(hotelService.shouldFetchHotels('I want to book a resort'), true);
        });
    });

    describe('getHotelRecommendations', () => {
        it('should fetch hotel recommendations for a valid city', async () => {
            const data = await hotelService.getHotelRecommendations('Paris');
            assert.ok(data);
            assert.strictEqual(data.city, 'Paris');
            assert.ok(data.source);
            assert.ok(Array.isArray(data.recommendations));
        });

        it('should handle city names with different cases', async () => {
            const data = await hotelService.getHotelRecommendations('tokyo');
            assert.ok(data);
            // City name might be capitalized in response
            assert.ok(data.city);
        });

        it('should return data with required fields', async () => {
            const data = await hotelService.getHotelRecommendations('London');
            assert.ok(data);
            assert.ok(data.city);
            assert.ok(data.source);
            assert.ok(Array.isArray(data.recommendations));
            assert.ok(Array.isArray(data.budgetTips));
        });

        it('should cache hotel data', async () => {
            const city = 'Barcelona';

            // First call should fetch
            const data1 = await hotelService.getHotelRecommendations(city);

            // Second call should use cache
            const data2 = await hotelService.getHotelRecommendations(city);

            // Both should return same city data
            assert.ok(data1);
            assert.ok(data2);
            assert.strictEqual(data1.city, data2.city);
        });
    });

    describe('parseAccommodationInfo', () => {
        it('should parse accommodation text and extract info', () => {
            const text = 'Tokyo offers various accommodations including hotels in Shibuya and Shinjuku. Budget hostels are available.';
            const result = hotelService.parseAccommodationInfo(text, 'Tokyo');
            assert.ok(result);
            assert.ok(Array.isArray(result.recommendations));
            assert.ok(Array.isArray(result.budgetTips));
            assert.ok(Array.isArray(result.areas));
        });

        it('should return default recommendations when text has no specific info', () => {
            const text = 'Generic text without accommodation info';
            const result = hotelService.parseAccommodationInfo(text, 'Paris');
            assert.ok(result);
            assert.ok(result.recommendations.length > 0);
            assert.ok(result.recommendations.some(r => r.includes('Paris')));
        });
    });
});

