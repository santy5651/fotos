'use server';

/**
 * @fileOverview An image tagging AI agent.
 *
 * - tagImage - A function that handles the image tagging process.
 * - TagImageInput - The input type for the tagImage function.
 * - TagImageOutput - The return type for the tagImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TagImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TagImageInput = z.infer<typeof TagImageInputSchema>;

const TagImageOutputSchema = z.object({
  tags: z.array(z.string()).describe('An array of tags describing the image.'),
});
export type TagImageOutput = z.infer<typeof TagImageOutputSchema>;

export async function tagImage(input: TagImageInput): Promise<TagImageOutput> {
  return tagImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'tagImagePrompt',
  input: {schema: TagImageInputSchema},
  output: {schema: TagImageOutputSchema},
  prompt: `You are an expert image tagger.  Given the image, generate relevant tags.

Image: {{media url=photoDataUri}}`,
});

const tagImageFlow = ai.defineFlow(
  {
    name: 'tagImageFlow',
    inputSchema: TagImageInputSchema,
    outputSchema: TagImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
