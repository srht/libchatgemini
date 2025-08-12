const { DynamicTool } = require("langchain/tools");
// Simple Greeting Tool
const greetingTool = new DynamicTool({
  name: "greeting",
  description:
    "Creates a personalized greeting. Input should be a person's name.",
  func: async (input) => {
    console.log(`Greeting tool called with: ${input}`);
    return `Hello ${input}! Nice to meet you! 👋`;
  },
});
