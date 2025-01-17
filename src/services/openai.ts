import { sql } from "kysely";
import { db } from "../db";
import OpenAI from "openai";

// Initialize the OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export async function generateAvatarResponse(params: {
  channelName: string | null;
  workspaceName: string;
  messages: { role: "assistant" | "user", content: string }[];
}): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "developer",
        content: `You are a helpful AI assistant in a workspace chat. You are responding in ${params.channelName ? `the #${params.channelName} channel` : 'a channel'} in the ${params.workspaceName} workspace. Keep responses concise and helpful.`
      },
    ...params.messages
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  return completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response at this time.";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    input: text,
    model: "text-embedding-3-large",
    dimensions: 2000,
  });

  return response.data[0].embedding;
} 