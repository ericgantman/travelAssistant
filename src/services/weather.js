import axios from 'axios';
import { config } from '../config.js';

/**
 * Weather service using Open-Meteo API (free, no API key required)
 * Provides current weather and forecast data for destinations
 */

class WeatherService {
    constructor() {
        this.baseUrl = config.openMeteo.baseUrl;
        this.geocodingUrl = config.openMeteo.geocodingUrl;
    }

    /**
     * Extracts location from user message
     */
    extractLocation(message) {
        // Pattern matching for common location mentions
        const contextPatterns = [
            // Match "travel to" + location (capture and capitalize)
            /\btravel(?:ing)?\s+to\s+([a-z]{3,}(?:\s+[a-z]+)?)\b/i,
            // Match "visit/visiting" + location
            /\b(?:visit|visiting)\s+([a-z]{3,}(?:\s+[a-z]+)?)\b/i,
            // Match "going to" + location
            /\bgoing\s+to\s+([a-z]{3,}(?:\s+[a-z]+)?)\b/i,
            // Match "weather in/for" + location  
            /\bweather\s+(?:in|for)\s+([a-z]{3,}(?:\s+[a-z]+)?)\b/i,
            // Match "in" + location (but not "in the" or "in a")
            /\bin\s+([a-z]{3,}(?:\s+[a-z]+)?)\b(?!\s+the\b|\s+a\b)/i,
            // Match location + "weather/climate/temperature"
            /\b([a-z]{3,}(?:\s+[a-z]+)?)\s+(?:weather|climate|temperature)\b/i,
            // Match "to" + location (but be more specific)
            /\bto\s+([a-z]{3,}(?:\s+[a-z]+)?)\b/i,
        ];

        // Try context-based patterns first
        for (const pattern of contextPatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                let location = match[1].trim();

                // Remove trailing time/question words
                location = location.replace(/\s+(next|this|tomorrow|today|week|month|what|when|best|time)$/i, '');

                // Skip if it's a common word, not a location
                const skipWords = ['there', 'here', 'home', 'back', 'get', 'how', 'what', 'to', 'the', 'best', 'time', 'travel', 'visit', 'go'];
                if (skipWords.includes(location.toLowerCase())) {
                    continue;
                }

                // Capitalize properly (handle multi-word cities like "New York")
                const capitalized = location
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

                // Must be at least 3 characters
                if (capitalized.length >= 3) {
                    return capitalized;
                }
            }
        }

        // Fallback: extract any capitalized words (likely place names)
        const capitalizedWords = message.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?\b/g);
        if (capitalizedWords && capitalizedWords.length > 0) {
            // Filter out common words that aren't locations
            const excludeWords = ['What', 'Where', 'When', 'How', 'Can', 'Should', 'Tell', 'Show', 'Give', 'The', 'This', 'That', 'Next', 'Week', 'Month', 'Year', 'Tomorrow', 'Today', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'Find', 'Best', 'Time', 'Want'];
            const filtered = capitalizedWords.filter(word => !excludeWords.includes(word));
            if (filtered.length > 0) {
                return filtered[0];
            }
        }

        return null;
    }

    /**
     * Geocodes a location name to coordinates
     */
    async geocodeLocation(locationName) {
        try {
            const response = await axios.get(`${this.geocodingUrl}/search`, {
                params: {
                    name: locationName,
                    count: 1,
                    language: 'en',
                    format: 'json',
                },
                timeout: 5000,
            });

            const results = response.data.results;
            if (!results || results.length === 0) {
                return null;
            }

            const location = results[0];
            return {
                name: location.name,
                country: location.country,
                latitude: location.latitude,
                longitude: location.longitude,
            };
        } catch (error) {
            console.error('Geocoding error:', error.message);
            return null;
        }
    }

    /**
     * Fetches current weather for a location
     */
    async getCurrentWeather(locationName) {
        try {
            const geoData = await this.geocodeLocation(locationName);
            if (!geoData) {
                return null;
            }

            // Fetch weather data
            const response = await axios.get(`${this.baseUrl}/forecast`, {
                params: {
                    latitude: geoData.latitude,
                    longitude: geoData.longitude,
                    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
                    timezone: 'auto',
                },
                timeout: 5000,
            });

            const current = response.data.current;

            // Map weather codes to descriptions
            const weatherDescription = this.getWeatherDescription(current.weather_code);

            return {
                location: geoData.name,
                country: geoData.country,
                temperature: Math.round(current.temperature_2m),
                feelsLike: Math.round(current.apparent_temperature),
                condition: weatherDescription,
                humidity: current.relative_humidity_2m,
                windSpeed: Math.round(current.wind_speed_10m * 3.6), // Convert m/s to km/h
            };
        } catch (error) {
            console.error('Weather API error:', error.message);
            return null;
        }
    }

    /**
     * Maps WMO weather codes to human-readable descriptions
     * https://open-meteo.com/en/docs
     */
    getWeatherDescription(code) {
        const weatherCodes = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            77: 'Snow grains',
            80: 'Slight rain showers',
            81: 'Moderate rain showers',
            82: 'Violent rain showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with slight hail',
            99: 'Thunderstorm with heavy hail',
        };

        return weatherCodes[code] || 'Unknown';
    }

    /**
     * Determines if weather data should be fetched for this message
     */
    shouldFetchWeather(message, queryType) {
        const location = this.extractLocation(message);
        if (!location) return false;

        // Fetch weather for destination and packing queries
        return queryType === 'destination' || queryType === 'packing';
    }

    /**
     * Formats weather data for inclusion in prompt
     */
    formatWeatherForPrompt(weatherData) {
        if (!weatherData) return '';

        return `\n\n[CURRENT WEATHER DATA for ${weatherData.location}, ${weatherData.country}]:
- Temperature: ${weatherData.temperature}°C (feels like ${weatherData.feelsLike}°C)
- Conditions: ${weatherData.condition}
- Humidity: ${weatherData.humidity}%
- Wind Speed: ${weatherData.windSpeed} km/h

Use this current weather information to provide relevant, timely advice.`;
    }
}

export const weatherService = new WeatherService();
