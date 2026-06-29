import type { LeadInput, QualificationResult } from '@/types';

/**
 * Contract the qualification service exposes to the rest of the app.
 * Route handlers (and n8n, via /api/qualify) depend on this function
 * signature only — swapping Gemini for another model later, or changing
 * prompt internals, never requires touching a caller.
 */
export interface QualificationService {
  qualify(lead: LeadInput): Promise<QualificationResult>;
}

export class QualificationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'QualificationError';
  }
}

/**
 * JSON Schema describing the exact shape Gemini must return. Passed as
 * the model's structured-output schema so qualification results are
 * type-safe by construction rather than parsed out of free text.
 * Mirrors QualificationResult in src/types/index.ts — if that type
 * changes, this schema must change with it.
 */
export const QUALIFICATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 1, maximum: 10 },
    status: { type: 'string', enum: ['qualified', 'maybe_qualified', 'not_qualified'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string' },
    recommendedNextStep: { type: 'string' },
    internalNotes: { type: 'string' },
  },
  required: ['score', 'status', 'confidence', 'summary', 'recommendedNextStep', 'internalNotes'],
} as const;

/**
 * Prompt template lives here, isolated from the API-calling code in
 * gemini-client.ts, so it can be iterated on, versioned, and documented
 * (see /docs/gemini-prompt.md) independently of transport concerns. This
 * is the "reusable and configurable" prompt the brief calls for: the
 * qualification criteria are written once and interpolated with lead
 * data, rather than re-typed per call site.
 *
 * NOTE: this is a v1 placeholder. Prompt engineering — calibrating score
 * bands, tone of internalNotes, edge cases for incomplete answers — is
 * deliberately scoped to the dedicated AI-qualification phase, not this
 * scaffolding pass.
 */
export function buildQualificationPrompt(lead: LeadInput): string {
  return `You are a B2B lead qualification analyst for a marketing agency.
Evaluate the inbound lead below and return a structured assessment.

Score 1-10 on overall fit, considering:
- Lead quality: how complete and specific are their answers?
- Buying intent: do they describe a concrete problem and urgency?
- Business maturity: team size and revenue relative to their stated challenge
- Automation readiness: existing CRM and process sophistication
- Estimated opportunity: lead volume and revenue band

Lead details:
- Company: ${lead.company} (${lead.website})
- Team size: ${lead.teamSize}
- Monthly revenue: ${lead.monthlyRevenue}
- Monthly lead volume: ${lead.monthlyLeadVolume}
- Existing CRM: ${lead.existingCrm}
- Biggest operational challenge: ${lead.biggestChallenge}
- Additional notes: ${lead.additionalNotes || '(none provided)'}

Return your assessment as JSON matching the required schema exactly.`;
}
