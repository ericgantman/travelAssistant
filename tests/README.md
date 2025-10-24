# Unit Tests

This directory contains comprehensive unit tests for the Travel Assistant application.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

## Test Structure

```
tests/
├── agents/
│   └── reasoningAgent.test.js    # Integration tests for agent logic
├── prompts/
│   ├── templates.test.js         # Query template tests
│   └── system.test.js            # System prompt tests
├── services/
│   ├── weather.test.js           # Weather service tests
│   └── country.test.js           # Country service tests
└── config.test.js                # Configuration tests
```

## Test Coverage

### Services (70+ tests)
- **Weather Service**: Location extraction, weather code mapping, formatting, caching
- **Country Service**: Country extraction, data formatting, caching, query detection

### Prompts (30+ tests)
- **Templates**: Query type identification, template retrieval, content validation
- **System Prompts**: Prompt completeness, integration, purpose validation

### Configuration (15+ tests)
- **Ollama Settings**: URL, model, temperature, max tokens validation
- **API Settings**: Open-Meteo configuration
- **Agent Settings**: Iteration limits, verbosity flags
- **Integrity**: No undefined values, all required sections present

### Agent Logic (15+ tests)
- **Tool Detection**: Weather, country, and context analysis triggers
- **Message History**: Limit enforcement, message management
- **Response Validation**: Hallucination detection, data accuracy checks

## Test Philosophy

1. **Unit Tests**: Focus on individual functions and methods
2. **Integration Tests**: Test interaction between components
3. **Edge Cases**: Handle unusual inputs and boundary conditions
4. **Validation**: Ensure data integrity and type safety

## Writing New Tests

When adding new features, follow this pattern:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { yourFunction } from '../src/your-module.js';

describe('Your Module', () => {
    describe('yourFunction', () => {
        it('should handle normal case', () => {
            const result = yourFunction('input');
            assert.strictEqual(result, 'expected');
        });

        it('should handle edge case', () => {
            const result = yourFunction(null);
            assert.strictEqual(result, null);
        });
    });
});
```

## Testing Tools

- **Node.js Test Runner**: Built-in test framework (no external dependencies)
- **Assert Module**: Standard assertions for validation
- **Mock Functions**: For testing isolated components

## Test Metrics

- **Total Tests**: 130+
- **Test Files**: 6
- **Coverage Areas**: Services, Prompts, Configuration, Agent Logic
- **Edge Cases**: 40+

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm test
```

## Known Limitations

1. **External API Tests**: Currently not mocking actual API calls to Open-Meteo and REST Countries
2. **LLM Tests**: Not testing actual Ollama responses (would require running instance)
3. **CLI Tests**: Not testing terminal UI interactions

These limitations are intentional to keep tests fast and dependency-free. Integration testing with real services should be done manually.
