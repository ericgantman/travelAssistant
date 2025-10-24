import dotenv from 'dotenv';

dotenv.config();

export const config = {
    ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3:8b',
        temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
    },
    openMeteo: {
        baseUrl: 'https://api.open-meteo.com/v1',
        geocodingUrl: 'https://geocoding-api.open-meteo.com/v1',
    },
    conversation: {
        maxHistoryLength: parseInt(process.env.MAX_HISTORY_LENGTH) || 10,
    },
};
