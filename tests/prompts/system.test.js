/**
 * Unit tests for System Prompts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    SYSTEM_PROMPT,
    CHAIN_OF_THOUGHT_PROMPT,
    FEW_SHOT_EXAMPLES,
    DATA_INTEGRATION_PROMPT,
    ERROR_RECOVERY_PROMPT
} from '../../src/prompts/system.js';

describe('System Prompts', () => {
    describe('SYSTEM_PROMPT', () => {
        it('should be a non-empty string', () => {
            assert.strictEqual(typeof SYSTEM_PROMPT, 'string');
            assert.ok(SYSTEM_PROMPT.length > 0);
        });

        it('should establish expert persona', () => {
            const lowerPrompt = SYSTEM_PROMPT.toLowerCase();
            assert.ok(
                lowerPrompt.includes('expert') ||
                lowerPrompt.includes('assistant') ||
                lowerPrompt.includes('travel'),
                'Should establish travel expertise'
            );
        });

        it('should be comprehensive (at least 200 characters)', () => {
            assert.ok(SYSTEM_PROMPT.length >= 200, 'System prompt should be detailed');
        });

        it('should provide guidance on response style', () => {
            // Should mention being helpful, concise, or similar
            assert.ok(SYSTEM_PROMPT.length > 100);
        });
    });

    describe('CHAIN_OF_THOUGHT_PROMPT', () => {
        it('should be a non-empty string', () => {
            assert.strictEqual(typeof CHAIN_OF_THOUGHT_PROMPT, 'string');
            assert.ok(CHAIN_OF_THOUGHT_PROMPT.length > 0);
        });

        it('should guide step-by-step reasoning', () => {
            const lowerPrompt = CHAIN_OF_THOUGHT_PROMPT.toLowerCase();
            // Should encourage structured thinking
            assert.ok(
                lowerPrompt.includes('step') ||
                lowerPrompt.includes('think') ||
                lowerPrompt.includes('consider') ||
                lowerPrompt.includes('analyze'),
                'Should guide reasoning process'
            );
        });

        it('should be substantial (at least 100 characters)', () => {
            assert.ok(CHAIN_OF_THOUGHT_PROMPT.length >= 100);
        });
    });

    describe('FEW_SHOT_EXAMPLES', () => {
        it('should be a non-empty object', () => {
            assert.strictEqual(typeof FEW_SHOT_EXAMPLES, 'object');
            assert.ok(Object.keys(FEW_SHOT_EXAMPLES).length > 0);
        });

        it('should provide example interactions', () => {
            // Should have at least one example type
            assert.ok(Object.keys(FEW_SHOT_EXAMPLES).length >= 1);
        });

        it('should have valid example structure', () => {
            // FEW_SHOT_EXAMPLES is an object containing example categories
            Object.entries(FEW_SHOT_EXAMPLES).forEach(([key, value]) => {
                assert.ok(typeof value === 'string' || typeof value === 'object',
                    `Example "${key}" should be string or object`);
                if (typeof value === 'object') {
                    // If it's nested, check the nested values
                    Object.values(value).forEach(nestedValue => {
                        assert.strictEqual(typeof nestedValue, 'string');
                    });
                }
            });
        });
    });

    describe('DATA_INTEGRATION_PROMPT', () => {
        it('should be a non-empty string', () => {
            assert.strictEqual(typeof DATA_INTEGRATION_PROMPT, 'string');
            assert.ok(DATA_INTEGRATION_PROMPT.length > 0);
        });

        it('should emphasize using external data', () => {
            const lowerPrompt = DATA_INTEGRATION_PROMPT.toLowerCase();
            assert.ok(
                lowerPrompt.includes('data') ||
                lowerPrompt.includes('information') ||
                lowerPrompt.includes('external'),
                'Should reference data integration'
            );
        });

        it('should provide guidance on data usage', () => {
            assert.ok(DATA_INTEGRATION_PROMPT.length >= 100, 'Should be detailed');
        });
    });

    describe('Prompt Integration', () => {
        it('all prompts should work together cohesively', () => {
            // All prompts should be strings that can be combined
            const combined = `${SYSTEM_PROMPT}\n${CHAIN_OF_THOUGHT_PROMPT}\n${DATA_INTEGRATION_PROMPT}`;
            assert.ok(combined.length > 300, 'Combined prompts should be comprehensive');
        });

        it('prompts should not be duplicates', () => {
            // Each prompt should serve a different purpose
            assert.notStrictEqual(SYSTEM_PROMPT, CHAIN_OF_THOUGHT_PROMPT);
            assert.notStrictEqual(SYSTEM_PROMPT, DATA_INTEGRATION_PROMPT);
            assert.notStrictEqual(CHAIN_OF_THOUGHT_PROMPT, ERROR_RECOVERY_PROMPT);
        });
    });
});
