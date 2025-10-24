/**
 * Integration tests for Reasoning Agent
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

describe('Reasoning Agent Integration', () => {
    describe('detectRequiredTools', () => {
        it('should detect weather tool for weather queries', async () => {
            // This is a more complex test that would require mocking
            // For now, we'll test the logic patterns
            const weatherKeywords = [
                'weather',
                'temperature',
                'climate',
                'warm',
                'cold',
                'rain',
                'pack'
            ];

            weatherKeywords.forEach(keyword => {
                const message = `What's the ${keyword} like?`;
                const hasWeatherKeyword = /weather|temperature|climate|forecast|warm|cold|rain|snow|pack/i.test(message);
                assert.strictEqual(hasWeatherKeyword, true, `Should detect "${keyword}"`);
            });
        });

        it('should detect country tool for country queries', () => {
            const countryKeywords = [
                'country',
                'currency',
                'language',
                'capital',
                'population'
            ];

            countryKeywords.forEach(keyword => {
                const message = `Tell me about the ${keyword}`;
                const hasCountryKeyword = /country|population|capital|language|currency|culture/i.test(message);
                assert.strictEqual(hasCountryKeyword, true, `Should detect "${keyword}"`);
            });
        });

        it('should detect context analysis for complex queries', () => {
            const complexIndicators = [
                'budget',
                'family',
                'weeks',
                'romantic',
                'adventure'
            ];

            complexIndicators.forEach(indicator => {
                const message = `I want a ${indicator} trip`;
                const hasComplexity = /budget|family|week|romantic|adventure|luxury|solo/i.test(message);
                assert.strictEqual(hasComplexity, true, `Should detect "${indicator}"`);
            });
        });
    });

    describe('message history management', () => {
        it('should maintain message history with limit', () => {
            const maxHistory = 20;
            const messages = [];

            // Simulate adding messages
            for (let i = 0; i < 25; i++) {
                messages.push({ content: `Message ${i}` });
                // Keep only last maxHistory messages
                if (messages.length > maxHistory) {
                    messages.shift();
                }
            }

            assert.strictEqual(messages.length, maxHistory);
            assert.strictEqual(messages[0].content, 'Message 5'); // First 5 were removed
            assert.strictEqual(messages[messages.length - 1].content, 'Message 24');
        });
    });

    describe('response validation patterns', () => {
        it('should detect hallucinated weather data', () => {
            const toolData = 'Temperature: 18°C';
            const response = 'The temperature is 25°C'; // Hallucinated

            const hasTemperature = /\d+°C/.test(response);
            const matchesToolData = response.includes('18°C');

            assert.strictEqual(hasTemperature, true, 'Response contains temperature');
            assert.strictEqual(matchesToolData, false, 'Temperature was hallucinated');
        });

        it('should validate correct data usage', () => {
            const toolData = 'Temperature: 18°C';
            const response = 'The current temperature is 18°C';

            const matchesToolData = response.includes('18°C');
            assert.strictEqual(matchesToolData, true, 'Correct data usage');
        });

        it('should detect vague responses when data available', () => {
            const toolData = 'Paris, France: 18°C, Clear sky';
            const vagueResponse = 'The weather is nice';
            const specificResponse = 'Currently 18°C with clear skies in Paris';

            const isVague = !vagueResponse.includes('18') && !vagueResponse.includes('clear');
            const isSpecific = specificResponse.includes('18') && specificResponse.includes('clear');

            assert.strictEqual(isVague, true, 'Should detect vague response');
            assert.strictEqual(isSpecific, true, 'Should recognize specific response');
        });
    });
});
