/**
 * LangChain Custom Tools for Travel Assistant
 * These tools wrap our existing services and provide structured interfaces for the agent
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { weatherService } from '../services/weather.js';
import { countryService } from '../services/country.js';
import { currencyService } from '../services/currency.js';
import { hotelService } from '../services/hotels.js';
import { flightService } from '../services/flights.js';

/**
 * Weather Information Tool
 * Fetches current weather data for a given location
 */
export const weatherTool = new DynamicStructuredTool({
    name: "get_weather",
    description: `Fetches current real-time weather data for any location worldwide.
    
    ALWAYS use this tool when the user asks about:
    - Weather conditions: "what's the weather in Paris?", "how warm is Tokyo?"
    - Packing advice: "what should I pack for Iceland?", "what to bring to Bali?"
    - Temperature queries: "is it cold in Moscow?", "current temperature in Sydney"
    - Climate-related planning: "what to wear in London?", "is it raining in Seattle?"
    
    Returns complete weather data including:
    - Current temperature in Celsius
    - Weather condition (clear, cloudy, rainy, etc.)
    - Humidity percentage
    - Wind speed in km/h
    - "Feels like" temperature
    
    Important: This tool provides REAL current data. Never guess or estimate weather information when this tool is available.`,

    schema: z.object({
        location: z.string().describe("The city or location name to get weather for (e.g., 'Paris', 'Tokyo', 'New York')"),
        reasoning: z.string().describe("Brief explanation of why you're fetching weather data for this query")
    }),

    func: async ({ location, reasoning }) => {
        try {
            // Fetch weather data
            const weather = await weatherService.getCurrentWeather(location);

            if (!weather) {
                return JSON.stringify({
                    success: false,
                    error: `Could not fetch weather data for ${location}. Location may not exist or service unavailable.`,
                    suggestion: "Proceed without weather data or ask user to clarify location."
                });
            }

            return JSON.stringify({
                success: true,
                location: weather.location,
                temperature: weather.temperature,
                condition: weather.condition,
                humidity: weather.humidity,
                windSpeed: weather.windSpeed,
                feelsLike: weather.feelsLike,
                interpretation: {
                    clothing: weather.temperature < 10 ? "warm layers needed" :
                        weather.temperature < 20 ? "light jacket recommended" :
                            weather.temperature < 30 ? "comfortable, light clothing" : "hot, stay cool",
                    activities: weather.condition.toLowerCase().includes('rain') ? "indoor activities recommended" :
                        weather.condition.toLowerCase().includes('clear') ? "perfect for outdoor activities" : "generally good conditions"
                }
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: error.message,
                suggestion: "Continue without weather data."
            });
        }
    }
});

/**
 * Country Information Tool
 * Fetches detailed country information
 */
export const countryTool = new DynamicStructuredTool({
    name: "get_country_info",
    description: `Fetches detailed, accurate information about any country in the world.
    
    ALWAYS use this tool when the user asks about:
    - Currency and money: "what currency in Japan?", "money in France?"
    - Languages: "what language do they speak in Brazil?", "languages in Switzerland?"
    - Capital cities: "what's the capital of Kenya?", "capital of Australia?"
    - Country facts: "population of India?", "timezone in Germany?"
    - General country information when a country is mentioned
    
    Returns comprehensive country data:
    - Official currency name and symbol
    - Languages spoken
    - Capital city
    - Region and subregion
    - Population
    - Timezone(s)
    - Driving side (left/right)
    
    Important: This tool provides REAL factual data. Always use this for country-specific information rather than relying on general knowledge.`,

    schema: z.object({
        country: z.string().describe("The country name to get information for (e.g., 'France', 'Japan', 'United States')"),
        reasoning: z.string().describe("Brief explanation of why you're fetching country data for this query")
    }),

    func: async ({ country, reasoning }) => {
        try {
            // Fetch country data
            const countryInfo = await countryService.getCountryInfo(country);

            if (!countryInfo) {
                return JSON.stringify({
                    success: false,
                    error: `Could not fetch information for ${country}. Country name may be incorrect or service unavailable.`,
                    suggestion: "Proceed without country data or ask user to clarify country name."
                });
            }

            return JSON.stringify({
                success: true,
                name: countryInfo.name,
                capital: countryInfo.capital,
                region: countryInfo.region,
                currency: countryInfo.currency,
                languages: countryInfo.languages,
                population: countryInfo.population,
                timezones: countryInfo.timezones,
                practical_tips: {
                    currency_note: `Use ${countryInfo.currency} - check exchange rates before traveling`,
                    language_note: countryInfo.languages.length > 1 ?
                        `Multiple languages spoken: ${countryInfo.languages.join(', ')}` :
                        `Primary language: ${countryInfo.languages[0]}`,
                    timezone_note: countryInfo.timezones.length > 1 ?
                        "Multiple time zones - check specific city" :
                        `Timezone: ${countryInfo.timezones[0]}`
                }
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: error.message,
                suggestion: "Continue without country data."
            });
        }
    }
});

