/**
 * Advanced Reasoning Agent with Chain of Thought
 * Uses LangChain's tool calling pattern for structured reasoning
 */

import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { travelTools } from './tools.js';
import { config } from '../config.js';
import { SYSTEM_PROMPT, STRICT_PROMPT, REACT_COT_PROMPT } from '../prompts/system.js';
import { identifyQueryType } from '../prompts/templates.js';

/**
 * Creates and configures the reasoning agent
 */
export class TravelReasoningAgent {
    constructor() {
        this.llm = null;
        this.chatHistory = [];
        this.initialized = false;
    }

    /**
     * Initialize the agent with LangChain components
     */
    async initialize() {
        if (this.initialized) return;

        console.log('🤖 Initializing Advanced Reasoning Agent...');

        // Initialize Ollama chat model
        this.llm = new ChatOllama({
            baseUrl: config.ollama.baseUrl,
            model: config.ollama.model,
            temperature: config.ollama.temperature,
        });

        // Bind tools to the model
        this.llmWithTools = this.llm.bind({
            tools: travelTools.map(tool => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: {
                        type: "object",
                        properties: Object.fromEntries(
                            Object.entries(tool.schema.shape || {}).map(([key, val]) => [
                                key,
                                { type: "string", description: val.description || "" }
                            ])
                        ),
                        required: Object.keys(tool.schema.shape || {})
                    }
                }
            }))
        });

        this.initialized = true;
        // Silent initialization - UI handled by index-agent.js
    }

    /**
     * Manually detect which tools should be used based on query patterns
     * This compensates for llama3:8b's weak function calling support
     */
    detectRequiredTools(userMessage) {
        const messageLower = userMessage.toLowerCase();
        const tools = [];

        // Weather tool triggers
        const weatherKeywords = ['pack', 'packing', 'bring', 'wear', 'weather', 'temperature',
            'climat', 'warm', 'cold', 'rain', 'today', 'right now', 'currently'];
        if (weatherKeywords.some(keyword => messageLower.includes(keyword))) {
            // Extract location - match city names after prepositions
            // Exclude common time/context words that aren't part of location
            const excludeWords = /\b(today|tomorrow|now|currently|right|this|next|week|month|year|visit|visiting|travel|traveling|go|going)\b/i;

            // Try to find location after preposition
            let locationMatch = userMessage.match(/\b(?:to|in|for|at)\s+([a-z]{3,}(?:\s+[a-z]+)?)\b/i);

            // If no match with preposition, try to find standalone city names (capitalized)
            if (!locationMatch) {
                // Match capitalized words that aren't excluded time words
                const words = userMessage.split(/\s+/);
                for (const word of words) {
                    if (/^[A-Z][a-z]{2,}$/.test(word) && !excludeWords.test(word)) {
                        locationMatch = [null, word];
                        break;
                    }
                }
            }

            if (locationMatch && locationMatch[1]) {
                // Clean and capitalize location
                let location = locationMatch[1].trim();

                // Remove time-related words from location
                location = location.split(/\s+/)
                    .filter(word => !excludeWords.test(word))
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

                if (location) {
                    tools.push({
                        name: 'get_weather',
                        args: {
                            location: location,
                            reasoning: 'User query contains weather-related keywords'
                        }
                    });
                }
            }
        }

        // Country tool triggers  
        const countryKeywords = ['currency', 'money', 'language', 'speak', 'visa', 'capital', 'timezone'];
        if (countryKeywords.some(keyword => messageLower.includes(keyword))) {
            const excludeWords = /\b(today|tomorrow|now|currently|right|this|next|week|month|year|visit|visiting|travel|traveling|go|going)\b/i;

            let locationMatch = userMessage.match(/\b(?:in|to|for|at|of)\s+([a-z]{3,}(?:\s+[a-z]+)?)\b/i);

            if (!locationMatch) {
                const words = userMessage.split(/\s+/);
                for (const word of words) {
                    if (/^[A-Z][a-z]{2,}$/.test(word) && !excludeWords.test(word)) {
                        locationMatch = [null, word];
                        break;
                    }
                }
            }

            if (locationMatch && locationMatch[1]) {
                let location = locationMatch[1].trim();
                location = location.split(/\s+/)
                    .filter(word => !excludeWords.test(word))
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

                if (location) {
                    tools.push({
                        name: 'get_country_info',
                        args: {
                            country: location,
                            reasoning: 'User query asks about country-specific information'
                        }
                    });
                }
            }
        }

        // Currency tool triggers
        const currencyKeywords = ['shekel', 'shekels', 'nis', '₪', 'euro', 'euros', '€',
            'dollar', 'dollars', '$', 'pound', 'pounds', '£', 'yen', 'convert', 'exchange',
            'budget', 'cost', 'price', 'expensive', 'cheap', 'afford'];
        const hasCurrency = currencyKeywords.some(kw => messageLower.includes(kw));
        const hasNumber = /\d+/.test(userMessage);

        if (hasCurrency && hasNumber) {
            const currencyDetails = this.extractCurrencyConversion(userMessage);
            if (currencyDetails) {
                tools.push({
                    name: 'convert_currency',
                    args: currencyDetails
                });
            }
        }

        // Flight tool triggers
        const flightKeywords = ['flight', 'flights', 'fly', 'flying', 'airline', 'plane',
            'airport', 'ticket', 'direct flight', 'round trip', 'one way'];
        if (flightKeywords.some(keyword => messageLower.includes(keyword))) {
            const flightDetails = this.extractFlightCities(userMessage);
            if (flightDetails) {
                console.log(`   → Flight tool: Searching flights from ${flightDetails.origin} to ${flightDetails.destination}`);
                tools.push({
                    name: 'search_flights',
                    args: {
                        origin: flightDetails.origin,
                        destination: flightDetails.destination,
                        reasoning: 'User query asks about flights'
                    }
                });
            }
        }

        // Hotel tool triggers
        const hotelKeywords = ['hotel', 'hotels', 'stay', 'accommodation', 'lodging',
            'hostel', 'reserve', 'book', 'room', 'where to stay'];
        if (hotelKeywords.some(keyword => messageLower.includes(keyword))) {
            const excludeWords = /\b(today|tomorrow|now|currently|right|this|next|week|month|year|september|october|november|december|january|february|march|april|may|june|july|august|find|cool|place|best|good|great)\b/i;

            // Try to extract location from current message
            let locationMatch = userMessage.match(/\b(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);

            // If no location in current message, try pattern like "hotel in X"
            if (!locationMatch) {
                locationMatch = userMessage.match(/hotel[s]?\s+(?:in|at|near)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)/i);
            }

            // If still no location, check conversation context
            if (!locationMatch || !locationMatch[1] || excludeWords.test(locationMatch[1])) {
                const contextLocation = this.extractLocationFromContext();
                if (contextLocation) {
                    tools.push({
                        name: 'search_hotels',
                        args: {
                            city: contextLocation,
                            reasoning: 'User query asks about accommodation, location from context'
                        }
                    });
                }
            } else {
                let location = locationMatch[1].trim();
                location = location.split(/\s+/)
                    .filter(word => !excludeWords.test(word))
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

                if (location && location.length > 2) {
                    tools.push({
                        name: 'search_hotels',
                        args: {
                            city: location,
                            reasoning: 'User query asks about accommodation'
                        }
                    });
                }
            }
        }

        // Places tool triggers (restaurants, attractions, things to do)
        const placesKeywords = ['restaurant', 'restaurants', 'eat', 'eating', 'food', 'dine', 'dining',
            'cafe', 'cafes', 'coffee', 'bar', 'bars', 'nightlife', 'drink',
            'attraction', 'attractions', 'see', 'visit', 'sightseeing', 'tourist',
            'museum', 'museums', 'gallery', 'galleries', 'art',
            'things to do', 'activities', 'entertainment', 'fun',
            'shopping', 'shop', 'market', 'markets',
            'park', 'parks', 'garden', 'gardens', 'outdoor',
            'landmark', 'landmarks', 'monument', 'monuments'];

        // ONLY trigger if user explicitly mentions places-related keywords (use word boundaries!)
        const hasPlacesKeyword = placesKeywords.some(keyword => {
            // Use word boundaries to avoid matching "eat" in "weather"
            const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
            return wordBoundaryRegex.test(userMessage);
        });

        if (hasPlacesKeyword) {
            const excludeWords = /\b(today|tomorrow|now|currently|right|this|next|week|month|year|september|october|november|december|january|february|march|april|may|june|july|august)\b/i;

            // Try to extract location from current message
            let locationMatch = userMessage.match(/\b(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);

            // Try pattern like "restaurants in Paris", "things to see in London"
            if (!locationMatch) {
                locationMatch = userMessage.match(/(?:restaurant|eat|food|cafe|bar|attraction|see|visit|museum|park|shopping|things to (?:do|see))\s+(?:in|at|near)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)/i);
            }

            // Try capitalized city names
            if (!locationMatch) {
                const words = userMessage.split(/\s+/);
                for (const word of words) {
                    if (/^[A-Z][a-z]{2,}$/.test(word) && !excludeWords.test(word)) {
                        locationMatch = [null, word];
                        break;
                    }
                }
            }

            // If still no location, check conversation context
            if (!locationMatch || !locationMatch[1] || excludeWords.test(locationMatch[1])) {
                const contextLocation = this.extractLocationFromContext();
                if (contextLocation) {
                    const placeType = this.detectPlaceType(userMessage);
                    tools.push({
                        name: 'search_places',
                        args: {
                            city: contextLocation,
                            searchType: placeType,
                            reasoning: 'User query asks about places, location from context'
                        }
                    });
                }
            } else {
                let location = locationMatch[1].trim();
                location = location.split(/\s+/)
                    .filter(word => !excludeWords.test(word))
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

                if (location && location.length > 2) {
                    const placeType = this.detectPlaceType(userMessage);
                    tools.push({
                        name: 'search_places',
                        args: {
                            city: location,
                            searchType: placeType,
                            reasoning: `User query asks about ${placeType}`
                        }
                    });
                }
            }
        }

        // Context analysis triggers
        const contextKeywords = ['budget', 'family', 'kids', 'children', 'week', 'days'];
        const keywordCount = contextKeywords.filter(kw => messageLower.includes(kw)).length;
        if (keywordCount >= 2) {
            tools.push({
                name: 'analyze_user_context',
                args: {
                    userMessage: userMessage,
                    previousContext: {}
                }
            });
        }

        return tools;
    }

    /**
     * Extract flight cities from message
     */
    extractFlightCities(message) {
        // Pattern: "from X to Y" or "to Y from X"
        const fromToPattern = /(?:from|flying from|travel from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
        const toFromPattern = /(?:to|flying to|fly to|travel to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;

        let match = message.match(fromToPattern);
        if (match) {
            return {
                origin: this.normalizeLocationForFlights(match[1]),
                destination: this.normalizeLocationForFlights(match[2])
            };
        }

        match = message.match(toFromPattern);
        if (match) {
            return {
                origin: this.normalizeLocationForFlights(match[2]),
                destination: this.normalizeLocationForFlights(match[1])
            };
        }

        // Pattern: just "fly to X" - need to infer "from" from context
        const toPattern = /(?:fly to|flight to|flying to|flights to|travel to|going to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
        match = message.match(toPattern);
        if (match) {
            // Check context for departure location
            const fromContext = this.extractFlightOriginFromContext();
            return {
                origin: fromContext || 'Tel Aviv', // Default to Tel Aviv
                destination: this.normalizeLocationForFlights(match[1])
            };
        }

        // No explicit cities mentioned - check if this is a follow-up query
        // Look for previous flight origins AND destinations in conversation
        const destinationFromContext = this.extractFlightDestinationFromContext();
        const originFromContext = this.extractFlightOriginFromContext();

        if (destinationFromContext && originFromContext) {
            return {
                origin: originFromContext,
                destination: destinationFromContext
            };
        }

        return null;
    }

    /**
     * Extract previously discussed flight destination from context
     */
    extractFlightDestinationFromContext() {
        // Look through recent messages for location mentions
        // ONLY check USER messages, not assistant responses
        const recentMessages = this.chatHistory.slice(-10);

        for (const msg of recentMessages) {
            // SKIP assistant/AI messages - only process human messages
            if (msg._getType && msg._getType() === 'ai') {
                continue;
            }
            if (msg.constructor && msg.constructor.name === 'AIMessage') {
                continue;
            }

            const content = typeof msg.content === 'string' ? msg.content : '';

            // Check for explicit from->to patterns first
            const fromToPattern = /(?:from|flying from|travel from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
            const fromToMatch = content.match(fromToPattern);
            if (fromToMatch) {
                return this.normalizeLocationForFlights(fromToMatch[2]); // Return destination
            }

            // Check for flight-related destination mentions
            const flightToPattern = /(?:fly to|flight to|flying to|flights to|travel to|going to|visit|visiting)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
            const match = content.match(flightToPattern);
            if (match) {
                return this.normalizeLocationForFlights(match[1]);
            }

            // Check for city/country mentions in responses
            const cityPattern = /\b(Lisbon|Paris|London|Tokyo|New York|Rome|Barcelona|Berlin|Madrid|Amsterdam|Prague|Vienna|Athens|Dublin|Istanbul|Dubai|Bangkok|Singapore|Sydney|Melbourne)\b/i;
            const cityMatch = content.match(cityPattern);
            if (cityMatch) {
                return cityMatch[1];
            }
        }

        return null;
    }

    /**
     * Extract previously discussed flight origin from context
     */
    extractFlightOriginFromContext() {
        // Look through recent messages for origin mentions
        // ONLY check USER messages, not assistant responses
        const recentMessages = this.chatHistory.slice(-10);

        for (const msg of recentMessages) {
            // SKIP assistant/AI messages - only process human messages
            if (msg._getType && msg._getType() === 'ai') {
                continue;
            }
            if (msg.constructor && msg.constructor.name === 'AIMessage') {
                continue;
            }

            const content = typeof msg.content === 'string' ? msg.content : '';

            // Check for explicit from->to patterns first (most reliable)
            const fromToPattern = /(?:from|flying from|travel from|traveling from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+([A-Z][a-z]+)/i;
            const fromToMatch = content.match(fromToPattern);
            if (fromToMatch) {
                return this.normalizeLocationForFlights(fromToMatch[1]); // Return origin
            }

            // Check for standalone "from X" mentions
            const fromPattern = /\b(?:from|leaving from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i;
            const fromMatch = content.match(fromPattern);
            if (fromMatch) {
                return this.normalizeLocationForFlights(fromMatch[1]);
            }
        }

        return null;
    }    /**
     * Normalize location names for flight service
     * Handles countries by converting to major cities
     */
    normalizeLocationForFlights(location) {
        const cityMap = {
            'israel': 'Tel Aviv',
            'portugal': 'Lisbon',
            'spain': 'Madrid',
            'france': 'Paris',
            'italy': 'Rome',
            'germany': 'Berlin',
            'uk': 'London',
            'united kingdom': 'London',
            'usa': 'New York',
            'united states': 'New York',
            'japan': 'Tokyo',
            'china': 'Beijing',
            'australia': 'Sydney'
        };

        const locationLower = location.toLowerCase().trim();
        return cityMap[locationLower] || location;
    }

    /**
     * Extract location from conversation context (looks for DESTINATION/target location)
     */
    extractLocationFromContext() {
        // Look through recent messages for destination mentions
        // ONLY check USER messages, not assistant responses
        const recentMessages = this.chatHistory.slice(-6); // Look at last 6 messages

        // Words that are NOT locations (time/action words)
        const excludeWords = [
            'september', 'october', 'november', 'december', 'january', 'february',
            'march', 'april', 'may', 'june', 'july', 'august',
            'find', 'best', 'time', 'week', 'month', 'year', 'tomorrow', 'today',
            'great', 'cool', 'place', 'the', 'a', 'during', 'when', 'where',
            'season', 'mid', 'peak', 'off', 'cheapest', 'expensive', 'direct'
        ];

        for (const msg of recentMessages) {
            // SKIP assistant/AI messages - only process human messages
            if (msg._getType && msg._getType() === 'ai') {
                continue;
            }
            if (msg.constructor && msg.constructor.name === 'AIMessage') {
                continue;
            }

            const content = msg.content;

            // Look for travel destination patterns (most specific first)
            const destinationPatterns = [
                // Explicit patterns first
                /travel(?:ing)?\s+(?:from\s+[a-z]+\s+)?to\s+([a-z]{2,}(?:\s+[a-z]+)?)\b/i,
                /(?:fly|flying)\s+(?:from\s+[a-z]+\s+)?to\s+([a-z]{2,}(?:\s+[a-z]+)?)\b/i,
                /(?:going|go)\s+to\s+([a-z]{2,}(?:\s+[a-z]+)?)\b/i,
                /(?:visit|visiting)\s+([a-z]{2,}(?:\s+[a-z]+)?)\b/i,
                /trip\s+to\s+([a-z]{2,}(?:\s+[a-z]+)?)\b/i,
                // "in [Location]" pattern - but must be followed by word boundary or punctuation
                /\bin\s+([A-Z][a-z]{2,})\b(?![,\s]+(?:in|during|when))/,
            ];

            for (const pattern of destinationPatterns) {
                const match = content.match(pattern);
                if (match && match[1]) {
                    let location = match[1].trim();

                    // Filter out time/action words (check each word in multi-word matches)
                    const words = location.toLowerCase().split(/\s+/);
                    if (words.some(word => excludeWords.includes(word))) {
                        continue; // Skip if any word is in exclude list
                    }

                    // Capitalize properly
                    location = location
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');

                    console.log(`      Found destination "${location}" in conversation history`);
                    return location;
                }
            }
        }

        return null;
    }

    /**
     * Extract currency conversion details from message
     */
    extractCurrencyConversion(message) {
        // Extract amount
        const amountMatch = message.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        if (!amountMatch) return null;

        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

        // Common currency patterns
        const currencyMap = {
            'shekel': 'ILS', 'shekels': 'ILS', 'nis': 'ILS', '₪': 'ILS',
            'euro': 'EUR', 'euros': 'EUR', '€': 'EUR',
            'dollar': 'USD', 'dollars': 'USD', '$': 'USD', 'usd': 'USD',
            'pound': 'GBP', 'pounds': 'GBP', '£': 'GBP',
            'yen': 'JPY', '¥': 'JPY'
        };

        const messageLower = message.toLowerCase();
        const foundCurrencies = [];

        for (const [keyword, code] of Object.entries(currencyMap)) {
            if (messageLower.includes(keyword)) {
                if (!foundCurrencies.includes(code)) {
                    foundCurrencies.push(code);
                }
            }
        }

        // If we found 2 different currencies, convert between them
        if (foundCurrencies.length >= 2) {
            return {
                amount,
                fromCurrency: foundCurrencies[0],
                toCurrency: foundCurrencies[1],
                reasoning: 'Currency conversion requested'
            };
        }

        // If we found 1 currency, assume converting to EUR for travel planning
        if (foundCurrencies.length === 1) {
            const fromCurrency = foundCurrencies[0];
            // Default target based on source
            const toCurrency = fromCurrency === 'EUR' ? 'USD' : 'EUR';

            return {
                amount,
                fromCurrency,
                toCurrency,
                reasoning: 'Budget conversion for travel planning'
            };
        }

        return null;
    }

    /**
     * Detect the type of place being searched for
     */
    detectPlaceType(message) {
        const messageLower = message.toLowerCase();

        // Define patterns for each place type
        const patterns = {
            'restaurants': /restaurant|eat|eating|food|dine|dining|cuisine|meal/,
            'cafes': /cafe|cafes|coffee|tea|breakfast|brunch/,
            'bars': /bar|bars|pub|pubs|nightlife|drink|cocktail|beer/,
            'museums': /museum|museums|gallery|galleries|art|exhibition/,
            'attractions': /attraction|attractions|landmark|landmarks|monument|monuments|sightseeing|tourist|visit|see/,
            'parks': /park|parks|garden|gardens|outdoor|nature/,
            'shopping': /shop|shopping|market|markets|mall|stores/,
            'things_to_do': /things to do|activities|entertainment|fun|experience/
        };

        // Check patterns in priority order
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(messageLower)) {
                return type;
            }
        }

        // Default to attractions if no specific type detected
        return 'attractions';
    }

    /**
     * Process a user message with structured reasoning
     */
    async processMessage(userMessage) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Identify query type for analytics (silent)
            const queryType = identifyQueryType(userMessage);

            const startTime = Date.now();
            const toolsUsed = [];
            let reasoningSteps = 0;

            // 🔥 FORCE TOOL DETECTION - detect required tools upfront
            const requiredTools = this.detectRequiredTools(userMessage);

            // Build messages array
            const messages = [
                new SystemMessage(REACT_COT_PROMPT),
                ...this.chatHistory,
            ];

            // Execute detected tools FIRST (before asking LLM)
            if (requiredTools.length > 0) {
                reasoningSteps++;

                for (const toolCall of requiredTools) {
                    const tool = travelTools.find(t => t.name === toolCall.name);
                    if (tool) {
                        try {
                            const toolResult = await tool.func(toolCall.args);

                            // Parse the JSON result to check success
                            let parsedResult;
                            try {
                                parsedResult = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;
                            } catch {
                                parsedResult = { rawResult: toolResult };
                            }

                            toolsUsed.push({
                                tool: tool.name,
                                input: toolCall.args,
                                result: parsedResult
                            });

                            // Add tool result to messages for LLM context
                            messages.push(new SystemMessage(
                                `Tool ${tool.name} was executed with arguments ${JSON.stringify(toolCall.args)} and returned:\n${JSON.stringify(toolResult, null, 2)}`
                            ));
                        } catch (error) {
                            console.error(`   ✗ Error executing ${tool.name}:`, error.message);
                            toolsUsed.push({
                                tool: tool.name,
                                input: toolCall.args,
                                result: { success: false, error: error.message }
                            });
                            messages.push(new SystemMessage(
                                `Tool ${tool.name} failed with error: ${error.message}`
                            ));
                        }
                    }
                }
            }

            // Add user message after tool results
            messages.push(new HumanMessage(userMessage));

            // Now ask LLM to synthesize response using tool results
            reasoningSteps++;
            let response = await this.llmWithTools.invoke(messages);

            // 🔥 VALIDATION: Check if LLM is using tool results properly
            if (toolsUsed.length > 0) {
                // Add STRICT_PROMPT immediately after tools execute
                messages.push(new SystemMessage(
                    `${STRICT_PROMPT}\n\n` +
                    `📊 TOOL RESULTS AVAILABLE ABOVE ⬆️\n` +
                    `You MUST use the exact data from these tools in your response.\n` +
                    `DO NOT invent prices, dates, or specific details that weren't provided.\n\n` +
                    `Tools executed: ${toolsUsed.map(t => t.tool).join(', ')}`
                ));

                const weatherTool = toolsUsed.find(t => t.tool === 'get_weather');
                const flightTool = toolsUsed.find(t => t.tool === 'search_flights');
                const currencyTool = toolsUsed.find(t => t.tool === 'convert_currency');

                // Validate weather tool usage
                if (weatherTool) {
                    const weatherMsg = messages.find(m =>
                        m._getType() === 'system' && m.content.includes('get_weather')
                    );

                    if (weatherMsg) {
                        try {
                            const resultMatch = weatherMsg.content.match(/returned:\n([\s\S]+)/);
                            if (resultMatch) {
                                const weatherData = JSON.parse(resultMatch[1]);

                                if (weatherData.success && weatherData.location) {
                                    const mentionsLocation = response.content.toLowerCase()
                                        .includes(weatherData.location.toLowerCase());

                                    if (!mentionsLocation) {
                                        messages.push(new SystemMessage(
                                            `🚨 CRITICAL INSTRUCTION:\n` +
                                            `The user asked about ${weatherData.location}.\n` +
                                            `Use this EXACT data:\n` +
                                            `- Location: ${weatherData.location}, ${weatherData.country}\n` +
                                            `- Temperature: ${weatherData.temperature}°C (feels like ${weatherData.feelsLike}°C)\n` +
                                            `- Condition: ${weatherData.condition}\n` +
                                            `- Humidity: ${weatherData.humidity}%\n` +
                                            `- Wind: ${weatherData.windSpeed} km/h`
                                        ));

                                        response = await this.llmWithTools.invoke(messages);
                                        reasoningSteps++;
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing weather data:', e.message);
                        }
                    }
                }

                // Validate flight tool usage - PREVENT HALLUCINATED PRICES
                if (flightTool) {
                    const flightMsg = messages.find(m =>
                        m._getType() === 'system' && m.content.includes('search_flights')
                    );

                    if (flightMsg) {
                        try {
                            const resultMatch = flightMsg.content.match(/returned:\n([\s\S]+)/);
                            if (resultMatch) {
                                const flightData = JSON.parse(resultMatch[1]);

                                // Check if response contains hallucinated prices (e.g., "$230", "$240")
                                const responseText = response.content || '';
                                const hasPricePattern = /\$\d{2,4}(?!\d)/.test(responseText);
                                const hasSpecificDatePattern = /(?:March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?/.test(responseText);
                                const hasAirlineNames = /(?:Turkish|Lufthansa|Austrian|Emirates|United|Delta|British Airways|Air France|KLM)\s+Airlines?/i.test(responseText);

                                if (hasPricePattern || hasSpecificDatePattern || hasAirlineNames) {
                                    messages.push(new SystemMessage(
                                        `🚨 HALLUCINATION DETECTED! You invented flight details.\n\n` +
                                        `CORRECT RESPONSE FORMAT:\n` +
                                        `"I've found flight options from ${flightData.from} to ${flightData.to}.\n` +
                                        `Check current prices and availability on:\n` +
                                        `${flightData.bookingLinks ? flightData.bookingLinks.map(link => `- ${link.name}: ${link.url}`).join('\n') : ''}\n\n` +
                                        `${flightData.tips ? flightData.tips.join('\n') : ''}\n\n` +
                                        `DO NOT INVENT:\n` +
                                        `- Specific prices like $230, $240, etc.\n` +
                                        `- Specific dates like "March 13th" or "March 15th"\n` +
                                        `- Airline names like Turkish Airlines, Lufthansa, etc.\n\n` +
                                        `Flight prices change constantly. Direct users to check the booking sites."`
                                    ));

                                    response = await this.llmWithTools.invoke(messages);
                                    reasoningSteps++;
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing flight data:', e.message);
                        }
                    }
                }

                // Validate currency tool usage
                if (currencyTool) {
                    const currencyMsg = messages.find(m =>
                        m._getType() === 'system' && m.content.includes('convert_currency')
                    );

                    if (currencyMsg) {
                        try {
                            const resultMatch = currencyMsg.content.match(/returned:\n([\s\S]+)/);
                            if (resultMatch) {
                                const currencyData = JSON.parse(resultMatch[1]);

                                if (currencyData.success && currencyData.converted) {
                                    // Check if response mentions the converted amount
                                    const responseText = response.content || '';
                                    const convertedStr = currencyData.converted.toString();
                                    const mentionsAmount = responseText.includes(convertedStr) ||
                                        responseText.includes(Math.round(currencyData.converted).toString());

                                    if (!mentionsAmount) {
                                        messages.push(new SystemMessage(
                                            `🚨 CRITICAL INSTRUCTION:\n` +
                                            `Use this EXACT currency conversion:\n` +
                                            `${currencyData.amount} ${currencyData.fromCurrency} = ${currencyData.converted.toFixed(2)} ${currencyData.toCurrency}\n` +
                                            `Rate: ${currencyData.rate.toFixed(4)}`
                                        ));

                                        response = await this.llmWithTools.invoke(messages);
                                        reasoningSteps++;
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing currency data:', e.message);
                        }
                    }
                }
            }

            const duration = Date.now() - startTime;

            const finalAnswer = response.content || "I apologize, but I'm having trouble formulating a response. Could you rephrase your question?";

            this.chatHistory.push(new HumanMessage(userMessage));
            this.chatHistory.push(new AIMessage(finalAnswer));

            if (this.chatHistory.length > 20) {
                this.chatHistory = this.chatHistory.slice(-20);
            }

            return {
                success: true,
                content: finalAnswer,
                queryType,
                reasoning: {
                    steps: reasoningSteps,
                    toolsUsed,
                    duration,
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    model: config.ollama.model,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: 'I encountered an issue processing your request. Could you try rephrasing that?',
                details: error.message,
            };
        }
    }

    /**
     * Get conversation history
     */
    async getHistory() {
        return this.chatHistory.map(msg => ({
            role: msg._getType() === 'human' ? 'human' : 'ai',
            content: msg.content,
        }));
    }

    /**
     * Clear conversation history
     */
    async clearHistory() {
        this.chatHistory = [];
        console.log('🔄 Agent memory cleared');
    }

    /**
     * Get agent statistics
     */
    getStats() {
        return {
            initialized: this.initialized,
            toolsAvailable: travelTools.length,
            model: config.ollama.model,
            temperature: config.ollama.temperature,
        };
    }
}

// Export singleton instance
export const travelAgent = new TravelReasoningAgent();
