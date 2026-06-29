import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { assertRequired, env } from '@/lib/config/env';
import type { LeadInput, QualificationResult } from '@/types';
import { QUALIFICATION_STATUSES } from '@/types';
import {
  QUALIFICATION_RESPONSE_SCHEMA,
  QualificationError,
  buildQualificationPrompt,
  type QualificationService,
} from './types';

/** Runtime validation of Gemini's response, independent of the JSON Schema we asked for. */
const qualificationResultSchema = z.object({
  score: z.number().int().min(1).max(10),
  status: z.enum(QUALIFICATION_STATUSES),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  recommendedNextStep: z.string().min(1),
  internalNotes: z.string().min(1),
});

export class GeminiQualificationService implements QualificationService {
  async qualify(lead: LeadInput): Promise<QualificationResult> {
    const cfg = assertRequired(['GEMINI_API_KEY'], 'Gemini qualification service');

    const genAI = new GoogleGenerativeAI(cfg.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: QUALIFICATION_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      },
    });

    let raw: string;
    try {
      const result = await model.generateContent(buildQualificationPrompt(lead));
      raw = result.response.text();
    } catch (cause) {
      throw new QualificationError('Gemini API call failed', cause);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new QualificationError(`Gemini returned non-JSON output: ${raw}`, cause);
    }

    const validated = qualificationResultSchema.safeParse(parsed);
    if (!validated.success) {
      throw new QualificationError(
        `Gemini response failed schema validation: ${validated.error.message}`
      );
    }

    return validated.data;
  }
}

/** Singleton instance used by the /api/qualify route. */
export const qualificationService: QualificationService = new GeminiQualificationService();
