import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import {
  StringOutputParser,
  CommaSeparatedListOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import * as dotenv from "dotenv";
dotenv.config();
const model = new ChatOpenAI({
  modelName: "gpt-4o",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
});

/*
const template = await ChatPromptTemplate.fromTemplate(
  `Generate synonyms of the {word} user provided with comma seperated.`
);
const parser = new CommaSeparatedListOutputParser();

const chain = template.pipe(model).pipe(parser); //.pipe(parser);
const response = await chain.invoke({
  word: "obvious",
});

*/

const template = await ChatPromptTemplate.fromTemplate(
  `Extract the information from the following phrase.
  Formatting instructions:{format_instructions}
    Phrase: {phrase}`
);

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  name: "name of the person",
  age: "age of the person",
  city: "city of the person",
});

const parser2 = StructuredOutputParser.fromNamesAndDescriptions({
  isCredit: "is the house credit eligible",
  isFurnished: "is the house furnished",
  isRented: "is the house rented",
  buildingAge: "age of the building in years",
  buildingType: "type of the building like apartment, villa, etc.",
  floor: "floor number of the house",
  totalFloors: "total number of floors in the building",
  parking: "is there a parking space",
  heating:
    "type of heating like central, combi (natural gas or lng), etc. set one of these: merkezi, kombi, elektrikli, kalorifer",
  bedrooms: "number of bedrooms like 3+1",
  squaremeters: "size of the house in square meters",
  price: "price of the house in Turkish Lira",
  description: "description of the house",
  location: "location of the house",
  contact: "contact information of the person selling the house",
});

const chain = template.pipe(model).pipe(parser2);
/*
const response = await chain.invoke({
  phrase: "John is 30 years old and lives in New York.",
  format_instructions: parser.getFormatInstructions(),
});
*/
const response2 = await chain.invoke({
  phrase:
    "Satılık 3+1 İstanbul Üsküdar'da, 5 katlı apartmanda 2. katta, krediye uygun, sobalı, fiyat 4 milyon TL, 120 m2, park yeri yok, kiracılı, 5 yaşında. İletişim: 555-123-4567.",
  format_instructions: parser2.getFormatInstructions(),
});

console.log(response2); // "The capital of France is Paris."
