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
  model: string | undefined,
  key: string | undefined,
  messages?: ChatMessage[],
) => {
  const fullMessages: ChatMessage[] =
    messages && messages.length > 0
      ? [...messages, { role: 'user', content: inputCode }]
      : [{ role: 'user', content: inputCode }];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o', // force GPT-4o
      messages: fullMessages,
      temperature: 0.9,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.4,
      max_tokens: 300,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type !== 'event') return;

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
      };

      const parser = createParser(onParse);

      for await (const chunk of response.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};

