/**
 * Travel Assistant with Advanced LangChain Reasoning Agent
 * Enhanced version with structured chain of thought and tool orchestration
 */

import readline from 'readline';
import chalk from 'chalk';
import { config } from './config.js';
import { travelAgent } from './agents/reasoningAgent.js';
import { promises as fs } from 'fs';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold.cyan('\n💬 You: ') + chalk.white(''),
});

// Track conversation for transcripts
let conversationLog = [];
let startTime = new Date();

/**
 * Welcome banner with agent information
 */
function printWelcome() {
    // Clear screen for clean start
    console.clear();

    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('       🌍  AI Travel Assistant - Your Journey Starts Here  ✈️      ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════╝'));

    console.log(chalk.dim('\n┌─ Powered By ─────────────────────────────────────────────────────┐'));
    console.log(chalk.dim('│') + chalk.white(' 🧠 LangChain ReAct Agent ') + chalk.gray('(Advanced Reasoning)') + chalk.dim('                │'));
    console.log(chalk.dim('│') + chalk.white(` 🤖 Ollama ${config.ollama.model} `) + chalk.gray('(8B Parameters)') + chalk.dim('                      │'));
    console.log(chalk.dim('│') + chalk.white(' 🔧 3 Specialized Tools ') + chalk.gray('(Weather • Country • Context)') + chalk.dim('       │'));
    console.log(chalk.dim('└──────────────────────────────────────────────────────────────────┘\n'));

    console.log(chalk.bold.yellow('💡 What I Can Help With:\n'));
    console.log(chalk.cyan('   ✓') + chalk.white(' Find your perfect destination based on preferences'));
    console.log(chalk.cyan('   ✓') + chalk.white(' Create smart, personalized packing lists'));
    console.log(chalk.cyan('   ✓') + chalk.white(' Recommend must-see attractions and activities'));
    console.log(chalk.cyan('   ✓') + chalk.white(' Provide real-time weather and country insights\n'));

    console.log(chalk.bold.magenta('⚡ Quick Commands:\n'));
    console.log(chalk.gray('   /help    ') + chalk.white('→ Show this help message'));
    console.log(chalk.gray('   /history ') + chalk.white('→ View your conversation history'));
    console.log(chalk.gray('   /stats   ') + chalk.white('→ Show agent statistics'));
    console.log(chalk.gray('   /clear   ') + chalk.white('→ Start fresh conversation'));
    console.log(chalk.gray('   /save    ') + chalk.white('→ Export conversation to markdown'));
    console.log(chalk.gray('   /exit    ') + chalk.white('→ Exit the assistant\n'));

    console.log(chalk.dim('─'.repeat(66)));
    console.log(chalk.green.bold('  Ready! ') + chalk.white('Ask me anything about travel planning...\n'));
}

/**
 * Animated typing indicator with progress
 */
let typingInterval;
let thinkingStartTime;
function showTypingIndicator() {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    thinkingStartTime = Date.now();

    typingInterval = setInterval(() => {
        const elapsed = ((Date.now() - thinkingStartTime) / 1000).toFixed(1);
        const dots = '.'.repeat((i % 4));
        process.stdout.write(
            chalk.dim('\r│ ') +
            chalk.cyan(`${frames[i % frames.length]} Thinking${dots.padEnd(3, ' ')} `) +
            chalk.dim(`(${elapsed}s)`)
        );
        i++;
    }, 100);
}

function hideTypingIndicator() {
    clearInterval(typingInterval);
    process.stdout.write('\r' + ' '.repeat(70) + '\r');
}

/**
 * Format and display agent response with reasoning info
 */
