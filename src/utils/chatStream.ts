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
  const fullMessages: ChatMessage[] =
    messages && messages.length > 0
      ? [...messages, { role: 'user', content: inputCode }]
      : [{ role: 'user', content: inputCode }];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: fullMessages,
      temperature: 0.8,
      presence_penalty: 0.3,
      frequency_penalty: 0.2,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          if (event.data === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(event.data);

            const text =
              json.output?.[0]?.content?.[0]?.text ||
              json.delta?.output_text ||
              '';

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch (err) {
            controller.error(err);
          }
        }
      });

      for await (const chunk of response.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
