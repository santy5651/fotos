'use server';
/**
 * @fileOverview An AI flow to validate a Google AI API key.
 *
 * - validateApiKey - A function that handles the API key validation process.
 * - ValidateApiKeyInput - The input type for the validateApiKey function.
 * - ValidateApiKeyOutput - The return type for the validateApiKey function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateApiKeyInputSchema = z.object({
  apiKey: z.string().describe('The API key to validate.'),
});
export type ValidateApiKeyInput = z.infer<typeof ValidateApiKeyInputSchema>;

const ValidateApiKeyOutputSchema = z.object({
  success: z.boolean().describe('Whether the validation was successful.'),
  message: z.string().describe('A message describing the result.'),
});
export type ValidateApiKeyOutput = z.infer<typeof ValidateApiKeyOutputSchema>;

export async function validateApiKey(
  input: ValidateApiKeyInput
): Promise<ValidateApiKeyOutput> {
  return validateApiKeyFlow(input);
}

const validateApiKeyFlow = ai.defineFlow(
  {
    name: 'validateApiKeyFlow',
    inputSchema: ValidateApiKeyInputSchema,
    outputSchema: ValidateApiKeyOutputSchema,
  },
  async ({apiKey}) => {
    if (!apiKey || apiKey.trim() === '') {
      return {success: false, message: 'La clave de API no puede estar vacía.'};
    }
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          return {
            success: true,
            message: 'Clave de API válida y con acceso a los modelos.',
          };
        } else {
          return {
            success: false,
            message:
              'La clave de API es válida, pero no se encontraron modelos.',
          };
        }
      } else {
        const errorData = await response.json();
        const errorMessage =
          errorData?.error?.message ||
          `La validación falló con el estado: ${response.status}`;
        return {
          success: false,
          message: `Clave de API inválida o sin permisos. ${errorMessage}`,
        };
      }
    } catch (error) {
      console.error('Error de red en la validación de la clave de API:', error);
      return {
        success: false,
        message: 'Ocurrió un error de red durante la validación.',
      };
    }
  }
);
