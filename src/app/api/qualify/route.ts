import { NextRequest, NextResponse } from 'next/server';
import { leadFormSchema } from '@/lib/validation/lead-schema';
import { qualificationService } from '@/lib/ai/gemini-client';
import { QualificationError } from '@/lib/ai/types';

/**
 * Re-runs AI qualification against an arbitrary lead payload without
 * touching the CRM. Used by the manual review queue (see brief: "Maybe
 * Qualified → Manual Review Queue") when a reviewer edits lead details and
 * wants an updated score before deciding whether to override it.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
    const qualification = await qualificationService.qualify({
      ...parsed.data,
      additionalNotes: parsed.data.additionalNotes || undefined,
    });
    return NextResponse.json({ qualification });
  } catch (err) {
    if (err instanceof QualificationError) {
      console.error('Qualification failed', err.cause);
      return NextResponse.json({ error: 'Unable to evaluate this lead right now.' }, { status: 502 });
    }
    throw err;
  }
}
