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
            const response = await this.fetchJson(`${this.baseUrl}/api/tags`, {
                timeout: 3000,
            });

            const models = response.models || [];
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
            const response = await this.fetchJson(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                timeout: 60000,
                body: {
                    model: this.model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: this.temperature,
                    },
                },
            });

            return {
                content: response.message.content,
                success: true,
            };
        } catch (error) {
            console.error('LLM generation error:', error.message);

            if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
                return {
                    content: null,
                    success: false,
                    error: 'Cannot connect to Ollama. Please make sure Ollama is running (ollama serve).',
                };
            }

            if (error.status === 404) {
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

    async fetchJson(url, options = {}) {
        const {
            method = 'GET',
            body,
            timeout = 5000,
        } = options;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            const data = await response.json();

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeout}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Generates a streaming chat completion (for future enhancement)
     */
    async chatStream(messages, onChunk) {
        throw new Error('Streaming not yet implemented');
    }
}

export const ollamaClient = new OllamaClient();
