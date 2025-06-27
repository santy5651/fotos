import { config } from 'dotenv';
config();

import '@/ai/flows/tag-image.ts';
import '@/ai/flows/describe-image-flow.ts';
import '@/ai/flows/process-image-flow.ts';
import '@/ai/flows/validate-api-key-flow.ts';
