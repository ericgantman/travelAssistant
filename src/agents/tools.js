/**
 * LangChain Custom Tools for Travel Assistant
 * These tools wrap our existing services and provide structured interfaces for the agent
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { weatherService } from '../services/weather.js';
import { countryService } from '../services/country.js';

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
 * All tools array for easy agent initialization
 */
export const travelTools = [
    weatherTool,
    countryTool,
    contextAnalysisTool
];
