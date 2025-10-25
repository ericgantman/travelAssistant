/**
 * Hotel Search Service
 * Uses OpenTripMap API (free tier, requires API key but free registration)
 * Alternative: For a completely free option without registration, we'll use
 * a combination of Wikivoyage for recommendations
 * https://www.opentripmap.com/
 */

const WIKIVOYAGE_API = 'https://en.wikivoyage.org/w/api.php';

class HotelService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 86400000; // 24 hours
    }

    /**
     * Get hotel recommendations for a city
     * @param {string} city - City name
     * @returns {Promise<Object>} Hotel recommendations
     */
    async getHotelRecommendations(city) {
        const cacheKey = `hotels_${city.toLowerCase()}`;

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            console.log(`🏨 Using cached hotel data for: ${city}`);
            return cached.data;
        }

        try {
            // Search for the city page on Wikivoyage
            const searchUrl = `${WIKIVOYAGE_API}?action=query&list=search&srsearch=${encodeURIComponent(city)}&format=json`;
            const searchResponse = await fetch(searchUrl);

            if (!searchResponse.ok) {
                throw new Error(`Wikivoyage API error: ${searchResponse.status}`);
            }

            const searchData = await searchResponse.json();

            if (!searchData.query?.search?.[0]) {
                return null;
            }

            const pageTitle = searchData.query.search[0].title;

            // Get the page content
            const contentUrl = `${WIKIVOYAGE_API}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts&exintro=true&explaintext=true&format=json`;
            const contentResponse = await fetch(contentUrl);

            if (!contentResponse.ok) {
                throw new Error(`Wikivoyage API error: ${contentResponse.status}`);
            }

            const contentData = await contentResponse.json();

            const pages = contentData.query?.pages;
            if (!pages) {
                return null;
            }

            const pageId = Object.keys(pages)[0];
            const extract = pages[pageId]?.extract || '';

            // Extract accommodation information
            const accommodationInfo = this.parseAccommodationInfo(extract, city);

            const result = {
                city: city,
                source: 'Wikivoyage',
                recommendations: accommodationInfo.recommendations,
                budgetTips: accommodationInfo.budgetTips,
                areas: accommodationInfo.areas,
                generalInfo: accommodationInfo.generalInfo
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log(`🏨 Fetched hotel recommendations for: ${city}`);
            return result;

        } catch (error) {
            console.error(`❌ Hotel search error:`, error.message);
            return null;
        }
    }

    /**
     * Parse accommodation information from Wikivoyage text
     * @param {string} text - Wikivoyage page text
     * @param {string} city - City name
     * @returns {Object} Parsed accommodation info
     */
    parseAccommodationInfo(text, city) {
        const recommendations = [];
        const budgetTips = [];
        const areas = [];
        let generalInfo = '';

        // Look for accommodation-related keywords
        const accommodationKeywords = [
            'hotel', 'hostel', 'accommodation', 'lodging', 'stay',
            'guesthouse', 'resort', 'inn', 'motel', 'apartment'
        ];

        const budgetKeywords = [
            'budget', 'cheap', 'affordable', 'inexpensive', 'hostel',
            'mid-range', 'luxury', 'expensive', 'upscale'
        ];

        const textLower = text.toLowerCase();

        // Extract general accommodation info
        if (textLower.includes('sleep') || textLower.includes('stay')) {
            const sleepSection = text.substring(
                Math.max(0, textLower.indexOf('sleep') - 100),
                Math.min(text.length, textLower.indexOf('sleep') + 300)
            );
            generalInfo = sleepSection.trim();
        }

        // Check for budget information
        budgetKeywords.forEach(keyword => {
            if (textLower.includes(keyword)) {
                const contextStart = Math.max(0, textLower.indexOf(keyword) - 50);
                const contextEnd = Math.min(text.length, textLower.indexOf(keyword) + 150);
                const context = text.substring(contextStart, contextEnd).trim();

                if (context && !budgetTips.includes(context)) {
                    budgetTips.push(context);
                }
            }
        });

        // Extract neighborhood/area information
        const neighborhoodPatterns = [
            /in (?:the )?([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:district|area|neighborhood|quarter)/g,
            /([A-Z][a-z]+(?: [A-Z][a-z]+)*) is (?:a )?(?:good|great|popular) (?:area|place) to stay/g
        ];

        neighborhoodPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (match[1] && !areas.includes(match[1])) {
                    areas.push(match[1]);
                }
            }
        });

        // Default recommendations if we can't extract specific info
        if (recommendations.length === 0) {
            recommendations.push(`Check popular booking sites for ${city} accommodations`);
            recommendations.push(`Look for hotels in central/downtown ${city} for easy access to attractions`);
            recommendations.push(`Consider hostels or guesthouses for budget-friendly options`);
        }

        return {
            recommendations: recommendations.slice(0, 5),
            budgetTips: budgetTips.slice(0, 3),
            areas: areas.slice(0, 5),
            generalInfo: generalInfo.substring(0, 200)
        };
    }

    /**
     * Extract city name from user message
     * @param {string} message - User message
     * @returns {string|null} Extracted city
     */
    extractCity(message) {
        // Look for patterns like "hotels in Paris", "stay in Tokyo"
        const patterns = [
            /hotels? (?:in|at|near) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            /(?:stay|sleep|accommodation) (?:in|at|near) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            /where to stay in ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            /(?:visiting|going to|traveling to) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        // Fallback: look for any capitalized word
        const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/;
        const match = message.match(capitalizedPattern);
        return match ? match[1] : null;
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

    /**
     * Get budget category suggestions
     * @param {string} budgetLevel - budget, mid-range, or luxury
     * @returns {Object} Budget suggestions
     */
    getBudgetSuggestions(budgetLevel) {
        const suggestions = {
            'budget': {
                range: '$20-50 per night',
                types: ['Hostels', 'Budget hotels', 'Guesthouses', 'Shared rooms'],
                tips: [
                    'Look for hostels with good reviews',
                    'Consider shared dormitories for lowest prices',
                    'Book directly with properties for best rates',
                    'Stay slightly outside city center for better value'
                ]
            },
            'mid-range': {
                range: '$50-150 per night',
                types: ['3-star hotels', 'Boutique hotels', 'Private rooms in good areas'],
                tips: [
                    'Book in advance for better rates',
                    'Look for hotels with breakfast included',
                    'Check for central locations with good transport links',
                    'Read recent reviews on multiple platforms'
                ]
            },
            'luxury': {
                range: '$150+ per night',
                types: ['4-5 star hotels', 'Luxury resorts', 'High-end boutique hotels'],
                tips: [
                    'Look for special packages and offers',
                    'Consider loyalty programs for perks',
                    'Book suites or rooms with views',
                    'Check for included amenities (spa, breakfast, transfers)'
                ]
            }
        };

        return suggestions[budgetLevel] || suggestions['mid-range'];
    }
}

export const hotelService = new HotelService();
