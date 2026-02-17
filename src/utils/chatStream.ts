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
  _model: string | undefined,
  key: string | undefined,
  messages?: ChatMessage[],
) => {
  const conversation =
    messages && messages.length > 0
      ? [
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: inputCode },
        ]
      : [{ role: 'user', content: inputCode }];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: conversation,
      temperature: 0.8,
      top_p: 0.9,
      max_output_tokens: 250,
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

          const text = json.output_text;
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
