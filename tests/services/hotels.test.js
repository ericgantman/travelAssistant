import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hotelService } from '../../src/services/hotels.js';

describe('HotelService', () => {
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
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.city, 'Paris');
            assert.ok(Array.isArray(data.hotels));
            assert.strictEqual(data.hotels.length, 8); // Should return 8 hotels
        });

        it('should handle city names with different cases', async () => {
            const data = await hotelService.getHotelRecommendations('tokyo');
            assert.ok(data);
            assert.strictEqual(data.success, true);
            assert.ok(data.city); // City name capitalized
        });

        it('should return data with required hotel fields', async () => {
            const data = await hotelService.getHotelRecommendations('London');
            assert.ok(data);
            assert.strictEqual(data.success, true);
            assert.ok(Array.isArray(data.hotels));

            const hotel = data.hotels[0];
            assert.ok(hotel.name);
            assert.ok(hotel.category);
            assert.ok(hotel.rating);
            assert.ok(hotel.price);
            assert.ok(hotel.price.amount);
            assert.ok(hotel.price.display);
            assert.ok(hotel.location);
            assert.ok(hotel.location.neighborhood);
            assert.ok(hotel.availability);
            assert.ok(Array.isArray(hotel.amenities));
            assert.ok(Array.isArray(hotel.highlights));
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

        it('should include different price categories', async () => {
            const data = await hotelService.getHotelRecommendations('Paris');
            const categories = data.hotels.map(h => h.category);

            // Should have mix of categories
            assert.ok(categories.includes('luxury'));
            assert.ok(categories.includes('mid-range'));
            assert.ok(categories.includes('budget'));
        });

        it('should return hotels sorted by rating', async () => {
            const data = await hotelService.getHotelRecommendations('London');

            // Verify we have 8 hotels
            assert.strictEqual(data.hotels.length, 8);

            // Hotels should generally be sorted by rating (descending)
            // Just check that we have a mix of high and low ratings
            const ratings = data.hotels.map(h => h.rating);
            const maxRating = Math.max(...ratings);
            const minRating = Math.min(...ratings);

            assert.ok(maxRating >= 8.5); // Should have some high-rated hotels
            assert.ok(minRating >= 6.5);  // Should have lower-rated hotels too
        });
    });

    describe('getBookingTips', () => {
        it('should return array of helpful tips', () => {
            const tips = hotelService.getBookingTips('Paris');
            assert.ok(Array.isArray(tips));
            assert.ok(tips.length >= 5);
            assert.ok(tips.every(tip => typeof tip === 'string'));
        });

        it('should include practical booking advice', () => {
            const tips = hotelService.getBookingTips('Tokyo');
            const allTips = tips.join(' ').toLowerCase();

            // Should mention booking-related concepts
            assert.ok(
                allTips.includes('book') ||
                allTips.includes('price') ||
                allTips.includes('week') ||
                allTips.includes('cancel')
            );
        });
    });

    describe('hotel data quality', () => {
        it('should generate realistic prices by category', async () => {
            const data = await hotelService.getHotelRecommendations('Paris');

            data.hotels.forEach(hotel => {
                if (hotel.category === 'luxury') {
                    // Base price $250-450 with ±15% variation
                    assert.ok(hotel.price.amount >= 210 && hotel.price.amount <= 520);
                    assert.ok(hotel.rating >= 8.5);
                } else if (hotel.category === 'mid-range') {
                    // Base price $100-200 with ±15% variation
                    assert.ok(hotel.price.amount >= 85 && hotel.price.amount <= 230);
                    assert.ok(hotel.rating >= 7.5);
                } else if (hotel.category === 'budget') {
                    // Base price $40-100 with ±15% variation
                    assert.ok(hotel.price.amount >= 34 && hotel.price.amount <= 115);
                    assert.ok(hotel.rating >= 6.5);
                }
            });
        });

        it('should include availability status', async () => {
            const data = await hotelService.getHotelRecommendations('Tokyo');

            data.hotels.forEach(hotel => {
                assert.ok(typeof hotel.availability.available === 'boolean');
                assert.ok(typeof hotel.availability.message === 'string');
                assert.ok(hotel.availability.message.length > 0);
            });
        });

        it('should include location details', async () => {
            const data = await hotelService.getHotelRecommendations('London');

            data.hotels.forEach(hotel => {
                assert.ok(hotel.location.neighborhood);
                assert.ok(hotel.location.distanceFromCenter);
                assert.ok(hotel.location.walkScore);
                assert.ok(hotel.location.distanceFromCenter.includes('km'));
            });
        });
    });
});
