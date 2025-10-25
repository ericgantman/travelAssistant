/**
 * Flight Search Service
 * Uses AviationStack API for flight data (free tier available)
 * For a completely free option, we provide general flight guidance
 * and use Skyscanner links for actual booking
 */

class FlightService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 43200000; // 12 hours

        // Major airport codes for common cities
        this.airportCodes = {
            'london': 'LHR', 'paris': 'CDG', 'new york': 'JFK', 'tokyo': 'NRT',
            'los angeles': 'LAX', 'dubai': 'DXB', 'singapore': 'SIN', 'hong kong': 'HKG',
            'bangkok': 'BKK', 'amsterdam': 'AMS', 'frankfurt': 'FRA', 'madrid': 'MAD',
            'barcelona': 'BCN', 'rome': 'FCO', 'milan': 'MXP', 'istanbul': 'IST',
            'sydney': 'SYD', 'melbourne': 'MEL', 'toronto': 'YYZ', 'vancouver': 'YVR',
            'chicago': 'ORD', 'san francisco': 'SFO', 'miami': 'MIA', 'boston': 'BOS',
            'seattle': 'SEA', 'atlanta': 'ATL', 'denver': 'DEN', 'las vegas': 'LAS',
            'berlin': 'BER', 'munich': 'MUC', 'zurich': 'ZRH', 'vienna': 'VIE',
            'prague': 'PRG', 'lisbon': 'LIS', 'athens': 'ATH', 'dublin': 'DUB',
            'stockholm': 'ARN', 'copenhagen': 'CPH', 'oslo': 'OSL', 'helsinki': 'HEL',
            'moscow': 'SVO', 'delhi': 'DEL', 'mumbai': 'BOM', 'shanghai': 'PVG',
            'beijing': 'PEK', 'seoul': 'ICN', 'taipei': 'TPE', 'kuala lumpur': 'KUL',
            'jakarta': 'CGK', 'manila': 'MNL', 'ho chi minh': 'SGN', 'hanoi': 'HAN',
            'cairo': 'CAI', 'johannesburg': 'JNB', 'cape town': 'CPT', 'nairobi': 'NBO',
            'sao paulo': 'GRU', 'rio de janeiro': 'GIG', 'buenos aires': 'EZE',
            'mexico city': 'MEX', 'lima': 'LIM', 'bogota': 'BOG', 'santiago': 'SCL'
        };
    }

    /**
     * Get flight information and recommendations
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @param {Object} options - Additional options (dates, passengers, class)
     * @returns {Promise<Object>} Flight information
     */
    async getFlightInfo(origin, destination, options = {}) {
        const cacheKey = `flight_${origin}_${destination}`.toLowerCase();

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            console.log(`✈️  Using cached flight data: ${origin} → ${destination}`);
            return cached.data;
        }

        try {
            const originCode = this.getAirportCode(origin);
            const destCode = this.getAirportCode(destination);

            // Calculate approximate flight duration
            const duration = this.estimateFlightDuration(origin, destination);

            // Get general flight tips
            const tips = this.getFlightTips(origin, destination, options);

            // Generate search URLs for popular booking sites
            const searchUrls = this.generateSearchUrls(originCode, destCode, options);

            const result = {
                route: `${origin} (${originCode}) → ${destination} (${destCode})`,
                estimatedDuration: duration,
                airlines: this.getCommonAirlines(origin, destination),
                bookingSites: searchUrls,
                tips: tips,
                bestTimeToBook: this.getBestBookingTime(destination),
                budgetTips: this.getBudgetFlightTips(),
                generalAdvice: [
                    'Book 2-3 months in advance for best prices',
                    'Tuesday and Wednesday are usually cheapest',
                    'Use incognito mode to avoid price tracking',
                    'Consider nearby airports for better deals',
                    'Be flexible with dates if possible'
                ]
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log(`✈️  Generated flight info: ${origin} → ${destination}`);
            return result;

        } catch (error) {
            console.error(`❌ Flight search error:`, error.message);
            return null;
        }
    }

    /**
     * Get airport code for a city
     * @param {string} city - City name
     * @returns {string} Airport code
     */
    getAirportCode(city) {
        const cityLower = city.toLowerCase();
        return this.airportCodes[cityLower] || city.substring(0, 3).toUpperCase();
    }

    /**
     * Estimate flight duration between cities
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @returns {string} Estimated duration
     */
    estimateFlightDuration(origin, destination) {
        // Simplified duration estimation based on common routes
        const longHaul = ['new york', 'los angeles', 'tokyo', 'sydney', 'singapore', 'dubai'];
        const originLower = origin.toLowerCase();
        const destLower = destination.toLowerCase();

        const isLongHaul = longHaul.some(city =>
            originLower.includes(city) || destLower.includes(city)
        );

        if (isLongHaul) {
            return '10-15 hours (long-haul)';
        } else {
            return '2-6 hours (short to medium-haul)';
        }
    }

    /**
     * Get common airlines for a route
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @returns {Array} Common airlines
     */
    getCommonAirlines(origin, destination) {
        // This is a simplified version - in a real app, you'd query actual data
        return [
            'Check multiple airlines for best prices',
            'Consider budget carriers for short routes',
            'Legacy carriers often better for long-haul',
            'Compare direct vs. connecting flights'
        ];
    }

    /**
     * Generate search URLs for booking sites
     * @param {string} originCode - Origin airport code
     * @param {string} destCode - Destination airport code
     * @param {Object} options - Search options
     * @returns {Object} Booking site URLs
     */
    generateSearchUrls(originCode, destCode, options = {}) {
        const today = new Date();
        const departDate = options.departDate ||
            new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 60 days from now

        return {
            skyscanner: `https://www.skyscanner.com/transport/flights/${originCode}/${destCode}/${departDate}`,
            kayak: `https://www.kayak.com/flights/${originCode}-${destCode}/${departDate}`,
            googleFlights: `https://www.google.com/travel/flights?q=flights%20from%20${originCode}%20to%20${destCode}`,
            note: 'Links will open with approximate dates - adjust as needed'
        };
    }

    /**
     * Get flight booking tips
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @param {Object} options - Additional options
     * @returns {Array} Flight tips
     */
    getFlightTips(origin, destination, options) {
        const tips = [];

        // Seasonal tips
        tips.push('Consider off-peak seasons for cheaper flights');

        // Booking window
        tips.push('International flights: book 2-3 months ahead');
        tips.push('Domestic flights: book 3-6 weeks ahead');

        // Day of week
        tips.push('Fly mid-week (Tue-Thu) for lower prices');

        // Search tips
        tips.push('Clear browser cookies or use incognito mode');
        tips.push('Set price alerts on multiple sites');

        return tips;
    }

    /**
     * Get best booking time for destination
     * @param {string} destination - Destination city
     * @returns {string} Best booking time
     */
    getBestBookingTime(destination) {
        return '6-8 weeks before departure for domestic, 2-3 months for international';
    }

    /**
     * Get budget flight tips
     * @returns {Array} Budget tips
     */
    getBudgetFlightTips() {
        return [
            'Consider nearby airports (can save 30-50%)',
            'Book one-way tickets separately sometimes cheaper',
            'Join airline newsletters for deals',
            'Use credit card points if available',
            'Pack light to avoid baggage fees',
            'Bring your own food and water bottle'
        ];
    }

    /**
     * Extract flight details from user message
     * @param {string} message - User message
     * @returns {Object|null} Extracted flight details
     */
    extractFlightDetails(message) {
        // Look for patterns like "flights from Paris to Tokyo"
        const patterns = [
            /flights? (?:from|out of) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) to ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            /(?:fly|flying|travel|traveling) from ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) to ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            /how to get from ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) to ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1] && match[2]) {
                return {
                    origin: match[1],
                    destination: match[2]
                };
            }
        }

        return null;
    }

    /**
     * Determine if query is about flights
     * @param {string} message - User message
     * @returns {boolean}
     */
    shouldFetchFlights(message) {
        const messageLower = message.toLowerCase();

        const flightKeywords = [
            'flight', 'flights', 'fly', 'flying', 'airline',
            'airport', 'plane', 'ticket', 'airfare',
            'how to get to', 'travel to', 'get from'
        ];

        return flightKeywords.some(keyword => messageLower.includes(keyword));
    }
}

export const flightService = new FlightService();
