/**
 * Hotel Search Service
 * Uses SerpAPI (Google Hotels) for real hotel data
 * Falls back to realistic sample data if API unavailable
 */

import axios from 'axios';

class HotelService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 86400000; // 24 hours
        this.devMode = process.env.HOTELS_DEV_MODE === 'true' || process.env.FLIGHT_DEV_MODE === 'true';
        this.apiKey = process.env.SERPAPI_KEY || null;
        this.apiBaseUrl = 'https://serpapi.com/search.json';

        this.hotelTemplates = {
            european: ['Grand Hotel', 'Plaza Hotel', 'Royal Hotel', 'Palace Hotel', 'Central Hotel', 'Crown Hotel', 'Imperial Hotel', 'Majestic Hotel'],
            modern: ['City Inn', 'Metro Hotel', 'Urban Stay', 'Sky Hotel', 'Modern Suites', 'Downtown Hotel'],
            budget: ['Budget Inn', 'Economy Hotel', 'Smart Stay', 'Quick Hotel', 'Value Lodge'],
            boutique: ['Boutique Hotel', 'Art Hotel', 'Design Hotel', 'Signature Hotel', 'Heritage Hotel']
        };

        this.neighborhoodsByCity = {
            'paris': ['Le Marais', 'Latin Quarter', 'Montmartre', 'Saint-Germain', 'Champs-Élysées', 'Bastille'],
            'london': ['Covent Garden', 'Soho', 'Kensington', 'Westminster', 'Shoreditch', 'Camden'],
            'tokyo': ['Shibuya', 'Shinjuku', 'Ginza', 'Asakusa', 'Roppongi', 'Harajuku'],
            'new york': ['Manhattan', 'Brooklyn', 'Queens', 'Times Square', 'Upper East Side'],
            'rome': ['Trastevere', 'Centro Storico', 'Monti', 'Prati', 'Testaccio'],
            'barcelona': ['Gothic Quarter', 'Eixample', 'Gràcia', 'El Born', 'Barceloneta'],
            'amsterdam': ['Jordaan', 'De Pijp', 'Centrum', 'Oud-West', 'Canal Ring'],
            'berlin': ['Mitte', 'Kreuzberg', 'Prenzlauer Berg', 'Charlottenburg', 'Friedrichshain'],
            'madrid': ['Sol', 'Malasaña', 'Chueca', 'Retiro', 'Salamanca'],
            'lisbon': ['Alfama', 'Bairro Alto', 'Chiado', 'Belém', 'Príncipe Real']
        };
    }

    /**
     * Get hotel recommendations with REAL DATA from Google Hotels
     * @param {string} city - City name
     * @param {Object} options - Search options (checkIn, checkOut, guests, budgetLevel)
     * @returns {Promise<Object>} Hotel recommendations with real data
     */
    async getHotelRecommendations(city, options = {}) {
        const cacheKey = `hotels_${city.toLowerCase()}_${options.checkIn || 'anytime'}_${options.budgetLevel || 'all'}`;

        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        if (this.apiKey && !this.devMode) {
            try {
                const realData = await this.fetchRealHotelData(city, options);

                this.cache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: realData
                });

                return realData;
            } catch (error) {
                console.error('❌ Error fetching real hotel data:', error.message);
            }
        }

        const sampleData = this.generateRealisticHotelData(city, options);

        const result = {
            success: true,
            city,
            hotels: sampleData,
            dataSource: 'sample',
            checkIn: options.checkIn,
            checkOut: options.checkOut,
            note: 'Sample data - Add SERPAPI_KEY to .env for real Google Hotels data'
        };

        this.cache.set(cacheKey, {
            timestamp: Date.now(),
            data: result
        });

        return result;
    }

    /**
     * Fetch real hotel data from SerpAPI (Google Hotels)
     * @param {string} city - City name
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Real hotel data from Google
     */
    async fetchRealHotelData(city, options = {}) {
        const {
            checkIn = this.getDefaultCheckIn(),
            checkOut = this.getDefaultCheckOut(),
            adults = 2,
            children = 0,
            currency = 'USD'
        } = options;

        const params = {
            engine: 'google_hotels',
            q: city,
            check_in_date: checkIn,
            check_out_date: checkOut,
            adults: adults,
            children: children,
            currency: currency,
            api_key: this.apiKey,
            gl: 'us',
            hl: 'en'
        };

        try {
            const response = await axios.get(this.apiBaseUrl, {
                params,
                timeout: 10000
            });

            const data = response.data;

            if (data.error) {
                console.error('❌ SerpAPI error:', data.error);
                throw new Error(data.error);
            }

            if (!data.properties || data.properties.length === 0) {
                throw new Error('No hotels found');
            }

            const hotels = data.properties.slice(0, 10).map((property, index) => {
                const price = property.rate_per_night?.lowest || property.total_rate?.lowest || 0;
                const priceFormatted = property.rate_per_night?.extracted_lowest || price;
                const rating = property.overall_rating || property.reviews?.score || 4.0;
                const reviewCount = property.reviews?.count || 0;
                const starRating = property.hotel_class || property.type || 3;
                const category = starRating >= 4 ? 'luxury' : starRating >= 3 ? 'mid-range' : 'budget';
                const amenities = property.amenities || [];
                const topAmenities = amenities.slice(0, 8);
                const images = property.images || [];
                const thumbnail = images[0]?.thumbnail || null;

                return {
                    name: property.name,
                    category: category,
                    rating: rating,
                    reviewCount: reviewCount,
                    price: {
                        amount: priceFormatted,
                        currency: currency,
                        display: `${currency} ${priceFormatted}`,
                        perNight: true
                    },
                    location: {
                        neighborhood: property.neighborhood || property.district || 'City Center',
                        city: city,
                        distanceFromCenter: property.distance || 'N/A',
                        walkScore: null,
                        address: property.address || 'Address not available'
                    },
                    availability: {
                        available: true,
                        roomsLeft: null,
                        message: property.deal || 'Check availability'
                    },
                    amenities: topAmenities,
                    bookingUrl: property.link || `https://www.google.com/travel/hotels`,
                    images: images.length,
                    thumbnail: thumbnail,
                    highlights: [
                        property.description || `${starRating}-star hotel in ${city}`,
                        property.deal || 'Book now for best rates',
                        property.eco_certified ? 'Eco-certified property' : null
                    ].filter(Boolean),
                    guestRating: property.reviews?.positive_score || null,
                    type: property.type || 'Hotel',
                    checkIn: checkIn,
                    checkOut: checkOut
                };
            });

            return {
                success: true,
                city: city,
                hotels: hotels,
                dataSource: 'live',
                note: 'Real data from Google Hotels',
                checkIn: checkIn,
                checkOut: checkOut,
                totalResults: hotels.length
            };

        } catch (error) {
            if (error.response?.status === 429) {
                console.error('❌ SerpAPI quota exceeded. Enable dev mode to use sample data.');
                throw new Error('API quota exceeded. Please try again later.');
            }

            if (error.response?.status === 400) {
                console.error('❌ Bad request to SerpAPI:', error.response?.data);
                throw new Error('Invalid search parameters');
            }

            throw error;
        }
    }

    /**
     * Get default check-in date (tomorrow)
     */
    getDefaultCheckIn() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    /**
     * Get default check-out date (3 days from now)
     */
    getDefaultCheckOut() {
        const checkOut = new Date();
        checkOut.setDate(checkOut.getDate() + 3);
        return checkOut.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    /**
     * Generate realistic hotel data with prices, ratings, and availability
     * @param {string} city - City name
     * @param {Object} options - Search options
     * @returns {Array} Array of hotel objects with realistic data
     */
    generateRealisticHotelData(city, options = {}) {
        const cityLower = city.toLowerCase();
        const neighborhoods = this.neighborhoodsByCity[cityLower] || ['City Center', 'Downtown', 'Old Town', 'Business District'];

        const hotels = [];
        const hotelCount = 8;

        for (let i = 0; i < hotelCount; i++) {
            const category = this.getHotelCategory(i);
            const hotel = this.generateSingleHotel(city, category, neighborhoods, i, options);
            hotels.push(hotel);
        }

        return hotels.sort((a, b) => {
            if (Math.abs(b.rating - a.rating) > 0.3) {
                return b.rating - a.rating;
            }
            return a.price.amount - b.price.amount;
        });
    }

    /**
     * Determine hotel category based on index
     * @param {number} index - Hotel index
     * @returns {string} Hotel category
     */
    getHotelCategory(index) {
        if (index < 2) return 'luxury';
        if (index < 5) return 'mid-range';
        return 'budget';
    }

    /**
     * Generate a single hotel with realistic data
     * @param {string} city - City name
     * @param {string} category - Hotel category
     * @param {Array} neighborhoods - Available neighborhoods
     * @param {number} index - Hotel index
     * @param {Object} options - Search options
     * @returns {Object} Hotel object
     */
    generateSingleHotel(city, category, neighborhoods, index, options) {
        const neighborhood = neighborhoods[index % neighborhoods.length];
        const hotelName = this.generateHotelName(city, category, neighborhood, index);

        const basePrice = this.getBasePriceByCategory(category);
        const priceVariation = 1 + (Math.random() * 0.3 - 0.15); // ±15%
        const finalPrice = Math.round(basePrice * priceVariation);
        const rating = this.getRatingByCategory(category);
        const availability = this.getAvailability(options);
        const amenities = this.getAmenitiesByCategory(category);
        const distanceKm = 0.5 + Math.random() * 5; // 0.5-5.5 km from center

        return {
            name: hotelName,
            category,
            rating: rating,
            reviewCount: Math.floor(Math.random() * 2000) + 500,
            price: {
                amount: finalPrice,
                currency: 'USD',
                display: `$${finalPrice}`,
                perNight: true
            },
            location: {
                neighborhood,
                city,
                distanceFromCenter: `${distanceKm.toFixed(1)} km`,
                walkScore: Math.floor(70 + Math.random() * 30) // 70-100
            },
            availability: availability,
            amenities: amenities,
            bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}`,
            images: 12 + Math.floor(Math.random() * 20), // 12-32 photos
            highlights: this.getHighlightsByCategory(category, neighborhood)
        };
    }

    /**
     * Generate realistic hotel name
     * @param {string} city - City name
     * @param {string} category - Hotel category
     * @param {string} neighborhood - Neighborhood name
     * @param {number} index - Hotel index
     * @returns {string} Hotel name
     */
    generateHotelName(city, category, neighborhood, index) {
        const templates = {
            'luxury': this.hotelTemplates.european,
            'mid-range': this.hotelTemplates.modern,
            'budget': this.hotelTemplates.budget
        };

        const template = templates[category] || this.hotelTemplates.modern;
        const baseName = template[index % template.length];

        if (Math.random() > 0.5 && neighborhood) {
            return `${neighborhood} ${baseName}`;
        }

        return `${city} ${baseName}`;
    }

    /**
     * Get base price by category
     * @param {string} category - Hotel category
     * @returns {number} Base price per night
     */
    getBasePriceByCategory(category) {
        const prices = {
            'luxury': 250 + Math.random() * 200,
            'mid-range': 100 + Math.random() * 100,
            'budget': 40 + Math.random() * 60
        };
        return prices[category] || 100;
    }

    /**
     * Get rating by category
     * @param {string} category - Hotel category
     * @returns {number} Rating (0-10)
     */
    getRatingByCategory(category) {
        const ratings = {
            'luxury': 8.5 + Math.random() * 1.3,
            'mid-range': 7.5 + Math.random() * 1.3,
            'budget': 6.5 + Math.random() * 1.5
        };
        return Math.round((ratings[category] || 7.5) * 10) / 10;
    }

    /**
     * Get availability status
     * @param {Object} options - Search options
     * @returns {Object} Availability info
     */
    getAvailability(options) {
        const available = Math.random() > 0.2;
        const roomsLeft = available ? Math.floor(Math.random() * 10) + 1 : 0;

        return {
            available,
            roomsLeft,
            message: available
                ? roomsLeft <= 3
                    ? `Only ${roomsLeft} rooms left!`
                    : `${roomsLeft} rooms available`
                : 'Sold out for these dates'
        };
    }

    /**
     * Get amenities by category
     * @param {string} category - Hotel category
     * @returns {Array} List of amenities
     */
    getAmenitiesByCategory(category) {
        const baseAmenities = ['Free WiFi', 'Air conditioning', '24-hour front desk'];

        const categoryAmenities = {
            'luxury': [...baseAmenities, 'Spa', 'Pool', 'Gym', 'Restaurant', 'Bar', 'Concierge', 'Room service', 'Valet parking'],
            'mid-range': [...baseAmenities, 'Gym', 'Restaurant', 'Bar', 'Business center', 'Breakfast included'],
            'budget': [...baseAmenities, 'Shared kitchen', 'Luggage storage', 'Tour desk']
        };

        const amenities = categoryAmenities[category] || categoryAmenities['mid-range'];

        const count = 5 + Math.floor(Math.random() * 4);
        return amenities.slice(0, count);
    }

    /**
     * Get highlights by category
     * @param {string} category - Hotel category
     * @param {string} neighborhood - Neighborhood name
     * @returns {Array} List of highlights
     */
    getHighlightsByCategory(category, neighborhood) {
        const highlights = {
            'luxury': [
                'Luxurious rooms with premium furnishings',
                'Exceptional service and attention to detail',
                `Prime location in ${neighborhood}`,
                'Recently renovated property'
            ],
            'mid-range': [
                'Modern, comfortable rooms',
                'Great value for money',
                `Walking distance to ${neighborhood} attractions`,
                'Highly rated by recent guests'
            ],
            'budget': [
                'Clean and basic accommodations',
                'Budget-friendly option',
                `Good transport links from ${neighborhood}`,
                'Popular with solo travelers'
            ]
        };

        return highlights[category] || highlights['mid-range'];
    }

    /**
     * Get booking tips for hotels
     * @param {string} city - City name
     * @returns {Array} Array of helpful tips
     */
    getBookingTips(city) {
        return [
            '💡 Book 2-4 weeks in advance for best rates',
            '📅 Weekday stays (Mon-Thu) are typically 20-30% cheaper than weekends',
            '🔍 Compare prices on Booking.com, Hotels.com, and Expedia',
            '⭐ Filter by guest rating (8.0+) for quality assurance',
            '📍 Stay near public transport to save on taxis',
            '💳 Check if your credit card offers hotel perks or points',
            '🍳 Hotels with breakfast included save $10-20 per day',
            '🔔 Set price alerts if your dates are flexible'
        ];
    }

    /**
     * Determine if query is about hotels
     * @param {string} message - User message
     * @returns {boolean}
     */
    shouldFetchHotels(message) {
        const messageLower = message.toLowerCase();

        const hotelKeywords = [
            'hotel', 'hotels', 'accommodation', 'where to stay',
            'place to stay', 'sleep', 'hostel', 'resort',
            'lodging', 'guesthouse', 'airbnb', 'booking'
        ];

        return hotelKeywords.some(keyword => messageLower.includes(keyword));
    }
}

let _hotelServiceInstance = null;

export const hotelService = new Proxy({}, {
    get(target, prop) {
        if (!_hotelServiceInstance) {
            _hotelServiceInstance = new HotelService();
        }
        return _hotelServiceInstance[prop];
    }
});
