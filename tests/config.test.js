/**
 * Unit tests for Configuration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { config } from '../../src/config.js';

describe('Configuration', () => {
    describe('ollama settings', () => {
        it('should have valid base URL', () => {
            assert.ok(config.ollama.baseUrl);
            assert.strictEqual(typeof config.ollama.baseUrl, 'string');
            assert.ok(config.ollama.baseUrl.startsWith('http'));
        });

        it('should have valid model name', () => {
            assert.ok(config.ollama.model);
            assert.strictEqual(typeof config.ollama.model, 'string');
            assert.ok(config.ollama.model.length > 0);
        });

        it('should have valid temperature', () => {
            assert.strictEqual(typeof config.ollama.temperature, 'number');
            assert.ok(config.ollama.temperature >= 0);
            assert.ok(config.ollama.temperature <= 2);
        });

        it('should have valid max tokens', () => {
            assert.strictEqual(typeof config.ollama.maxTokens, 'number');
            assert.ok(config.ollama.maxTokens > 0);
            assert.ok(config.ollama.maxTokens <= 100000);
        });
    });

    describe('openMeteo settings', () => {
        it('should have valid base URL', () => {
            assert.ok(config.openMeteo.baseUrl);
            assert.strictEqual(typeof config.openMeteo.baseUrl, 'string');
            assert.ok(config.openMeteo.baseUrl.startsWith('http'));
        });

        it('should have valid geocoding URL', () => {
            assert.ok(config.openMeteo.geocodingUrl);
            assert.strictEqual(typeof config.openMeteo.geocodingUrl, 'string');
            assert.ok(config.openMeteo.geocodingUrl.startsWith('http'));
        });
    });

    describe('conversation settings', () => {
        it('should have valid max history length', () => {
            assert.strictEqual(typeof config.conversation.maxHistoryLength, 'number');
            assert.ok(config.conversation.maxHistoryLength > 0);
            assert.ok(config.conversation.maxHistoryLength <= 100);
        });

        it('should have streaming enabled flag', () => {
            assert.strictEqual(typeof config.conversation.streamingEnabled, 'boolean');
        });
    });

    describe('agent settings', () => {
        it('should have valid max iterations', () => {
            assert.strictEqual(typeof config.agent.maxIterations, 'number');
            assert.ok(config.agent.maxIterations > 0);
            assert.ok(config.agent.maxIterations <= 10);
        });

        it('should have verbose flag', () => {
            assert.strictEqual(typeof config.agent.verbose, 'boolean');
        });
    });

    describe('configuration integrity', () => {
        it('should have all required top-level sections', () => {
            assert.ok(config.ollama, 'Should have ollama section');
            assert.ok(config.openMeteo, 'Should have openMeteo section');
            assert.ok(config.conversation, 'Should have conversation section');
            assert.ok(config.agent, 'Should have agent section');
        });

        it('should not have undefined values', () => {
            const checkObject = (obj, path = '') => {
                for (const [key, value] of Object.entries(obj)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    assert.notStrictEqual(
                        value,
                        undefined,
                        `${currentPath} should not be undefined`
                    );
                    if (typeof value === 'object' && value !== null) {
                        checkObject(value, currentPath);
                    }
                }
            };
            checkObject(config);
        });
    });
});
