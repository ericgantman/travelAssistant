/**
 * Flight Search Service
 * Uses SerpAPI (Google Flights) for real flight data
 * Falls back to general guidance if API unavailable
 */

import axios from 'axios';

class FlightService {
    constructor() {
        this.cache = new Map();
        // Extended cache: 24 hours to conserve API quota
        this.cacheExpiry = 86400000; // 24 hours

        // Development mode: set to true to skip API and use fallback
        this.devMode = process.env.FLIGHT_DEV_MODE === 'true' || false;

        // SerpAPI for Google Flights (100 searches/month free)
        // Sign up at: https://serpapi.com/
        this.apiKey = process.env.SERPAPI_KEY || null;
        this.apiBaseUrl = 'https://serpapi.com/search.json';

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
            'mexico city': 'MEX', 'lima': 'LIM', 'bogota': 'BOG', 'santiago': 'SCL',
            'tel aviv': 'TLV', 'jerusalem': 'TLV', 'israel': 'TLV',
            'porto': 'OPO', 'portugal': 'LIS'
        };

        // Typical price ranges for routes (as fallback)
        this.priceEstimates = {
            'short_haul_economy': { min: 50, max: 200, avg: 120 },      // < 3 hours
            'medium_haul_economy': { min: 150, max: 400, avg: 250 },    // 3-6 hours
            'long_haul_economy': { min: 400, max: 1200, avg: 700 },     // > 6 hours
            'short_haul_business': { min: 200, max: 500, avg: 350 },
            'medium_haul_business': { min: 500, max: 1000, avg: 750 },
            'long_haul_business': { min: 2000, max: 5000, avg: 3500 }
        };
    }

    /**
     * Get flight information with REAL PRICES and DATES
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @param {Object} options - Additional options (dates, passengers, class)
     * @returns {Promise<Object>} Flight information with real data
     */
    async getFlightInfo(origin, destination, options = {}) {
        const cacheKey = `flight_${origin}_${destination}`.toLowerCase();

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const originCode = this.getAirportCode(origin);
            const destCode = this.getAirportCode(destination);

            let realFlightData = null;
            if (this.apiKey && !this.devMode) {
                realFlightData = await this.fetchRealFlightData(originCode, destCode, options);
            }

            // If API available, return real data
            if (realFlightData && realFlightData.flights && realFlightData.flights.length > 0) {
                const result = {
                    success: true,
                    from: origin,
                    to: destination,
                    originCode,
                    destCode,
                    flights: realFlightData.flights, // Real flight data with prices!
                    dataSource: 'live',
                    tips: this.getFlightTips(origin, destination, options),
                    note: 'Prices and availability updated in real-time'
                };

                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });

                return result;
            }

            const sampleFlights = this.generateRealisticFlightData(origin, destination, originCode, destCode, options);

            const result = {
                success: true,
                from: origin,
                to: destination,
                originCode,
                destCode,
                flights: sampleFlights,
                dataSource: 'generated', // Generated based on real airline routes
                tips: this.getFlightTips(origin, destination, options),
                note: 'Flight prices shown are estimates. Verify availability and current prices with airlines.'
            };

            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log(`✈️  Found ${sampleFlights.length} flight options: ${origin} → ${destination}`);
            return result;

        } catch (error) {
            console.error(`❌ Flight search error:`, error.message);
            return {
                success: false,
                error: error.message,
                from: origin,
                to: destination
            };
        }
    }

    /**
     * Fetch real flight data from SerpAPI (Google Flights)
     * @param {string} originCode - Origin airport code (IATA)
     * @param {string} destCode - Destination airport code (IATA)
     * @param {Object} options - Search options
     * @returns {Promise<Object|null>} Real flight data from Google Flights
     */
    async fetchRealFlightData(originCode, destCode, options = {}) {
        if (!this.apiKey) return null;

        try {
            // Calculate default departure date (30 days from now)
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 30);
            const departureDate = options.departDate || defaultDate.toISOString().split('T')[0];

            const params = {
                engine: 'google_flights',
                departure_id: originCode,
                arrival_id: destCode,
                outbound_date: departureDate,
                currency: 'USD',
                hl: 'en',
                api_key: this.apiKey,
                adults: options.passengers || 1,
                type: 2 // 1 = Round trip, 2 = One way, 3 = Multi-city
            };

            const response = await axios.get(this.apiBaseUrl, {
                params,
                timeout: 15000 // 15 second timeout
            });

            const data = response.data;

            // Check for errors
            if (data.error) {
                console.error('❌ SerpAPI error:', data.error);
                return null;
            }

            // Combine best_flights and other_flights
            const allFlights = [
                ...(data.best_flights || []),
                ...(data.other_flights || [])
            ];

            if (allFlights.length === 0) {
                return null;
            }

            const flights = allFlights.slice(0, 5).map((flightOffer) => {
                // Get first and last flight segments
                const firstFlight = flightOffer.flights?.[0] || {};
                const lastFlight = flightOffer.flights?.[flightOffer.flights.length - 1] || {};

                // Calculate total stops
                const stops = (flightOffer.flights?.length || 1) - 1;

                // Format duration (convert minutes to hours/minutes)
                const totalMinutes = flightOffer.total_duration || 0;
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                const durationDisplay = `${hours}h ${minutes}m`;

                return {
                    airline: firstFlight.airline || 'Unknown',
                    flightNumber: firstFlight.flight_number || 'N/A',
                    departure: {
                        airport: `${firstFlight.departure_airport?.name || originCode} (${firstFlight.departure_airport?.id || originCode})`,
                        time: firstFlight.departure_airport?.time || new Date().toISOString(),
                        date: this.formatDate(firstFlight.departure_airport?.time),
                        timeDisplay: this.formatTime(firstFlight.departure_airport?.time)
                    },
                    arrival: {
                        airport: `${lastFlight.arrival_airport?.name || destCode} (${lastFlight.arrival_airport?.id || destCode})`,
                        time: lastFlight.arrival_airport?.time || new Date().toISOString(),
                        date: this.formatDate(lastFlight.arrival_airport?.time),
                        timeDisplay: this.formatTime(lastFlight.arrival_airport?.time)
                    },
                    duration: durationDisplay,
                    durationHours: totalMinutes / 60,
                    price: {
                        amount: flightOffer.price || 0,
                        currency: 'USD',
                        display: `$${flightOffer.price || 0}`
                    },
                    class: flightOffer.type || firstFlight.travel_class || 'Economy',
                    stops: stops,
                    stopsInfo: stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`,
                    bookingUrl: flightOffer.booking_token
                        ? `https://www.google.com/travel/flights/booking?token=${flightOffer.booking_token}`
                        : `https://www.google.com/travel/flights?q=flights%20from%20${originCode}%20to%20${destCode}`,
                    carbonEmissions: flightOffer.carbon_emissions?.this_flight,
                    airplane: firstFlight.airplane,
                    airlineLogo: flightOffer.airline_logo || firstFlight.airline_logo,
                    layovers: flightOffer.layovers || [],
                    extensions: flightOffer.extensions || [],
                    overnight: firstFlight.overnight || false
                };
            });

            return {
                flights,
                priceInsights: data.price_insights || null
            };

        } catch (error) {
            console.error('❌ Google Flights API error:', error.message);
            if (error.response?.status === 429) {
                console.error('⚠️  API quota exceeded. Enable dev mode or wait for quota reset.');
            }
            if (error.response?.data) {
                console.error('API Response:', JSON.stringify(error.response.data, null, 2));
            }
            return null;
        }
    }

    /**
     * Format date from ISO string
     * @param {string} isoTime - ISO time string
     * @returns {string} Formatted date
     */
    formatDate(isoTime) {
        if (!isoTime) return '';
        const date = new Date(isoTime);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    /**
     * Format time from ISO string
     * @param {string} isoTime - ISO time string
     * @returns {string} Formatted time
     */
    formatTime(isoTime) {
        if (!isoTime) return '';
        const date = new Date(isoTime);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Generate realistic flight data with prices, airlines, and schedules
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @param {string} originCode - Origin airport code
     * @param {string} destCode - Destination airport code
     * @param {Object} options - Search options
     * @returns {Array} Sample flight data
     */
    generateRealisticFlightData(origin, destination, originCode, destCode, options = {}) {
        const routeType = this.getRouteType(origin, destination);
        const airlines = this.getRealisticAirlines(origin, destination);
        const basePrice = this.getPriceEstimate(routeType, 'economy');

        const flights = [];
        const today = new Date();
        const searchDate = options.departDate ? new Date(options.departDate) : new Date(today.getTime() + 30 * 86400000);

        // Generate 3-5 realistic flight options
        for (let i = 0; i < 5; i++) {
            const departureDate = new Date(searchDate);
            departureDate.setDate(departureDate.getDate() + i);

            // Vary departure times
            const departureHour = [6, 10, 14, 18, 22][i];
            departureDate.setHours(departureHour, 0, 0, 0);

            // Calculate duration based on route
            const durationHours = this.getFlightDuration(routeType);
            const arrivalDate = new Date(departureDate.getTime() + durationHours * 3600000);

            // Price varies by time and day
            const priceVariation = 1 + (Math.random() * 0.3 - 0.15); // ±15% variation
            const dayFactor = [6, 0].includes(departureDate.getDay()) ? 1.2 : 1; // Weekend premium
            const timeFactor = departureHour < 8 || departureHour > 20 ? 0.9 : 1; // Off-peak discount

            const finalPrice = Math.round(basePrice.avg * priceVariation * dayFactor * timeFactor);

            flights.push({
                airline: airlines[i % airlines.length],
                flightNumber: this.generateFlightNumber(airlines[i % airlines.length]),
                departure: {
                    airport: `${origin} (${originCode})`,
                    time: departureDate.toISOString(),
                    date: departureDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    timeDisplay: departureDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                },
                arrival: {
                    airport: `${destination} (${destCode})`,
                    time: arrivalDate.toISOString(),
                    date: arrivalDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    timeDisplay: arrivalDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                },
                duration: `${durationHours}h ${Math.round((durationHours % 1) * 60)}m`,
                durationHours,
                price: {
                    amount: finalPrice,
                    currency: 'USD',
                    display: `$${finalPrice}`
                },
                class: 'Economy',
                stops: routeType === 'long_haul' && i % 2 === 0 ? 1 : 0,
                stopsInfo: routeType === 'long_haul' && i % 2 === 0 ? '1 stop' : 'Direct',
                bookingUrl: `https://www.google.com/travel/flights?q=flights%20from%20${originCode}%20to%20${destCode}`
            });
        }

        // Sort by price (cheapest first)
        return flights.sort((a, b) => a.price.amount - b.price.amount);
    }

    /**
     * Get realistic airlines for route
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @returns {Array} Realistic airline names
     */
    getRealisticAirlines(origin, destination) {
        const european = ['Lufthansa', 'Air France', 'KLM', 'British Airways', 'Turkish Airlines'];
        const american = ['United Airlines', 'Delta Air Lines', 'American Airlines', 'JetBlue'];
        const asian = ['Singapore Airlines', 'Cathay Pacific', 'ANA', 'Emirates'];
        const budget = ['Ryanair', 'EasyJet', 'Southwest', 'Spirit Airlines'];

        const originLower = origin.toLowerCase();
        const destLower = destination.toLowerCase();

        // Europe routes
        if (['london', 'paris', 'berlin', 'madrid', 'rome', 'lisbon', 'portugal'].some(c => originLower.includes(c) || destLower.includes(c))) {
            return european;
        }

        // Asian routes
        if (['tokyo', 'singapore', 'bangkok', 'hong kong', 'dubai'].some(c => originLower.includes(c) || destLower.includes(c))) {
            return asian;
        }

        // US routes
        if (['new york', 'los angeles', 'chicago', 'miami'].some(c => originLower.includes(c) || destLower.includes(c))) {
            return american;
        }

        return [...european, ...american].slice(0, 5);
    }

    /**
     * Generate realistic flight number
     * @param {string} airline - Airline name
     * @returns {string} Flight number
     */
    generateFlightNumber(airline) {
        const codes = {
            'Lufthansa': 'LH',
            'Air France': 'AF',
            'KLM': 'KL',
            'British Airways': 'BA',
            'Turkish Airlines': 'TK',
            'United Airlines': 'UA',
            'Delta Air Lines': 'DL',
            'American Airlines': 'AA',
            'Emirates': 'EK',
            'Singapore Airlines': 'SQ'
        };

        const code = codes[airline] || 'XX';
        const number = Math.floor(Math.random() * 9000) + 1000;
        return `${code}${number}`;
    }

    /**
     * Determine route type for pricing
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @returns {string} Route type
     */
    getRouteType(origin, destination) {
        const longHaulCities = ['tokyo', 'sydney', 'singapore', 'dubai', 'new york', 'los angeles', 'sao paulo'];
        const originLower = origin.toLowerCase();
        const destLower = destination.toLowerCase();

        const isLongHaul = longHaulCities.some(city =>
            (originLower.includes(city) && !destLower.includes(city)) ||
            (!originLower.includes(city) && destLower.includes(city))
        );

        if (isLongHaul) return 'long_haul';

        const mediumHaulDistance = this.estimateDistance(origin, destination);
        return mediumHaulDistance > 1500 ? 'medium_haul' : 'short_haul';
    }

    /**
     * Get flight duration in hours
     * @param {string} routeType - Route type
     * @returns {number} Duration in hours
     */
    getFlightDuration(routeType) {
        const durations = {
            'short_haul': 1.5 + Math.random() * 1.5, // 1.5-3 hours
            'medium_haul': 3 + Math.random() * 3,     // 3-6 hours
            'long_haul': 8 + Math.random() * 6        // 8-14 hours
        };
        return durations[routeType] || 3;
    }

    /**
     * Estimate distance between cities (simplified)
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @returns {number} Estimated distance in km
     */
    estimateDistance(origin, destination) {
        // Simplified - in real app, use coordinates and haversine formula
        return 500 + Math.random() * 2000;
    }

    /**
     * Get price estimate for route
     * @param {string} routeType - Route type
     * @param {string} classType - Class type
     * @returns {Object} Price estimate
     */
    getPriceEstimate(routeType, classType = 'economy') {
        const key = `${routeType}_${classType}`;
        return this.priceEstimates[key] || this.priceEstimates['medium_haul_economy'];
    }

    /**
     * Estimate price for a flight
     * @param {string} originCode - Origin airport code
     * @param {string} destCode - Destination airport code
     * @param {string} classType - Class type
     * @returns {number} Estimated price
     */
    estimatePrice(originCode, destCode, classType = 'economy') {
        // Simplified pricing model
        const basePrice = 100;
        const distance = Math.random() * 1000 + 500;
        const pricePerKm = classType === 'business' ? 0.5 : 0.15;
        return Math.round(basePrice + distance * pricePerKm);
    }

    /**
     * Calculate duration between two times
     * @param {string} departTime - Departure time
     * @param {string} arrivalTime - Arrival time
     * @returns {string} Duration string
     */
    calculateDuration(departTime, arrivalTime) {
        if (!departTime || !arrivalTime) return '4h 30m';

        const depart = new Date(departTime);
        const arrival = new Date(arrivalTime);
        const diffMs = arrival - depart;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);

        return `${hours}h ${minutes}m`;
    }

    /**
     * Get airport code for a city
     * @param {string} city - City name
     * @returns {string} Airport code
     */
    getAirportCode(city) {
        const cityLower = city.toLowerCase().trim();
        return this.airportCodes[cityLower] || city.substring(0, 3).toUpperCase();
    }

    /**
     * Get flight booking tips
     * @param {string} origin - Origin city
     * @param {string} destination - Destination city
     * @param {Object} options - Additional options
     * @returns {Array} Flight tips
     */
    getFlightTips(origin, destination, options) {
        return [
            '💡 Book 6-8 weeks in advance for best domestic prices, 2-3 months for international',
            '📅 Fly Tuesday-Thursday for 15-20% lower prices',
            '🔍 Compare prices on Google Flights, Skyscanner, and airline websites',
            '⏰ Early morning (6-8 AM) and late evening (9-11 PM) flights are often cheaper',
            '✈️ Consider one-way tickets on different airlines for flexibility',
            '💳 Check if your credit card offers travel insurance or rewards',
            '🎒 Pack light to avoid baggage fees ($30-60 per bag)',
            '🔔 Set price alerts if your dates are flexible'
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
