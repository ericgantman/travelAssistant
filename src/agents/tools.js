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
import { placesService } from '../services/places.js';

/**
 * Weather Information Tool
 * Fetches current weather data for a given location
 */
export const weatherTool = new DynamicStructuredTool({
    name: "get_weather",
    description: `Fetches current real-time weather data for any location. Returns temperature (°C), condition, humidity, wind speed, and "feels like" temperature. Use for packing advice, climate queries, or temperature questions. Provides REAL current data - never estimate weather.`,

    schema: z.object({
        location: z.string().describe("The city or location name to get weather for (e.g., 'Paris', 'Tokyo', 'New York')"),
        reasoning: z.string().describe("Brief explanation of why you're fetching weather data for this query")
    }),

    func: async ({ location, reasoning }) => {
        try {
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
    description: `Fetches detailed country information including currency, languages, capital, population, timezone, and region. Use for currency/money questions, language queries, or general country facts. Provides REAL factual data.`,

    schema: z.object({
        country: z.string().describe("The country name to get information for (e.g., 'France', 'Japan', 'United States')"),
        reasoning: z.string().describe("Brief explanation of why you're fetching country data for this query")
    }),

    func: async ({ country, reasoning }) => {
        try {
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
    description: `Analyzes user messages to extract travel preferences: budget (luxury/moderate/budget), duration, group type (family/solo/couple), interests, constraints, and timing. Returns structured analysis for personalized recommendations.`,

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
        const analysis = {
            explicit_requirements: [],
            implicit_needs: [],
            constraints: [],
            preferences: { ...previousContext }
        };

        const messageLower = userMessage.toLowerCase();

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

        const durationMatch = messageLower.match(/(\d+)\s*(day|week|month)s?/);
        if (durationMatch) {
            analysis.preferences.duration = durationMatch[0];
            analysis.explicit_requirements.push(`Duration: ${durationMatch[0]}`);
        }

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

        const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        for (const month of months) {
            if (messageLower.includes(month)) {
                analysis.preferences.timing = month;
                analysis.explicit_requirements.push(`Timing: ${month}`);
            }
        }

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
    description: `Fetches real-time currency exchange rates and performs conversions. Returns current rate, converted amount (if specified), and last update time. Supports all major currencies (USD, EUR, GBP, JPY, CNY, etc.). Provides REAL current rates.`,

    schema: z.object({
        from: z.string().describe("Source currency code (e.g., 'USD', 'EUR', 'GBP')"),
        to: z.string().describe("Target currency code (e.g., 'JPY', 'EUR', 'GBP')"),
        amount: z.number().optional().describe("Optional amount to convert (e.g., 100, 500.50)")
    }),

    func: async ({ from, to, amount }) => {
        try {
            if (amount) {
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
    description: `Provides hotel recommendations and accommodation advice for any city. Returns recommendations by budget level, best neighborhoods, and practical lodging tips. Use when users ask about where to stay, hotels, or accommodation.`,

    schema: z.object({
        city: z.string().describe("The city to search for hotels/accommodation (e.g., 'Paris', 'Tokyo', 'New York')"),
        budgetLevel: z.enum(['budget', 'mid-range', 'luxury']).optional().describe("Optional budget level for tailored recommendations")
    }),

    func: async ({ city, budgetLevel }) => {
        try {
            const hotelData = await hotelService.getHotelRecommendations(city, {
                budgetLevel
            });

            if (!hotelData || !hotelData.success) {
                return JSON.stringify({
                    success: false,
                    error: `Could not fetch hotel information for ${city}. City name may be incorrect or data unavailable.`,
                    suggestion: "Provide general accommodation advice for this destination."
                });
            }

            let hotels = hotelData.hotels;
            if (budgetLevel && budgetLevel !== 'all') {
                hotels = hotels.filter(h => h.category === budgetLevel);
            }

            return JSON.stringify({
                success: true,
                city: hotelData.city,
                totalHotels: hotels.length,
                hotels: hotels.map(hotel => ({
                    name: hotel.name,
                    category: hotel.category,
                    rating: {
                        score: hotel.rating,
                        reviews: hotel.reviewCount,
                        display: `${hotel.rating}/10 (${hotel.reviewCount} reviews)`
                    },
                    price: {
                        amount: hotel.price.amount,
                        display: hotel.price.display,
                        perNight: hotel.price.perNight
                    },
                    location: {
                        neighborhood: hotel.location.neighborhood,
                        distanceFromCenter: hotel.location.distanceFromCenter,
                        walkScore: hotel.location.walkScore
                    },
                    availability: {
                        available: hotel.availability.available,
                        roomsLeft: hotel.availability.roomsLeft,
                        message: hotel.availability.message
                    },
                    amenities: hotel.amenities,
                    highlights: hotel.highlights
                })),
                tips: hotelService.getBookingTips(city),
                priceCategories: {
                    luxury: '$250-450/night (ratings 8.5-9.8)',
                    'mid-range': '$100-200/night (ratings 7.5-8.8)',
                    budget: '$40-100/night (ratings 6.5-8.0)'
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
    description: `Provides flight information and booking guidance. Returns route details, duration estimates, booking site links, and money-saving tips. Use when users ask about flights, airlines, or air travel between cities.`,

    schema: z.object({
        origin: z.string().describe("Origin city (e.g., 'Paris', 'New York', 'London')"),
        destination: z.string().describe("Destination city (e.g., 'Tokyo', 'Rome', 'Bangkok')"),
        departDate: z.string().optional().describe("Optional departure date in YYYY-MM-DD format")
    }),

    func: async ({ origin, destination, departDate }) => {
        try {
            const flightInfo = await flightService.getFlightInfo(origin, destination, { departDate });

            if (!flightInfo || !flightInfo.success) {
                return JSON.stringify({
                    success: false,
                    error: `Could not fetch flight information for ${origin} to ${destination}.`,
                    suggestion: "Provide general flight booking advice."
                });
            }

            return JSON.stringify({
                success: true,
                from: flightInfo.from,
                to: flightInfo.to,
                route: `${flightInfo.from} (${flightInfo.originCode}) → ${flightInfo.to} (${flightInfo.destCode})`,
                dataSource: flightInfo.dataSource,
                note: flightInfo.note,

                flights: flightInfo.flights.map(flight => ({
                    airline: flight.airline,
                    flightNumber: flight.flightNumber,
                    price: flight.price.display,
                    priceAmount: flight.price.amount,
                    currency: flight.price.currency,
                    departure: {
                        date: flight.departure.date,
                        time: flight.departure.timeDisplay,
                        airport: flight.departure.airport
                    },
                    arrival: {
                        date: flight.arrival.date,
                        time: flight.arrival.timeDisplay,
                        airport: flight.arrival.airport
                    },
                    duration: flight.duration,
                    stops: flight.stopsInfo,
                    bookingUrl: flight.bookingUrl
                })),

                tips: flightInfo.tips,

                summary: {
                    cheapestPrice: `$${flightInfo.flights[0].price.amount}`,
                    cheapestFlight: `${flightInfo.flights[0].airline} ${flightInfo.flights[0].flightNumber}`,
                    averagePrice: `$${Math.round(flightInfo.flights.reduce((sum, f) => sum + f.price.amount, 0) / flightInfo.flights.length)}`,
                    totalOptions: flightInfo.flights.length
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
 * Places & Attractions Tool
 * Searches for restaurants, attractions, and things to do using real Google Maps data
 */
export const placesTool = new DynamicStructuredTool({
    name: "search_places",
    description: `Searches for restaurants, attractions, and activities using Google Maps data. Returns real place names, ratings, reviews, prices, addresses, hours, and Google Maps links. Supports restaurants, attractions, cafes, bars, museums, parks, shopping. Provides REAL current data.`,

    schema: z.object({
        city: z.string().describe("The city to search in (e.g., 'Paris', 'Tokyo', 'New York')"),
        searchType: z.enum([
            'restaurants',
            'attractions',
            'things_to_do',
            'cafes',
            'bars',
            'museums',
            'parks',
            'shopping'
        ]).describe("Type of places to search for"),
        specificQuery: z.string().optional().describe("Optional specific search like 'Italian restaurants' or 'modern art museums'")
    }),

    func: async ({ city, searchType, specificQuery }) => {
        try {
            const placesData = await placesService.searchPlaces(city, {
                type: searchType,
                query: specificQuery,
                maxResults: 10
            });

            if (!placesData || !placesData.success) {
                return JSON.stringify({
                    success: false,
                    error: `Could not fetch places data for ${city}.`,
                    suggestion: "Provide general recommendations for this city."
                });
            }

            return JSON.stringify({
                success: true,
                city: placesData.city,
                searchType: placesData.searchType,
                dataSource: placesData.dataSource,
                totalResults: placesData.totalResults,
                note: placesData.note,
                places: placesData.places.map(place => ({
                    rank: place.rank,
                    name: place.name,
                    rating: {
                        score: place.rating.score,
                        reviews: place.rating.reviews,
                        display: place.rating.display
                    },
                    priceLevel: place.priceLevel,
                    category: place.category,
                    description: place.description,
                    address: place.address,
                    location: place.location,
                    contact: {
                        phone: place.phone,
                        website: place.website
                    },
                    hours: place.hours,
                    isOpen: place.isOpen,
                    mapsUrl: place.mapsUrl,
                    thumbnail: place.thumbnail
                })),

                tips: placesData.tips,
                summary: {
                    topRated: placesData.places[0]?.name,
                    topRating: placesData.places[0]?.rating.score,
                    averageRating: (placesData.places.reduce((sum, p) => sum + p.rating.score, 0) / placesData.places.length).toFixed(1),
                    totalOptions: placesData.totalResults
                }
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: error.message,
                suggestion: "Continue with general recommendations."
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
    flightTool,
    placesTool
];
