'use server';
/**
 * @fileOverview An image processing AI agent that generates both tags and a description.
 *
 * - processImage - A function that handles the image processing.
 * - ProcessImageInput - The input type for the processImage function.
 * - ProcessImageOutput - The return type for the processImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProcessImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ProcessImageInput = z.infer<typeof ProcessImageInputSchema>;

const ProcessImageOutputSchema = z.object({
  tags: z.array(z.string()).describe('An array of relevant tags for the image.'),
  description: z.string().describe('A detailed textual description of the image.'),
});
export type ProcessImageOutput = z.infer<typeof ProcessImageOutputSchema>;

export async function processImage(input: ProcessImageInput): Promise<ProcessImageOutput> {
  return processImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processImagePrompt',
  input: {schema: ProcessImageInputSchema},
  output: {schema: ProcessImageOutputSchema},
  prompt: `You are an expert image analyst. Given the image, perform the following two tasks:
1. Generate a detailed textual description of its content, focusing on objects, scenery, colors, and any discernible actions or context.
2. Generate an array of relevant tags based on the image content.

Image: {{media url=photoDataUri}}`,
});

const processImageFlow = ai.defineFlow(
  {
    name: 'processImageFlow',
    inputSchema: ProcessImageInputSchema,
    outputSchema: ProcessImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
