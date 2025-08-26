import { ChatOpenAI } from "@langchain/openai";
import 'dotenv/config';
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import readline from 'readline';
const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0
});
const config = {
    configurable: {
        sessionId: "abc2",
    },
};
const filterMessages = (input) => input.chat_history.slice(-50);
let messages = [];
const messageHistories = {};
const prompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `You are a friendly and engaging AI who never corrects the user. If the user makes any mistakes, simply overlook them and keep the conversation flowing. Always focus on asking questions to maintain an interactive and pleasant dialogue.`,
    ],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
]);
const promptTeacher = ChatPromptTemplate.fromMessages([
    [
        "system",
        `You are a knowledgeable English teacher who provides brief, actionable tips when needed. Your advice should be clear and directly address the user’s specific needs. You'll receive a series of messages and should offer relevant feedback or guidance to help the user enhance their English skills`,
    ],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
]);
const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
        chat_history: filterMessages,
    }),
    prompt,
    model,
]);
const chain2 = RunnableSequence.from([
    RunnablePassthrough.assign({
        chat_history: filterMessages,
    }),
    promptTeacher,
    model,
]);
const withMessageHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: async (sessionId) => {
        if (messageHistories[sessionId] === undefined) {
            const messageHistory = new InMemoryChatMessageHistory();
            await messageHistory.addMessages(messages);
            messageHistories[sessionId] = messageHistory;
        }
        return messageHistories[sessionId];
    },
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
});
const withMessageHistory2 = new RunnableWithMessageHistory({
    runnable: chain2,
    getMessageHistory: async (sessionId) => {
        return messageHistories[sessionId];
    },
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
});
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}
async function chat() {
    try {
        while (true) {
            const answer = await askQuestion("User input: ");
            let response = await withMessageHistory.invoke({
                chat_history: messages,
                input: `Continue the conversation by responding the user: ${answer}`
            }, config);
            console.log("AI response:", response.content);
            response = await withMessageHistory2.invoke({
                chat_history: messages,
                input: `Analyze the messages and provide tips to help the user improve their English. 
                Only give tips if there are clear mistakes or areas for improvement. 
                If there are no tips to offer, the output should be 'NO_TIPS'. 
                Ensure that tips are concise and directly address the user's errors.`
            }, config);
            console.log("Teacher:", response.content);
            // If you want to exit the chat loop, you can add a condition here
            if (answer.toLowerCase() === 'exit') {
                break;
            }
        }
    }
    finally {
        rl.close();
    }
}
// Start the chat
chat().catch(console.error);
