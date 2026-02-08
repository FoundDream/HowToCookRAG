import openai from "openai";
import dotenv from "dotenv";
dotenv.config();

class AiClient {
  client: openai;

  constructor() {
    this.client = new openai({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
}

export default new AiClient();