/**
 * Context Analysis Tool
 * Analyzes user message to extract travel preferences and requirements
 */
export const contextAnalysisTool = new DynamicStructuredTool({
    name: "analyze_user_context",
    description: `Analyzes complex user messages to extract and structure travel preferences and requirements.
    
    Use this tool when the user provides multiple requirements or preferences in a single message, such as:
    - Budget constraints: "affordable", "luxury", "under $1000", "cheap"
    - Duration: "2 weeks", "long weekend", "month-long trip"
    - Group composition: "family with kids", "solo travel", "couple's trip", "with friends"
    - Travel style: "adventure", "relaxation", "cultural", "foodie", "party"
    - Interests: "history", "beaches", "hiking", "museums", "nightlife"
    - Constraints: "not too cold", "vegetarian-friendly", "accessible for elderly"
    - Timing: "in December", "next summer", "during cherry blossom season"
    
    Returns structured analysis including:
    - Explicit requirements mentioned by user
    - Implicit needs inferred from context
    - Travel constraints to consider
    - Preferences organized by category
    
    This tool helps provide more personalized and relevant recommendations by understanding the full context of complex queries.`,

    schema: z.object({
        userMessage: z.string().describe("The user's message to analyze"),
        previousContext: z.object({
            budget: z.string().optional(),
            style: z.string().optional(),
            duration: z.string().optional(),
            group: z.string().optional()
        }).optional().describe("Any previously known context about the user")
    }),

    func: async ({ userMessage, previousContext = {} }) => {
        // Analyze user preferences
        const analysis = {
            explicit_requirements: [],
            implicit_needs: [],
            constraints: [],
            preferences: { ...previousContext }
        };

        const messageLower = userMessage.toLowerCase();

        // Budget analysis
        const budgetPatterns = {
            'budget': /budget|cheap|affordable|economical|under \$?\d+/,
            'luxury': /luxury|expensive|high-end|premium|splurge|5-star/,
            'moderate': /mid-range|moderate|reasonable/
        };

        for (const [level, pattern] of Object.entries(budgetPatterns)) {
            if (pattern.test(messageLower)) {
                analysis.preferences.budget = level;
                analysis.explicit_requirements.push(`Budget: ${level}`);
            }
        }

        // Travel style analysis
        const stylePatterns = {
            'adventure': /adventure|hiking|active|outdoor|trek/,
            'relaxation': /relax|beach|spa|chill|peaceful/,
            'cultural': /culture|museum|history|art|heritage/,
            'foodie': /food|culinary|gastronom|restaurant|cuisine/,
            'social': /party|nightlife|clubs|bars/
        };

        for (const [style, pattern] of Object.entries(stylePatterns)) {
            if (pattern.test(messageLower)) {
                analysis.preferences.style = style;
                analysis.explicit_requirements.push(`Travel style: ${style}`);
            }
        }

        // Duration extraction
        const durationMatch = messageLower.match(/(\d+)\s*(day|week|month)s?/);
        if (durationMatch) {
            analysis.preferences.duration = durationMatch[0];
            analysis.explicit_requirements.push(`Duration: ${durationMatch[0]}`);
        }

        // Group type
        const groupPatterns = {
            'family': /family|kids|children|toddler/,
            'solo': /solo|alone|myself|by myself/,
            'couple': /couple|romantic|partner|spouse/,
            'friends': /friends|group|buddies/
        };

        for (const [group, pattern] of Object.entries(groupPatterns)) {
            if (pattern.test(messageLower)) {
                analysis.preferences.group = group;
                analysis.explicit_requirements.push(`Group: ${group}`);
            }
        }

        // Season/timing
        const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        for (const month of months) {
            if (messageLower.includes(month)) {
                analysis.preferences.timing = month;
                analysis.explicit_requirements.push(`Timing: ${month}`);
            }
        }

        // Implicit needs inference
        if (analysis.preferences.group === 'family') {
            analysis.implicit_needs.push('Family-friendly activities and accommodations');
            analysis.implicit_needs.push('Safety considerations');
        }

        if (analysis.preferences.style === 'adventure') {
            analysis.implicit_needs.push('Good fitness level activities');
            analysis.implicit_needs.push('Appropriate gear and equipment');
        }

        if (analysis.preferences.budget === 'budget') {
            analysis.constraints.push('Cost-conscious options needed');
            analysis.implicit_needs.push('Value-for-money recommendations');
        }

        return JSON.stringify({
            success: true,
            analysis,
            summary: `Found ${analysis.explicit_requirements.length} explicit requirements, ${analysis.implicit_needs.length} implicit needs, and ${analysis.constraints.length} constraints.`,
            recommendation: analysis.explicit_requirements.length === 0 ?
                "Consider asking clarifying questions to better understand user needs." :
                "Sufficient context to provide targeted recommendations."
        });
    }
});

