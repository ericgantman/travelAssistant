/**
 * Currency Exchange Service
 * Uses ExchangeRate-API (free tier, no API key needed)
 * https://www.exchangerate-api.com/
 */

const BASE_URL = 'https://open.er-api.com/v6/latest';

class CurrencyService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 3600000; // 1 hour
    }

    /**
     * Get exchange rate between two currencies
     * @param {string} from - Source currency code (e.g., 'USD')
     * @param {string} to - Target currency code (e.g., 'EUR')
     * @returns {Promise<Object>} Exchange rate data
     */
    async getExchangeRate(from, to) {
        const cacheKey = `${from}_${to}`;

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            console.log(`💰 Using cached exchange rate: ${from} → ${to}`);
            return cached.data;
        }

        try {
            const response = await fetch(`${BASE_URL}/${from.toUpperCase()}`);

            if (!response.ok) {
                throw new Error(`Currency API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.result !== 'success') {
                throw new Error('Invalid currency code');
            }

            const rate = data.rates[to.toUpperCase()];

            if (!rate) {
                throw new Error(`Rate not found for ${to}`);
            }

            const result = {
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                rate: rate,
                lastUpdate: data.time_last_update_utc,
                calculation: (amount) => (amount * rate).toFixed(2)
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log(`💱 Fetched exchange rate: 1 ${from} = ${rate} ${to}`);
            return result;

        } catch (error) {
            console.error(`❌ Currency exchange error:`, error.message);
            return null;
        }
    }

    /**
     * Convert amount between currencies
     * @param {number} amount - Amount to convert
     * @param {string} from - Source currency
     * @param {string} to - Target currency
     * @returns {Promise<Object>} Conversion result
     */
    async convertCurrency(amount, from, to) {
        const rateData = await this.getExchangeRate(from, to);

        if (!rateData) {
            return null;
        }

        return {
            originalAmount: amount,
            originalCurrency: from.toUpperCase(),
            convertedAmount: parseFloat(rateData.calculation(amount)),
            targetCurrency: to.toUpperCase(),
            rate: rateData.rate,
            formatted: `${amount} ${from.toUpperCase()} = ${rateData.calculation(amount)} ${to.toUpperCase()}`
        };
    }

    /**
     * Extract currency codes from user message
     * @param {string} message - User message
     * @returns {Object|null} Extracted currencies
     */
    extractCurrencies(message) {
        // Common currency codes (3 letter uppercase)
        const currencyPattern = /\b([A-Z]{3})\b/g;
        const matches = message.match(currencyPattern);

        if (matches && matches.length >= 2) {
            return { from: matches[0], to: matches[1] };
        }

        // Try to extract from natural language
        const currencyNames = {
            'dollar': 'USD', 'dollars': 'USD', 'usd': 'USD',
            'euro': 'EUR', 'euros': 'EUR', 'eur': 'EUR',
            'pound': 'GBP', 'pounds': 'GBP', 'sterling': 'GBP', 'gbp': 'GBP',
            'yen': 'JPY', 'jpyy': 'JPY',
            'yuan': 'CNY', 'renminbi': 'CNY', 'cny': 'CNY',
            'rupee': 'INR', 'rupees': 'INR', 'inr': 'INR',
            'peso': 'MXN', 'pesos': 'MXN', 'mxn': 'MXN',
            'real': 'BRL', 'reais': 'BRL', 'brl': 'BRL',
            'won': 'KRW', 'krw': 'KRW',
            'franc': 'CHF', 'francs': 'CHF', 'chf': 'CHF',
            'krona': 'SEK', 'kronor': 'SEK', 'sek': 'SEK',
            'lira': 'TRY', 'try': 'TRY',
            'dirham': 'AED', 'aed': 'AED',
            'baht': 'THB', 'thb': 'THB'
        };

        const messageLower = message.toLowerCase();
        const found = [];
        const foundCodes = new Set();  // Track unique currency codes

        for (const [name, code] of Object.entries(currencyNames)) {
            if (messageLower.includes(name) && !foundCodes.has(code)) {
                found.push(code);
                foundCodes.add(code);
            }
        }

        if (found.length >= 2) {
            return { from: found[0], to: found[1] };
        }

        return null;
    }

    /**
     * Extract amount from user message
     * @param {string} message - User message
     * @returns {number|null} Extracted amount
     */
    extractAmount(message) {
        // Look for patterns like "$100", "100 dollars", "€50", etc.
        const amountPatterns = [
            /[\$€£¥]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,  // $100, €50.25
            /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollar|euro|pound|yen|yuan)/i
        ];

        for (const pattern of amountPatterns) {
            const match = message.match(pattern);
            if (match) {
                // Remove commas and parse
                const amount = parseFloat(match[1].replace(/,/g, ''));
                if (!isNaN(amount) && amount > 0) {
                    return amount;
                }
            }
        }

        return null;
    }

    /**
     * Determine if query is about currency exchange
     * @param {string} message - User message
     * @returns {boolean}
     */
    shouldFetchCurrency(message) {
        const messageLower = message.toLowerCase();

        const currencyKeywords = [
            'exchange rate', 'currency', 'convert', 'conversion',
            'how much is', 'worth in', 'dollars to', 'euros to',
            'exchange', 'rate for', 'currency exchange'
        ];

        return currencyKeywords.some(keyword => messageLower.includes(keyword));
    }
}

export const currencyService = new CurrencyService();