function displayResponse(response) {
    if (!response.success) {
        console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(response.error));
        if (response.details) {
            console.log(chalk.dim(`   └─ ${response.details}`));
        }
        console.log();
        return;
    }

    // Show reasoning metadata in a compact, visual way
    if (response.reasoning) {
        const duration = response.reasoning.duration;
        const durationColor = duration < 3000 ? chalk.green : duration < 8000 ? chalk.yellow : chalk.red;
        const durationText = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;

        console.log('\n' + chalk.dim('┌─ Reasoning ───────────────────────────────────────────────────┐'));
        console.log(chalk.dim('│ ') + chalk.white('Steps: ') + chalk.cyan(response.reasoning.steps) +
            chalk.dim('  │  ') + chalk.white('Time: ') + durationColor(durationText));

        if (response.reasoning.toolsUsed && response.reasoning.toolsUsed.length > 0) {
            const tools = response.reasoning.toolsUsed.map(t => {
                const icon = t.tool === 'get_weather' ? '🌤️' :
                    t.tool === 'get_country_info' ? '🌍' : '🧠';
                return `${icon} ${t.tool.replace('get_', '').replace('_', ' ')}`;
            }).join(chalk.dim(' • '));
            console.log(chalk.dim('│ ') + chalk.white('Tools: ') + tools);
        }
        console.log(chalk.dim('└───────────────────────────────────────────────────────────────┘'));
    }

    // Format and display the response with better visual hierarchy
    console.log('\n' + chalk.bgGreen.black.bold(' ASSISTANT ') + '\n');

    const formatted = formatResponse(response.content);
    console.log(formatted);

    console.log('\n' + chalk.dim('─'.repeat(66)) + '\n');
}

/**
 * Format response with colors and structure
 */
function formatResponse(text) {
    // Split into paragraphs
    const paragraphs = text.split('\n\n');

    return paragraphs.map(para => {
        // Highlight numbered lists (1., 2., etc.)
        if (para.match(/^\d+\./m)) {
            return para.split('\n').map(line => {
                if (line.match(/^\d+\.\s+\*\*/)) {
                    // Numbered list with bold (like "1. **When**")
                    return line.replace(/^(\d+)\.\s+\*\*([^*]+)\*\*/, (_, num, text) =>
                        chalk.cyan(`   ${num}.`) + ' ' + chalk.bold.yellow(text)
                    );
                } else if (line.match(/^\d+\./)) {
                    // Regular numbered list
                    return line.replace(/^(\d+)\./, chalk.cyan('   $1.'));
                }
                return '      ' + chalk.white(line);
            }).join('\n');
        }

        // Highlight section headers (lines ending with :)
        if (para.match(/^[A-Z][^:]+:$/m)) {
            return '\n' + chalk.bold.yellow('│ ' + para) + '\n' + chalk.dim('│');
        }

        // Highlight bullet points
        if (para.startsWith('- ') || para.startsWith('• ')) {
            return para.split('\n').map(line => {
                if (line.startsWith('- ') || line.startsWith('• ')) {
                    return chalk.cyan('   •') + chalk.white(' ' + line.substring(2));
                }
                return '     ' + chalk.white(line);
            }).join('\n');
        }

        // Highlight bold text (**text**)
        para = para.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold.yellow(text));

        // Highlight numbers (prices, temperatures)
        para = para.replace(/\$\d+/g, match => chalk.bold.green(match));
        para = para.replace(/\d+°[CF]/g, match => chalk.bold.cyan(match));

        // Highlight questions
        if (para.includes('?')) {
            para = para.split('\n').map(line => {
                if (line.trim().endsWith('?')) {
                    return chalk.bold.white('   ❓ ' + line.trim());
                }
                return line;
            }).join('\n');
        }

        // Highlight special notes (P.S., Note:, etc.)
        if (para.match(/^\(P\.S\.|^\(Note:|^\(Tip:/i)) {
            return chalk.dim('   💡 ' + para);
        }

        return chalk.white(para);
    }).join('\n\n');
}

/**
 * Process user input
 */
async function processInput(input) {
    const trimmed = input.trim();

    if (!trimmed) {
        rl.prompt();
        return;
    }

    // Handle commands
    if (trimmed.startsWith('/')) {
        await handleCommand(trimmed);
        rl.prompt();
        return;
    }

    // Log user message
    conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'user',
        content: trimmed,
    });

    // Process with agent
    showTypingIndicator();

    const response = await travelAgent.processMessage(trimmed);

    hideTypingIndicator();

    // Log assistant response
    conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'assistant',
        content: response.content || response.error,
        success: response.success,
        reasoning: response.reasoning,
    });

    displayResponse(response);
    rl.prompt();
}

/**
 * Handle special commands
 */
async function handleCommand(command) {
    const cmd = command.toLowerCase().split(' ')[0];

    switch (cmd) {
        case '/help':
            printWelcome();
            break;

        case '/history':
            await displayHistory();
            break;

        case '/stats':
            displayStats();
            break;

        case '/clear':
            await travelAgent.clearHistory();
            conversationLog = [];
            console.log(chalk.green('\n✅ Conversation cleared\n'));
            break;

        case '/save':
            await saveTranscript();
            break;

        case '/exit':
            console.log(chalk.yellow('\n👋 Thanks for using AI Travel Assistant!'));
            console.log(chalk.gray('Safe travels! ✈️\n'));
            process.exit(0);
            break;

        default:
            console.log(chalk.red(`\n❌ Unknown command: ${command}`));
            console.log(chalk.gray('Type /help to see available commands\n'));
    }
}