/**
 * Currency Exchange Tool
 * Fetches real-time currency exchange rates and performs conversions
 */
export const currencyTool = new DynamicStructuredTool({
    name: "get_currency_exchange",
    description: `Fetches real-time currency exchange rates and performs currency conversions.
    
    ALWAYS use this tool when the user asks about:
    - Exchange rates: "what's the exchange rate for USD to EUR?", "how much is a dollar worth?"
    - Currency conversion: "how much is 100 dollars in yen?", "convert 50 euros to pounds"
    - Money planning: "how much local currency will I get?", "what's my budget in euros?"
    - Budget conversion: "I have $500, what's that in yen?", "convert my budget to local currency"
    - Price comparisons: "is that expensive in local currency?", "how much is that worth?"
    
    Returns accurate, real-time exchange data including:
    - Current exchange rate
    - Converted amount (if specified)
    - Last update timestamp
    - Formatted conversion result
    
    Supports all major world currencies: USD, EUR, GBP, JPY, CNY, INR, AUD, CAD, CHF, SEK, NOK, DKK, BRL, MXN, KRW, SGD, HKD, NZD, THB, AED, and more.
    
    Important: This tool provides REAL current exchange rates. Always use this for currency questions rather than estimating.`,

    schema: z.object({
        from: z.string().describe("Source currency code (e.g., 'USD', 'EUR', 'GBP')"),
        to: z.string().describe("Target currency code (e.g., 'JPY', 'EUR', 'GBP')"),
        amount: z.number().optional().describe("Optional amount to convert (e.g., 100, 500.50)")
    }),

    func: async ({ from, to, amount }) => {
        try {
            if (amount) {
                // Perform conversion
                const conversion = await currencyService.convertCurrency(amount, from, to);

                if (!conversion) {
                    return JSON.stringify({
                        success: false,
                        error: `Could not convert ${from} to ${to}. Please check currency codes are valid.`,
                        suggestion: "Common codes: USD, EUR, GBP, JPY, CNY, INR, AUD, CAD, CHF"
                    });
                }

                return JSON.stringify({
                    success: true,
                    conversion: conversion.formatted,
                    details: {
                        originalAmount: conversion.originalAmount,
                        convertedAmount: conversion.convertedAmount,
                        rate: conversion.rate,
                        from: conversion.originalCurrency,
                        to: conversion.targetCurrency
                    },
                    interpretation: {
                        practical_tip: `At current rates, ${conversion.originalAmount} ${conversion.originalCurrency} gives you ${conversion.convertedAmount} ${conversion.targetCurrency}`,
                        note: "Exchange rates update hourly. Actual rates at banks/exchange offices may vary slightly due to fees and commissions."
                    }
                });
            } else {
                // Just get the rate
                const rateData = await currencyService.getExchangeRate(from, to);

                if (!rateData) {
                    return JSON.stringify({
                        success: false,
                        error: `Could not fetch exchange rate for ${from} to ${to}.`,
                        suggestion: "Please verify currency codes. Common codes: USD, EUR, GBP, JPY, CNY, INR."
                    });
                }

                return JSON.stringify({
                    success: true,
                    rate: `1 ${rateData.from} = ${rateData.rate} ${rateData.to}`,
                    details: {
                        from: rateData.from,
                        to: rateData.to,
                        rate: rateData.rate,
                        lastUpdate: rateData.lastUpdate
                    },
                    interpretation: {
                        example: `For example, 100 ${rateData.from} would give you ${rateData.calculation(100)} ${rateData.to}`,
                        tip: "To convert a specific amount, ask with the amount included (e.g., 'convert 500 USD to EUR')"
                    }
                });
            }
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: error.message,
                suggestion: "Continue conversation without currency data."
            });
        }
    }
});

