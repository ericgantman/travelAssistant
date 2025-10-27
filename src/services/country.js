import axios from 'axios';

/**
 * Country information service using REST Countries API (free, no key required)
 * Provides useful country data for travel planning
 */

class CountryService {
    constructor() {
        this.baseUrl = 'https://restcountries.com/v3.1';
        this.cache = new Map(); // Simple in-memory cache
    }

    /**
     * Extracts country name from message
     */
    extractCountry(message) {
        // Match capitalized words (likely place names)
        const words = message.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g);
        return words ? words[0] : null; // Return first capitalized phrase
    }

    /**
     * Fetches country information
     */
    async getCountryInfo(countryName) {
        if (this.cache.has(countryName)) {
            return this.cache.get(countryName);
        }

        try {
            const response = await axios.get(`${this.baseUrl}/name/${countryName}`, {
                timeout: 5000,
            });

            const data = response.data[0];
            const info = {
                name: data.name.common,
                capital: data.capital?.[0] || 'N/A',
                region: data.region,
                subregion: data.subregion,
                population: data.population,
                languages: Object.values(data.languages || {}).join(', '),
                currencies: Object.values(data.currencies || {})
                    .map(c => `${c.name} (${c.symbol})`)
                    .join(', '),
                timezone: data.timezones?.[0] || 'N/A',
                drivingSide: data.car?.side || 'N/A',
            };

            this.cache.set(countryName, info);
            return info;
        } catch (error) {
            console.error('Country API error:', error.message);
            return null;
        }
    }

    /**
     * Determines if country data should be fetched
     */
    shouldFetchCountryInfo(message, queryType) {
        const country = this.extractCountry(message);
        if (!country) return false;

        // Fetch country info for destination queries or when mentioned explicitly
        return queryType === 'destination' || queryType === 'general';
    }

    /**
     * Formats country data for inclusion in prompt
     */
    formatCountryForPrompt(countryInfo) {
        if (!countryInfo) return '';

        return `\n\n[COUNTRY INFORMATION for ${countryInfo.name}]:
- Capital: ${countryInfo.capital}
- Region: ${countryInfo.region} (${countryInfo.subregion})
- Languages: ${countryInfo.languages}
- Currency: ${countryInfo.currencies}
- Timezone: ${countryInfo.timezone}
- Driving Side: ${countryInfo.drivingSide}

Use this information to provide relevant context about travel to ${countryInfo.name}.`;
    }
}

export const countryService = new CountryService();
