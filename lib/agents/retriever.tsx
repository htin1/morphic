import { CoreMessage, streamText, ToolCallPart, ToolResultPart } from 'ai'
import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { getModel } from '../utils'
import { AnswerSection } from '@/components/answer-section'
import { QdrantClient } from '@qdrant/js-client-rest'
import { getTools } from './tools'

import OpenAI from "openai";

type EmbeddingVectorType = number[] | { name: string; vector: number[]; } | { name: string; vector: { indices: number[]; values: number[]; }; };

const openai = new OpenAI();
const qdrantClient = new QdrantClient({ url: 'http://localhost:6333' })

// Decide whether inquiry is required for the user input
export async function retriever(
    uiStream: ReturnType<typeof createStreamableUI>,
    streamableText: ReturnType<typeof createStreamableValue<string>>,
    messages: CoreMessage[]
) {
    const useAnthropicProvider = !!process.env.ANTHROPIC_API_KEY
    // Extract the latest user message
    const userMessage = String(messages[messages.length - 1].content);

    const embeddingVector = await getEmbeddingVector(userMessage) as EmbeddingVectorType;
    // Query Qdrant for relevant documents
    const searchResult = await qdrantClient.search("temporal", {
        vector: embeddingVector,
        limit: 3
    });

    const concatenatedContent = searchResult.map(res => 
        `${res.payload?.['github_link']}\n${res.payload?.['context']}`).join('\n');

    const prompt = `Context: The following code snippets are part of the Temporal codebases to give you more context to answer the question.
    ${concatenatedContent}
    prompt:
    ${userMessage}
    `;

    let fullResponse = '';
    let hasError = false;
    let finishReason = '';
    const streamableAnswer = createStreamableValue<string>('');
    const answerSection = <AnswerSection result={streamableAnswer.value} />;
    console.log(prompt);

    const result = await streamText({
        model: getModel(),
        system: `You are a coding assistant that understands Temporal codebase. You will be given some code snippets to assist you in answering the question.
        The code snippets may or may not be directly related to the question, so please use your best knowledge to answer the question.
        If you think the code snippet is useful for the user, you can use it to answer the question, with the code snippet as well as the github link given to you.
        `,
        prompt,
        maxTokens: 2500,
        onFinish: async event => {
            finishReason = event.finishReason;
            fullResponse = event.text;
            streamableAnswer.done();
        }
    }).catch(err => {
        hasError = true;
        fullResponse = 'Error: ' + err.message;
        streamableText.update(fullResponse);
    })

    // If the result is not available, return an error response
    if (!result) {
        return { result, fullResponse, hasError, toolResponses: [] }
    }

    const hasToolResult = messages.some(message => message.role === 'tool')
    if (!useAnthropicProvider || hasToolResult) {
        uiStream.append(answerSection)
    }
    // Process the response
    const toolCalls: ToolCallPart[] = []
    const toolResponses: ToolResultPart[] = []
    for await (const delta of result.fullStream) {
        switch (delta.type) {
        case 'text-delta':
            if (delta.textDelta) {
                fullResponse += delta.textDelta
                if (useAnthropicProvider && !hasToolResult) {
                    streamableText.update(fullResponse)
                } else {
                    streamableAnswer.update(fullResponse)
                }
            }
            break
        case 'error':
            console.log('Error: ' + delta.error)
            hasError = true
            fullResponse += `\nError occurred while executing the tool`
            break
        }
    }
    messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: fullResponse }, ...toolCalls]
    })

    if (toolResponses.length > 0) {
        // Add tool responses to the messages
        messages.push({ role: 'tool', content: toolResponses })
    }
    
    return { result, fullResponse, hasError, toolResponses: [], finishReason: 'stop' };
}

function getEmbeddingVector(message: string): Promise<EmbeddingVectorType>  {
  return new Promise((resolve, reject) => {
    openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message,
    }).then((response) => {
      resolve(response.data[0].embedding);
    }).catch((error) => {
      reject(error);
    });
  });
}