/**
 * Hotel Search Tool
 * Provides hotel recommendations and accommodation advice
 */
export const hotelTool = new DynamicStructuredTool({
    name: "search_hotels",
    description: `Provides hotel recommendations, accommodation advice, and lodging information for any city.
    
    ALWAYS use this tool when the user asks about:
    - Hotels: "where to stay in Paris?", "good hotels in Tokyo?"
    - Accommodation: "best area to stay?", "accommodation in Rome"
    - Lodging advice: "hostel or hotel?", "budget hotels in London"
    - Where to sleep: "place to stay in Barcelona", "sleep in Amsterdam"
    - Budget options: "cheap hotels", "luxury resorts", "mid-range accommodation"
    
    Returns comprehensive accommodation information including:
    - General recommendations for the city
    - Budget-specific tips (budget/mid-range/luxury)
    - Best neighborhoods/areas to stay
    - Practical accommodation advice
    - Links to booking resources
    
    Important: This tool provides REAL recommendations and practical advice. Use it whenever accommodation is mentioned.`,

    schema: z.object({
        city: z.string().describe("The city to search for hotels/accommodation (e.g., 'Paris', 'Tokyo', 'New York')"),
        budgetLevel: z.enum(['budget', 'mid-range', 'luxury']).optional().describe("Optional budget level for tailored recommendations")
    }),

    func: async ({ city, budgetLevel }) => {
        try {
            // Get hotel recommendations
            const hotelInfo = await hotelService.getHotelRecommendations(city);

            if (!hotelInfo) {
                return JSON.stringify({
                    success: false,
                    error: `Could not fetch hotel information for ${city}. City name may be incorrect or data unavailable.`,
                    suggestion: "Provide general accommodation advice for this destination."
                });
            }

            // Get budget-specific suggestions if requested
            const budgetInfo = budgetLevel ?
                hotelService.getBudgetSuggestions(budgetLevel) : null;

            return JSON.stringify({
                success: true,
                city: hotelInfo.city,
                recommendations: hotelInfo.recommendations,
                bestAreas: hotelInfo.areas.length > 0 ? hotelInfo.areas : ['Central/Downtown area for easy access'],
                generalInfo: hotelInfo.generalInfo || `${city} offers various accommodation options for all budgets`,
                budgetAdvice: budgetInfo ? {
                    level: budgetLevel,
                    priceRange: budgetInfo.range,
                    types: budgetInfo.types,
                    tips: budgetInfo.tips
                } : {
                    general: [
                        'Budget (hostels/budget hotels): $20-50/night',
                        'Mid-range (3-star hotels): $50-150/night',
                        'Luxury (4-5 star): $150+/night'
                    ]
                },
                bookingTips: [
                    'Book in advance for better rates',
                    'Check multiple booking sites (Booking.com, Hotels.com, Airbnb)',
                    'Read recent reviews from multiple sources',
                    'Consider location vs. price tradeoffs',
                    'Look for free cancellation options'
                ],
                practical_advice: {
                    timing: 'Book 1-3 months in advance for best availability',
                    location: 'Stay near public transport for easy city access',
                    safety: 'Choose well-reviewed properties in safe neighborhoods'
                }
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: error.message,
                suggestion: "Continue with general accommodation advice."
            });
        }
    }
});

