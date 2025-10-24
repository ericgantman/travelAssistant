import axios from 'axios';
import { config } from '../config.js';

/**
 * Ollama LLM client
 * Handles communication with the local Ollama instance
 */

class OllamaClient {
    constructor() {
        this.baseUrl = config.ollama.baseUrl;
        this.model = config.ollama.model;
        this.temperature = config.ollama.temperature;
    }

    /**
     * Checks if Ollama is running and the model is available
     */
    async checkAvailability() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 3000,
            });

            const models = response.data.models || [];
            const modelExists = models.some(m => m.name.includes(this.model));

            if (!modelExists) {
                console.warn(`Warning: Model '${this.model}' not found. Available models:`,
                    models.map(m => m.name).join(', '));
                return false;
            }

            return true;
        } catch (error) {
            console.error('Ollama connection error:', error.message);
            return false;
        }
    }

    /**
     * Generates a chat completion
     */
    async chat(messages) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/chat`,
                {
                    model: this.model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: this.temperature,
                    },
                },
                {
                    timeout: 60000, // 60 second timeout for responses
                }
            );

            return {
                content: response.data.message.content,
                success: true,
            };
        } catch (error) {
            console.error('LLM generation error:', error.message);

            if (error.code === 'ECONNREFUSED') {
                return {
                    content: null,
                    success: false,
                    error: 'Cannot connect to Ollama. Please make sure Ollama is running (ollama serve).',
                };
            }

            if (error.response?.status === 404) {
                return {
                    content: null,
                    success: false,
                    error: `Model '${this.model}' not found. Please pull it first: ollama pull ${this.model}`,
                };
            }

            return {
                content: null,
                success: false,
                error: `Error generating response: ${error.message}`,
            };
        }
    }

    /**
     * Generates a streaming chat completion (for future enhancement)
     */
    async chatStream(messages, onChunk) {
        // Placeholder for streaming implementation
        // Could be added later for better UX
        throw new Error('Streaming not yet implemented');
    }
}

export const ollamaClient = new OllamaClient();
