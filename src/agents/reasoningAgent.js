/**
 * Advanced Reasoning Agent with Chain of Thought
 * Uses LangChain's tool calling pattern for structured reasoning
 */

import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { travelTools } from './tools.js';
import { config } from '../config.js';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { identifyQueryType } from '../prompts/templates.js';

/**
 * Enhanced Chain of Thought prompt for ReAct agent with aggressive tool usage
 */
const REACT_COT_PROMPT = `You are an expert travel planning assistant with access to real-time data tools.

# CRITICAL RULES - READ CAREFULLY:

## � RULE #1: TOOL RESULTS ARE SACRED
- If a tool was executed, its results will appear in the conversation as a SystemMessage
- YOU MUST USE THE EXACT DATA from tool results
- NEVER make up or guess data when tool results are provided
- If tool failed (returned null/error), say you couldn't get that data

## 🔴 RULE #2: RESPOND NATURALLY
- Use the tool data to create a helpful, conversational response
- Don't mention the tool names or technical details
- Don't say "According to get_weather" - just use the data naturally
- Example: "Paris is currently 12°C with light rain" (from tool data)

## 🔴 RULE #3: BE ACCURATE
- Only state facts that come from tool results or general knowledge
- Don't make up specific numbers (temperature, prices, etc.)
- If uncertain, ask clarifying questions

## Response Format:
- Write naturally and conversationally
- Use real data from tools when available
- Be specific and actionable
- Keep responses concise but complete

Now help the user with their travel planning query using the tool results provided above!`;

const STRICT_PROMPT = `You are a travel assistant. Follow these rules EXACTLY:

🚨 CRITICAL RULES:

1. ANSWER THE CURRENT QUESTION ONLY
   - Look at the LAST user message to see what they just asked
   - Don't continue previous conversations
   - Don't talk about topics not mentioned in the current question

2. IF TOOL RESULTS ARE PROVIDED → USE THEM
   - Tool results appear as SystemMessage entries above
   - Extract the exact data from tool results
   - Use that data to answer the user's question
   - Example: If get_weather returned Berlin 5°C → say "Berlin is currently 5°C"

3. USE EXACT TOOL DATA - NO GUESSING
   - If tool says temperature: 5°C → say "5°C" not "around 5°C"
   - If tool says location: "Berlin" → talk about Berlin, not other cities
   - If tool failed → say you couldn't get that data
   - Don't make up data when tool provided real data

4. BE NATURAL AND CONCISE
   - Don't say "According to the tool..." or mention tool names
   - Just use the data conversationally
   - Keep responses short (2-3 sentences for simple queries)
   - Example: "Berlin is currently 5°C with clear skies. It's quite chilly!"

REMEMBER: Answer ONLY the current question using ONLY the tool data provided.`;

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
                    console.log(`   → Weather tool: Extracted location "${location}" from query`);

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
                    console.log(`   → Country tool: Extracted location "${location}" from query`);

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
                console.log(`\n🔍 Detected ${requiredTools.length} required tool(s) for this query`);

                for (const toolCall of requiredTools) {
                    const tool = travelTools.find(t => t.name === toolCall.name);
                    if (tool) {
                        try {
                            console.log(`🔧 Forcing execution: ${tool.name}(${JSON.stringify(toolCall.args)})`);
                            const toolResult = await tool.func(toolCall.args);
                            toolsUsed.push({ tool: tool.name, input: toolCall.args });

                            // Add tool result to messages for LLM context
                            messages.push(new SystemMessage(
                                `Tool ${tool.name} was executed with arguments ${JSON.stringify(toolCall.args)} and returned:\n${JSON.stringify(toolResult, null, 2)}`
                            ));
                        } catch (error) {
                            console.error(`   ✗ Error executing ${tool.name}:`, error.message);
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
                const weatherTool = toolsUsed.find(t => t.tool === 'get_weather');

                if (weatherTool) {
                    // Extract weather location from tool results
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
                                        // LLM ignored tool result - force retry with strict prompt
                                        console.warn(`⚠️  LLM ignored tool result for ${weatherData.location}, forcing strict response...`);

                                        messages[0] = new SystemMessage(STRICT_PROMPT);
                                        messages.push(new SystemMessage(
                                            `🚨 CRITICAL INSTRUCTION:\n` +
                                            `The user asked about ${weatherData.location}.\n` +
                                            `Use this EXACT data in your response:\n` +
                                            `- Location: ${weatherData.location}, ${weatherData.country}\n` +
                                            `- Temperature: ${weatherData.temperature}°C (feels like ${weatherData.feelsLike}°C)\n` +
                                            `- Condition: ${weatherData.condition}\n` +
                                            `- Humidity: ${weatherData.humidity}%\n` +
                                            `- Wind: ${weatherData.windSpeed} km/h\n\n` +
                                            `Respond in 2-3 sentences about the current weather in ${weatherData.location}.`
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
            }

            // Check if LLM response suggests using more tools (iterative reasoning)
            // Look for patterns like "I should check..." or "Let me get..."
            const maxIterations = 3;
            let iterations = 0;

            while (iterations < maxIterations) {
                const responseText = response.content || '';
                const needsMoreData = /(?:I should|let me|I need to|I'll) (?:check|get|fetch|look up|find)/i.test(responseText);

                if (!needsMoreData) break;

                // Try to detect what additional tool might be needed
                const additionalTools = this.detectRequiredTools(responseText);

                if (additionalTools.length === 0) break;

                console.log(`\n🔄 LLM suggested additional tool usage (iteration ${iterations + 1})`);
                reasoningSteps++;

                // Execute additional tools
                for (const toolCall of additionalTools) {
                    const tool = travelTools.find(t => t.name === toolCall.name);
                    if (tool) {
                        try {
                            console.log(`🔧 Executing suggested tool: ${tool.name}(${JSON.stringify(toolCall.args)})`);
                            const toolResult = await tool.func(toolCall.args);
                            toolsUsed.push({ tool: tool.name, input: toolCall.args });

                            messages.push(new SystemMessage(
                                `Additional tool ${tool.name} was executed and returned:\n${JSON.stringify(toolResult, null, 2)}`
                            ));
                        } catch (error) {
                            console.error(`   ✗ Error executing ${tool.name}:`, error.message);
                            messages.push(new SystemMessage(
                                `Tool ${tool.name} failed with error: ${error.message}`
                            ));
                        }
                    }
                }

                // Get updated response with new tool results
                reasoningSteps++;
                response = await this.llmWithTools.invoke(messages);
                iterations++;
            }

            const duration = Date.now() - startTime;

            // Extract final answer
            const finalAnswer = response.content || "I apologize, but I'm having trouble formulating a response. Could you rephrase your question?";

            // Update chat history
            this.chatHistory.push(new HumanMessage(userMessage));
            this.chatHistory.push(new AIMessage(finalAnswer));

            // Keep history manageable
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
