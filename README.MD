# Travel Assistant 🌍✈️

AI-powered travel planning assistant with natural, context-aware conversations powered by Llama 3 8B and advanced prompt engineering.

---

## 🌟 Overview

This Travel Assistant demonstrates expert-level prompt engineering and LLM conversation design:

- **Natural conversation flow** with context retention across 20+ messages
- **Advanced prompt engineering** with 7-layer architecture
- **Real-time data integration** from 6 external APIs
- **Hallucination prevention** through validation layers
- **Production-quality code** with 165 automated tests

---

## ✨ Features

### Core Capabilities

- 🗺️ **Destination Recommendations** - Personalized suggestions based on budget, season, interests
- 🎒 **Smart Packing Lists** - Weather-aware, activity-specific advice
- 🏛️ **Local Attractions** - Curated recommendations with insider tips
- 🌦️ **Real-time Weather** - Current conditions via Open-Meteo API
- 🌍 **Country Information** - Culture, currency, language via REST Countries API
- 💱 **Currency Conversion** - Live exchange rates via ExchangeRate-API
- 🏨 **Hotel Search** - Accommodation recommendations via Wikivoyage
- ✈️ **Flight Information** - Booking links and travel tips

### Advanced Features

- 💬 **Context-Aware Conversations** - Remembers preferences across multi-turn dialogues
- 🎨 **Rich CLI Experience** - Color-coded output, animations, progress indicators
- 💾 **Conversation Export** - Save transcripts as markdown (`/save`)
- 🔧 **Interactive Commands** - `/help`, `/history`, `/stats`, `/clear`, `/exit`
- ⚡ **Streaming Responses** - Real-time token generation with typing indicators

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **Ollama** ([download](https://ollama.ai))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start Ollama (in separate terminal)
ollama serve

# 3. Pull Llama 3 model
ollama pull llama3:8b

# 4. Run the assistant
npm start
```

---

## 📖 Usage

### Example Conversations

**Multi-turn Planning**:
```
You: I want a warm beach destination in November under $2000

🤖: Based on current weather data, Cancún is perfect - 28°C and $1800 budget fits well...

You: What should I pack?

🤖: [Remembers Cancún context] For 28°C beach weather, pack light layers...

You: Show me hotels

🤖: [Searches Cancún hotels] Here are 5 options from $45/night...
```

**Real-time Data**:
```
You: What's the weather in Tokyo?

🤖: [Fetches live data] Currently 15°C (59°F), partly cloudy. Perfect for sightseeing!
```

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/save` | Export conversation to `transcripts/` |
| `/history` | View conversation messages |
| `/stats` | Show agent statistics |
| `/clear` | Reset conversation context |
| `/exit` | Quit the assistant |

---

## 🏗️ Architecture

### Tech Stack

- **LLM**: Ollama + Llama 3 8B (local, privacy-friendly)
- **Framework**: LangChain ReAct agent pattern
- **APIs**: 6 external data sources
- **Interface**: Node.js CLI (chalk, readline)

### Project Structure

```
src/
├── agents/
│   ├── reasoningAgent.js    # ReAct pattern + forced tool execution
│   └── tools.js              # 6 LangChain tools (weather, country, etc.)
├── prompts/
│   ├── system.js             # Chain of thought + validation prompts
│   └── templates.js          # Query-specific templates
├── services/                 # External API integrations
│   ├── weather.js            # Open-Meteo API
│   ├── country.js            # REST Countries API
│   ├── currency.js           # ExchangeRate-API
│   ├── hotels.js             # Wikivoyage scraping
│   ├── flights.js            # SerpAPI/mock data
│   └── places.js             # Google Places API/mock
└── index-agent.js            # CLI interface

tests/                        # 165 tests across 50 suites
transcripts/                  # Sample conversations
```

### Data Flow

```
User Input
    ↓
Query Type Detection (templates.js)
    ↓
Tool Detection (reasoningAgent.js) → Forced Execution
    ↓
LLM Response (with tool data in SystemMessage)
    ↓
Validation Layer (hallucination check)
    ↓
Formatted Output (CLI with colors/formatting)
```

---

## 🧠 Prompt Engineering

This project demonstrates **advanced prompt engineering** as the primary technical achievement.

### Key Techniques

1. **7-Layer Prompt Architecture**
   - Base system prompt (persona + principles)
   - Chain of thought (6-step reasoning)
   - Query-specific templates (destination, packing, etc.)
   - Few-shot examples (3 ideal responses)
   - Data integration prompt (natural blending)
   - Error recovery prompt (graceful failures)
   - Strict validation prompt (hallucination prevention)

2. **Forced Tool Execution**
   - **Problem**: Llama 3 8B has weak native function calling
   - **Solution**: Keyword detection with word boundaries → pre-execute tools → inject data as SystemMessage
   ```javascript
   // Prevents "eat" in "weather" from triggering
   const hasWeatherKeyword = /\b(weather|climate|temperature)\b/i.test(message);
   ```

3. **Validation Layer**
   - **Problem**: LLM might ignore tool data and hallucinate
   - **Solution**: Check if response uses exact tool data → if not, retry with STRICT_PROMPT
   ```javascript
   if (!mentionsLocation) {
       messages.push(new SystemMessage(STRICT_PROMPT));
       response = await llm.invoke(messages); // Retry
   }
   ```

4. **Context Injection**
   - Tool results added as `SystemMessage` (highest priority)
   - LLM receives: `[SystemPrompt, ChatHistory, ToolResults, UserMessage]`
   - Forces LLM to acknowledge external data

5. **Query-Specific Templates**
   - Destination: "Be specific - name actual places, not regions"
   - Packing: "Categorized list → Pro tips → Reassurance"
   - Attractions: "Mix 60% famous + 40% hidden gems"

---

## 🧪 Testing

**165 tests across 50 suites**

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch
```
