import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const OpenAIStream = async (
  inputCode: string,
  _model: string,
  key: string | undefined,
  messages?: ChatMessage[],
) => {
  // Build conversation history
  const fullMessages: ChatMessage[] =
    messages && messages.length > 0
      ? [...messages, { role: 'user', content: inputCode }]
      : [{ role: 'user', content: inputCode }];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',               // 🔥 Force GPT-4o
      messages: fullMessages,
      temperature: 0.8,              // 🔥 Natural tone
      presence_penalty: 0.3,         // 🔥 Reduce repetitive structure
      frequency_penalty: 0.2,        // 🔥 Reduce repeated phrasing
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const error = await res.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;

          if (data === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content;

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch (err) {
            controller.error(err);
          }
        }
      });

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