/**
 * Flight Search Tool
 * Provides flight information and booking guidance
 */
export const flightTool = new DynamicStructuredTool({
    name: "search_flights",
    description: `Provides flight information, airline recommendations, and booking guidance for travel between cities.
    
    ALWAYS use this tool when the user asks about:
    - Flights: "flights from Paris to Tokyo", "how to fly to London"
    - Airlines: "which airline flies to...?", "best airline for..."
    - Travel routes: "how to get from X to Y", "travel from London to Paris"
    - Flight booking: "when to book flights?", "cheap flights to..."
    - Airfare advice: "flight prices", "best time to fly"
    
    Returns comprehensive flight information including:
    - Route details and airport codes
    - Estimated flight duration
    - Booking site links (Skyscanner, Kayak, Google Flights)
    - Money-saving tips
    - Best booking times
    - Budget flight strategies
    
    Important: This tool provides REAL booking guidance and practical tips. Use whenever flights or air travel are mentioned.`,

    schema: z.object({
        origin: z.string().describe("Origin city (e.g., 'Paris', 'New York', 'London')"),
        destination: z.string().describe("Destination city (e.g., 'Tokyo', 'Rome', 'Bangkok')"),
        departDate: z.string().optional().describe("Optional departure date in YYYY-MM-DD format")
    }),

    func: async ({ origin, destination, departDate }) => {
        try {
            // Get flight information
            const flightInfo = await flightService.getFlightInfo(origin, destination, { departDate });

            if (!flightInfo) {
                return JSON.stringify({
                    success: false,
                    error: `Could not fetch flight information for ${origin} to ${destination}.`,
                    suggestion: "Provide general flight booking advice."
                });
            }

            return JSON.stringify({
                success: true,
                route: flightInfo.route,
                duration: flightInfo.estimatedDuration,
                bookingLinks: {
                    skyscanner: flightInfo.bookingSites.skyscanner,
                    kayak: flightInfo.bookingSites.kayak,
                    googleFlights: flightInfo.bookingSites.googleFlights,
                    note: 'Click these links to compare prices across airlines'
                },
                bookingTips: flightInfo.tips,
                bestTimeToBook: flightInfo.bestTimeToBook,
                budgetSavingTips: flightInfo.budgetTips,
                generalAdvice: flightInfo.generalAdvice,
                practical_info: {
                    cheapest_days: 'Tuesday and Wednesday usually have lowest fares',
                    booking_window: 'Book 2-3 months ahead for international flights',
                    price_tracking: 'Use incognito mode to avoid price inflation',
                    flexibility: 'Being flexible with dates can save 20-40%'
                }
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: error.message,
                suggestion: "Continue with general flight advice."
            });
        }
    }
});

/**
 * All tools array for easy agent initialization
 */
export const travelTools = [
    weatherTool,
    countryTool,
    contextAnalysisTool,
    currencyTool,
    hotelTool,
    flightTool
];
