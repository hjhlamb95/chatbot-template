import { ChatBody } from '@/types/types';
import { OpenAIStream } from '@/utils/chatStream';

const MODEL = "gpt-4o"; // Lock to GPT-4o

export async function POST(req: Request): Promise<Response> {
  try {
    const { inputCode, messages } = (await req.json()) as ChatBody;

    if (!messages || !Array.isArray(messages)) {
      return new Response('No messages provided', { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response('OpenAI API key not configured', { status: 500 });
    }

    const stream = await OpenAIStream(
      inputCode,
      MODEL, // Force GPT-4o
      process.env.OPENAI_API_KEY,
      messages
    );

    return new Response(stream);
  } catch (error) {
    console.error(error);
    return new Response('Error processing your request', { status: 500 });
  }
}
