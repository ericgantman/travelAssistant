# Travel Assistant 🌍✈️

AI-powered travel planning assistant with natural conversation flow, powered by Llama 3 8B and advanced prompt engineering.

## Features

### Core Capabilities
- 🗺️ **Destination Recommendations**: Get personalized travel suggestions based on your preferences
- 🎒 **Smart Packing Lists**: Season and destination-specific packing advice
- 🏛️ **Attraction Suggestions**: Curated recommendations for things to see and do
- 🌦️ **Real-time Weather Data**: Current weather conditions via Open-Meteo API
- 🌍 **Country Information**: Detailed country data via REST Countries API
- 💱 **Currency Exchange**: Real-time exchange rates and conversions via ExchangeRate-API
- 🏨 **Hotel Recommendations**: Accommodation advice and lodging tips via Wikivoyage
- ✈️ **Flight Information**: Flight booking guidance and airline recommendations

### Advanced Features
- 💬 **Context-Aware Conversations**: Remembers your preferences across the entire chat
- 🎨 **Rich CLI Experience**: Color-coded output, animations, and progress indicators
- 💾 **Conversation Export**: Save chat transcripts as markdown files
- 🔧 **Interactive Commands**: `/help`, `/save`, `/clear`, `/exit`
- ⚡ **Streaming Responses**: Real-time token-by-token output

## Setup

### Prerequisites
- Node.js 18+ installed
- Ollama installed ([download here](https://ollama.ai))

### Installation Steps

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Start Ollama**:
   ```bash
   ollama serve
   ```

3. **Pull the model**:
   ```bash
   ollama pull llama3:8b
   ```

4. **Run the assistant**:
   ```bash
   npm start
   ```

## Usage

### Sample Conversations

**Destination Planning**:
```
You: I'm looking for a warm beach destination in November
Assistant: [Provides recommendations with weather data and insights]
```

**Packing Help**:
```
You: What should I pack for Tokyo in winter?
Assistant: [Generates categorized packing list based on current weather]
```

**Attractions**:
```
You: What are the must-see places in Paris?
Assistant: [Suggests prioritized attractions with tips]
```

**Follow-up Questions**:
```
You: I prefer budget travel
Assistant: [Adjusts recommendations based on your preference]
You: What about street food?
Assistant: [Remembers context and provides relevant suggestions]
```

### Interactive Commands

- `/help` - Display available commands and usage tips
- `/save` - Export conversation to `transcripts/` folder
- `/clear` - Reset conversation history and start fresh
- `/exit` - Quit the application

## Architecture

### Technology Stack
- **LLM**: Ollama with Llama 3 8B (local, privacy-friendly)
- **Framework**: LangChain (ReAct agent pattern)
- **APIs**: Open-Meteo (weather), REST Countries (country data)
- **CLI**: Node.js with chalk, ora, readline

### Project Structure
```
src/
├── config.js              # Configuration settings
├── index-agent.js         # CLI interface and main loop
├── agents/
│   ├── reasoningAgent.js  # Core agent logic with ReAct pattern
│   └── tools.js           # LangChain tool definitions
├── llm/
│   └── client.js          # Ollama client wrapper
├── prompts/
│   ├── system.js          # System prompts and examples
│   └── templates.js       # Query-specific templates
└── services/
    ├── weather.js         # Weather data from Open-Meteo API
    ├── country.js         # Country data from REST Countries API
    ├── currency.js        # Currency exchange from ExchangeRate-API
    ├── hotels.js          # Hotel recommendations from Wikivoyage
    └── flights.js         # Flight information and booking guidance
```

## Prompt Engineering

This project demonstrates advanced prompt engineering techniques:

- **Chain of Thought**: 6-step reasoning framework for complex queries
- **Few-Shot Learning**: Examples demonstrating ideal response structure
- **Context Injection**: Tool data added as system messages
- **Query-Specific Templates**: Tailored instructions for different request types
- **Validation Layer**: Catches and corrects LLM hallucinations

See [PROMPT_ENGINEERING.md](PROMPT_ENGINEERING.md) for detailed documentation.

## Documentation

- **[PROMPT_ENGINEERING.md](PROMPT_ENGINEERING.md)**: Deep dive into prompt design decisions
- **[ENHANCEMENTS.md](ENHANCEMENTS.md)**: Advanced features and implementation details  
- **[ADDING_TOOLS.md](ADDING_TOOLS.md)**: Guide to adding new external API tools
- **[transcripts/](transcripts/)**: Sample conversation examples

## Requirements Met

✅ **Conversation-First Design**: Handles 3+ query types with natural flow  
✅ **Enhanced Prompt Engineering**: Chain of thought, few-shot, validation  
✅ **Simple Technical Implementation**: JavaScript + Ollama + CLI  
✅ **Data Augmentation**: Weather + Country APIs with smart blending  
✅ **Error Handling**: Graceful failures with user-friendly messages  
✅ **Context Management**: Tracks 14+ preference types across conversation  

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch
```

**Test Coverage**:
- 96 tests across 30 test suites
- Services: Weather, Country, and Currency extraction, formatting, caching
- Prompts: Query type detection, template generation, system prompts
- Configuration: Validation of all settings
- Agent Logic: Tool detection, message history, response validation

See [tests/README.md](tests/README.md) for detailed testing documentation.

### Testing
Run the assistant and test with various queries:
```bash
npm start
```

### Generating Transcripts
1. Have a conversation with the assistant
2. Type `/save` to export the transcript
3. Find the markdown file in `transcripts/` folder

### Configuration
Edit `src/config.js` to customize:
- Ollama host and model
- Temperature and max tokens
- API timeouts
- Context window size

## Troubleshooting

**"Ollama is not available"**:
- Ensure Ollama is running: `ollama serve`
- Check if model is pulled: `ollama list`

**Weather/Country data not appearing**:
- Check internet connection
- APIs are free and don't require keys
- Location extraction requires capitalized place names

**Slow responses**:
- Llama 3 8B model requires adequate RAM (4.7 GB)
- Close other applications
- Consider using llama3.2 (2 GB) for lower-end systems

## License

MIT

## Author

Eric Gantman - [GitHub](https://github.com/ericgantman)