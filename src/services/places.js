/**
 * Places & Attractions Service
 * Uses SerpAPI (Google Maps) for real place data - restaurants, attractions, things to do
 */

import axios from 'axios';

class PlacesService {
    constructor() {
        this.apiKey = process.env.SERPAPI_KEY || null;
        this.apiBaseUrl = 'https://serpapi.com/search.json';
        this.devMode = process.env.PLACES_DEV_MODE === 'true' || process.env.FLIGHT_DEV_MODE === 'true';
        this.cache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000;
    }

    /**
     * Search for places (restaurants, attractions, activities) in a city
     * @param {string} city - City name
     * @param {object} options - Search options
     * @returns {object} Places data with real info from Google Maps
     */
    async searchPlaces(city, options = {}) {
        const {
            type = 'attractions', // 'restaurants', 'attractions', 'things_to_do'
            query = null, // Optional specific query like "italian restaurants"
            maxResults = 10
        } = options;

        // Build cache key
        const cacheKey = `places_${city}_${type}_${query || 'default'}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        // Try to get real data from SerpAPI (Google Maps)
        if (this.apiKey && !this.devMode) {
            try {
                const realData = await this.fetchRealPlacesData(city, type, query, maxResults);

                // Cache the result
                this.cache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: realData
                });

                return realData;
            } catch (error) {
                console.error('❌ Error fetching real places data:', error.message);
            }
        }

        return this.generateSamplePlacesData(city, type);
    }

    /**
     * Fetch real places data from SerpAPI (Google Maps)
     * @private
     */
    async fetchRealPlacesData(city, type, customQuery, maxResults) {
        // Build search query based on type
        let searchQuery = customQuery;
        if (!searchQuery) {
            const queryMap = {
                'restaurants': `best restaurants in ${city}`,
                'attractions': `top attractions in ${city}`,
                'things_to_do': `things to do in ${city}`,
                'cafes': `best cafes in ${city}`,
                'bars': `best bars in ${city}`,
                'shopping': `shopping in ${city}`,
                'museums': `museums in ${city}`,
                'parks': `parks in ${city}`
            };
            searchQuery = queryMap[type] || `places in ${city}`;
        }

        const params = {
            engine: 'google_maps',
            q: searchQuery,
            api_key: this.apiKey,
            type: 'search',
            ll: '@40.7455096,-74.0083012,14z', // Will be overridden by query location
        };

        try {
            const response = await axios.get(this.apiBaseUrl, {
                params,
                timeout: 10000
            });

            const data = response.data;

            // Check for errors
            if (data.error) {
                console.error('❌ SerpAPI error:', data.error);
                throw new Error(data.error);
            }

            // Check for local results (places)
            if (!data.local_results || data.local_results.length === 0) {
                throw new Error('No places found');
            }

            const places = data.local_results.slice(0, maxResults).map((place, index) => {
                // Extract price level ($ to $$$$)
                const priceLevel = place.price || '$$';

                // Extract rating
                const rating = place.rating || 4.0;
                const reviews = place.reviews || 0;

                // Extract address
                const address = place.address || 'Address not available';

                // Extract type/category
                const category = place.type || type;

                // Extract description/snippet
                const description = place.description ||
                    place.snippet ||
                    `Popular ${category} in ${city}`;

                // Extract hours (if available)
                const hours = place.hours || place.service_options || null;
                const isOpen = place.open_state?.includes('Open') || null;

                // Build Google Maps link
                const mapsUrl = place.link ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title + ' ' + city)}`;

                return {
                    name: place.title,
                    rating: {
                        score: rating,
                        reviews: reviews,
                        display: `${rating}/5 (${reviews.toLocaleString()} reviews)`
                    },
                    priceLevel: priceLevel,
                    category: category,
                    address: address,
                    description: description,
                    location: {
                        lat: place.gps_coordinates?.latitude,
                        lng: place.gps_coordinates?.longitude
                    },
                    hours: hours,
                    isOpen: isOpen,
                    phone: place.phone || null,
                    website: place.website || null,
                    mapsUrl: mapsUrl,
                    thumbnail: place.thumbnail || null,
                    rank: index + 1
                };
            });

            return {
                success: true,
                city: city,
                searchType: type,
                searchQuery: searchQuery,
                totalResults: places.length,
                dataSource: 'live',
                note: 'Real data from Google Maps',
                places: places,
                tips: this.getPlaceTips(city, type)
            };

        } catch (error) {
            // Handle quota exceeded (429 error)
            if (error.response?.status === 429) {
                console.error('❌ SerpAPI quota exceeded. Enable dev mode to use sample data.');
                throw new Error('API quota exceeded. Please try again later.');
            }

            // Handle bad request (400 error)
            if (error.response?.status === 400) {
                console.error('❌ Bad request to SerpAPI:', error.response?.data);
                throw new Error('Invalid search parameters');
            }

            throw error;
        }
    }

    /**
     * Generate sample places data (fallback when API unavailable)
     * @private
     */
    generateSamplePlacesData(city, type) {
        const samplePlaces = {
            restaurants: [
                { name: 'Local Cuisine Restaurant', rating: 4.5, price: '$$', category: 'Local cuisine' },
                { name: 'Italian Trattoria', rating: 4.3, price: '$$$', category: 'Italian' },
                { name: 'Street Food Market', rating: 4.7, price: '$', category: 'Street food' },
                { name: 'Fine Dining Experience', rating: 4.8, price: '$$$$', category: 'Fine dining' },
                { name: 'Cozy Bistro', rating: 4.4, price: '$$', category: 'Bistro' }
            ],
            attractions: [
                { name: 'Historic City Center', rating: 4.6, price: 'Free', category: 'Historic site' },
                { name: 'Famous Museum', rating: 4.7, price: '$$', category: 'Museum' },
                { name: 'Scenic Viewpoint', rating: 4.8, price: 'Free', category: 'Viewpoint' },
                { name: 'Cultural Monument', rating: 4.5, price: '$', category: 'Monument' },
                { name: 'Beautiful Park', rating: 4.4, price: 'Free', category: 'Park' }
            ],
            things_to_do: [
                { name: 'Walking Tour', rating: 4.6, price: '$$', category: 'Tour' },
                { name: 'Local Market Visit', rating: 4.5, price: '$', category: 'Shopping' },
                { name: 'Cooking Class', rating: 4.7, price: '$$$', category: 'Activity' },
                { name: 'Bike Tour', rating: 4.4, price: '$$', category: 'Tour' },
                { name: 'River Cruise', rating: 4.8, price: '$$$', category: 'Activity' }
            ]
        };

        const placesData = samplePlaces[type] || samplePlaces.attractions;

        const places = placesData.map((place, index) => ({
            name: place.name,
            rating: {
                score: place.rating,
                reviews: Math.floor(Math.random() * 5000) + 100,
                display: `${place.rating}/5`
            },
            priceLevel: place.price,
            category: place.category,
            address: `${city} - Check Google Maps for exact location`,
            description: `Highly rated ${place.category.toLowerCase()} in ${city}`,
            location: null,
            hours: 'Check online for current hours',
            isOpen: null,
            phone: null,
            website: null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + city)}`,
            thumbnail: null,
            rank: index + 1,
            note: 'Sample data - enable SerpAPI for real information'
        }));

        return {
            success: true,
            city: city,
            searchType: type,
            totalResults: places.length,
            dataSource: 'sample',
            note: 'Sample data - Add SERPAPI_KEY to .env for real Google Maps data',
            places: places,
            tips: this.getPlaceTips(city, type)
        };
    }

    /**
     * Get tips for places based on type
     * @private
     */
    getPlaceTips(city, type) {
        const tipMap = {
            restaurants: [
                'Book popular restaurants in advance, especially on weekends',
                'Try local specialties for an authentic experience',
                'Check if restaurants accept credit cards - some may be cash only',
                'Look for lunch specials (often better value than dinner)'
            ],
            attractions: [
                'Visit popular attractions early morning or late afternoon to avoid crowds',
                'Consider purchasing city passes for multiple attractions',
                'Check for free entry days or discounted evening tickets',
                'Book skip-the-line tickets online to save time'
            ],
            things_to_do: [
                'Book tours and activities in advance during peak season',
                'Check weather forecasts for outdoor activities',
                'Read recent reviews to ensure quality',
                'Ask about group discounts if traveling with others'
            ],
            cafes: [
                'Local cafes often have better prices than tourist areas',
                'Try the local coffee or tea specialties',
                'Cafes are great places to rest and people-watch',
                'Many cafes offer free WiFi - good for planning your day'
            ],
            bars: [
                'Happy hours usually offer significant discounts',
                'Ask locals for their favorite spots - often better than touristy bars',
                'Check dress codes for upscale venues',
                'Try local beers or cocktails for authentic experience'
            ]
        };

        return tipMap[type] || tipMap.attractions;
    }

    /**
     * Search for restaurants specifically
     */
    async searchRestaurants(city, cuisine = null) {
        const query = cuisine ? `${cuisine} restaurants in ${city}` : null;
        return this.searchPlaces(city, {
            type: 'restaurants',
            query: query,
            maxResults: 10
        });
    }

    /**
     * Search for attractions specifically
     */
    async searchAttractions(city) {
        return this.searchPlaces(city, {
            type: 'attractions',
            maxResults: 10
        });
    }

    /**
     * Search for things to do
     */
    async searchThingsToDo(city) {
        return this.searchPlaces(city, {
            type: 'things_to_do',
            maxResults: 10
        });
    }

    /**
     * Search for specific type of place (cafes, museums, parks, etc.)
     */
    async searchSpecific(city, placeType) {
        return this.searchPlaces(city, {
            type: placeType,
            maxResults: 10
        });
    }
}

// Export class and create singleton lazily
let _placesServiceInstance = null;

export const placesService = new Proxy({}, {
    get(target, prop) {
        if (!_placesServiceInstance) {
            _placesServiceInstance = new PlacesService();
        }
        return _placesServiceInstance[prop];
    }
});
