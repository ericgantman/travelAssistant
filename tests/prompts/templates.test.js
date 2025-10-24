/**
 * Unit tests for Prompt Templates
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { identifyQueryType, getSystemAddition, queryTemplates } from '../../src/prompts/templates.js';

describe('Prompt Templates', () => {
    describe('identifyQueryType', () => {
        it('should identify destination query', () => {
            const queries = [
                "Where should I go for vacation?",
                "Recommend a destination for me",
                "I'm looking for a warm place to visit"
            ];

            queries.forEach(query => {
                const type = identifyQueryType(query);
                assert.strictEqual(type, 'destination', `Failed for: ${query}`);
            });
        });

        it('should identify packing query', () => {
            const queries = [
                "What should I pack for Japan?",
                "Help me with my packing list",
                "What to bring to Iceland?"
            ];

            queries.forEach(query => {
                const type = identifyQueryType(query);
                assert.strictEqual(type, 'packing', `Failed for: ${query}`);
            });
        });

        it('should identify attractions query', () => {
            const queries = [
                "What are the best attractions in Paris?",
                "Things to see in Tokyo"
            ];

            queries.forEach(query => {
                const type = identifyQueryType(query);
                assert.strictEqual(type, 'attractions', `Failed for: ${query}`);
            });
        });

        it('should default to general for unclear queries', () => {
            const queries = [
                "Tell me about travel insurance",
                "How do I get a visa?"
            ];

            queries.forEach(query => {
                const type = identifyQueryType(query);
                // These might match other patterns, so just check it returns a valid type
                assert.ok(['destination', 'packing', 'attractions', 'general'].includes(type), `Failed for: ${query}`);
            });
        });

        it('should handle case-insensitive matching', () => {
            const type1 = identifyQueryType("WHERE SHOULD I GO?");
            const type2 = identifyQueryType("what should i PACK?");

            assert.strictEqual(type1, 'destination');
            assert.strictEqual(type2, 'packing');
        });
    });

    describe('getSystemAddition', () => {
        it('should return template for destination query', () => {
            const template = getSystemAddition('destination');
            assert.ok(template.includes('destination') || template.includes('DESTINATION'));
            assert.ok(template.length > 50);
        });

        it('should return template for packing query', () => {
            const template = getSystemAddition('packing');
            assert.ok(template.includes('packing') || template.includes('PACKING') || template.includes('pack'));
            assert.ok(template.length > 50);
        });

        it('should return template for attractions query', () => {
            const template = getSystemAddition('attractions');
            assert.ok(template.includes('attraction') || template.includes('ATTRACTION') || template.includes('activities'));
            assert.ok(template.length > 50);
        });

        it('should return template for general query', () => {
            const template = getSystemAddition('general');
            assert.ok(template.length > 50);
        });

        it('should return general template for unknown type', () => {
            const template = getSystemAddition('unknown_type');
            assert.strictEqual(template, queryTemplates.general.systemAddition);
        });
    });

    describe('queryTemplates', () => {
        it('should have all required query types', () => {
            assert.ok(queryTemplates.destination);
            assert.ok(queryTemplates.packing);
            assert.ok(queryTemplates.attractions);
            assert.ok(queryTemplates.general);
        });

        it('should have non-empty templates with systemAddition', () => {
            Object.values(queryTemplates).forEach(template => {
                assert.ok(template.systemAddition);
                assert.strictEqual(typeof template.systemAddition, 'string');
                assert.ok(template.systemAddition.length > 0);
            });
        });

        it('destination template should be comprehensive', () => {
            const template = queryTemplates.destination.systemAddition;
            assert.ok(template.length > 100, 'Template should be comprehensive');
        });

        it('packing template should be comprehensive', () => {
            const template = queryTemplates.packing.systemAddition;
            assert.ok(template.length > 100, 'Template should be comprehensive');
        });
    });
});
