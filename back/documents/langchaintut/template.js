import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
dotenv.config();
const model = new ChatOpenAI({
  modelName: "gpt-4o",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
});

const template = await ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant. Answer the question: {question}"
);

const chain = template.pipe(model);
const response = await chain.invoke({
  question: "What is the capital of France?",
});
console.log(response.text); // "The capital of France is Paris."