/**
 * Display conversation history
 */
async function displayHistory() {
    const history = await travelAgent.getHistory();

    if (history.length === 0) {
        console.log(chalk.gray('\n📭 No conversation history yet\n'));
        return;
    }

    console.log(chalk.bold.cyan('\n📜 Conversation History:\n'));

    history.forEach((msg, idx) => {
        const prefix = msg.role === 'human' ? chalk.cyan('👤 You:') : chalk.green('🤖 Assistant:');
        const content = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
        console.log(`${idx + 1}. ${prefix} ${content}`);
    });

    console.log(chalk.gray(`\nTotal messages: ${history.length}\n`));
}

/**
 * Display agent statistics
 */
function displayStats() {
    const stats = travelAgent.getStats();
    const duration = Math.floor((Date.now() - startTime.getTime()) / 1000);

    console.log(chalk.bold.cyan('\n📊 Agent Statistics:\n'));
    console.log(chalk.white(`🤖 Status: ${stats.initialized ? chalk.green('Initialized') : chalk.red('Not initialized')}`));
    console.log(chalk.white(`🧠 Model: ${chalk.yellow(stats.model)}`));
    console.log(chalk.white(`🌡️  Temperature: ${chalk.yellow(stats.temperature)}`));
    console.log(chalk.white(`🔧 Tools Available: ${chalk.yellow(stats.toolsAvailable)}`));
    console.log(chalk.white(`💬 Messages: ${chalk.yellow(conversationLog.length)}`));
    console.log(chalk.white(`⏱️  Session Duration: ${chalk.yellow(duration + 's')}`));
    console.log();
}

/**
 * Save conversation transcript
 */
async function saveTranscript() {
    if (conversationLog.length === 0) {
        console.log(chalk.gray('\n📭 No conversation to save\n'));
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `conversation-${timestamp}.md`;

    let markdown = '# Travel Assistant Conversation\n\n';
    markdown += `**Date:** ${new Date().toLocaleString()}\n`;
    markdown += `**Model:** ${config.ollama.model}\n`;
    markdown += `**Agent Type:** LangChain ReAct with Chain of Thought\n`;
    markdown += `**Messages:** ${conversationLog.length}\n\n`;
    markdown += '---\n\n';

    conversationLog.forEach((msg, idx) => {
        const role = msg.role === 'user' ? '👤 **You**' : '🤖 **Assistant**';
        markdown += `## Message ${idx + 1}: ${role}\n\n`;
        markdown += `*${new Date(msg.timestamp).toLocaleTimeString()}*\n\n`;
        markdown += `${msg.content}\n\n`;

        if (msg.reasoning) {
            markdown += `*Reasoning: ${msg.reasoning.steps} steps, ${msg.reasoning.duration}ms*\n\n`;
        }

        markdown += '---\n\n';
    });

    try {
        await fs.writeFile(filename, markdown);
        console.log(chalk.green(`\n✅ Conversation saved to: ${filename}\n`));
    } catch (error) {
        console.log(chalk.red(`\n❌ Error saving transcript: ${error.message}\n`));
    }
}

/**
 * Main application entry point
 */
async function main() {
    printWelcome();

    // Initialize agent with loading animation
    process.stdout.write(chalk.dim('│ ') + chalk.cyan('⚙️  Initializing AI agent'));
    const dots = setInterval(() => process.stdout.write(chalk.cyan('.')), 200);

    await travelAgent.initialize();

    clearInterval(dots);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    console.log(chalk.dim('│ ') + chalk.green('✓ Agent ready\n'));

    rl.prompt();

    rl.on('line', async (input) => {
        await processInput(input);
    });

    rl.on('close', () => {
        console.log(chalk.yellow('\n👋 Goodbye!\n'));
        process.exit(0);
    });
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n❌ Unexpected error:'), error.message);
    rl.prompt();
});

// Start the application
main().catch(error => {
    console.error(chalk.red('Failed to start application:'), error);
    process.exit(1);
});
