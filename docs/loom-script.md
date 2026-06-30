# Loom Walkthrough Script

**Target audience:** a marketing agency founder evaluating whether to hire
RelayOps.
**Length:** ~3.5–4.5 minutes.
**Tone:** confident, conversational, specific. No hype words, no "synergy,"
no pretending this solves world hunger — it qualifies leads and books
calls, and the script should sound as matter-of-fact as that.

Read each section at a normal talking pace; the time estimates assume
that, not a rushed read.

---

## 1. Hook (~30s)

[face to camera, no screen share yet]

Hey — quick one today. I want to show you something we built that solves
a problem almost every agency founder I talk to has, which is: you're
spending real hours every week reading inbound form submissions, trying
to figure out which ones are actually worth a call and which ones are
just going to waste forty-five minutes of your time.

So what I'm going to show you is a system that does that triage
automatically — qualifies the lead, scores it, and either books them
straight onto your calendar or routes them somewhere else, all before you
ever see the submission. Let's walk through it.

## 2. Form demo (~45s)

[switch to screen share — the live lead capture form]

This is the front door. Pretty standard-looking intake form on the
surface — name, company, monthly lead volume, revenue band, what their
biggest operational bottleneck is. Nothing exotic here on purpose; we
don't want to scare anyone off with twenty fields.

[show form — start filling it in]

Watch this bar up here as I fill it out — that's a live completion
indicator, it's not just decorative, it's actually tracking which
required fields are done. And everything's validated as you go — if I put
in a malformed email or skip something required, it tells me right here,
inline, before I even hit submit. No surprise error page at the end.

[fill remaining fields, click submit]

Okay — submitting now.

## 3. AI qualification (~60s)

[show loading state, then transition — can cut to a prepared example, or narrate live]

So here's where it gets interesting. The second that hits submit, this
isn't going into an inbox for someone to read later. It goes straight to
an AI model — we're using Gemini here — and the model's been given a
structured prompt that scores the lead from one to ten on fit: how big is
their lead volume, do they have actual budget, is the problem they
described something we'd actually solve.

[show the result / success page]

That comes back as a real structured score, not just a vague impression
— a number, a status, and a written reason. And that status is what
drives everything downstream. There are three lanes: qualified, maybe
qualified, and not qualified. A clearly strong fit gets fast-tracked. A
borderline one goes into a review queue for a human to glance at. And a
clear non-fit gets a polite, genuinely useful decline instead of either
silence or a pushy follow-up — which matters more than people think,
because a bad decline experience is bad word-of-mouth.

## 4. Qualified flow (~45s)

[switch to inbox / Google Sheet — show the actual artifacts]

So let's follow the qualified path, since that's the one everyone cares
about. The lead just got an email with a booking link straight to a
Calendly slot — no back-and-forth, no "let me check my calendar," it's
just right there in the email they already opened.

[show founder notification email]

At the same time, the founder — that's you — gets a notification with the
lead's info, the score, and the reasoning, so if you do want to glance at
it before the call, everything's already summarized for you instead of
you having to go dig through the original submission.

[show Google Sheets CRM row]

And every single one of these — qualified, maybe, or not — lands as a row
in a CRM. Right now that's Google Sheets because it's fast and free to
stand up, but that's genuinely swappable — the way we built it, moving to
HubSpot or Pipedrive later is a config change, not a rebuild.

## 5. n8n workflow (~45s)

[switch to n8n canvas]

Now, behind the scenes, this is the automation layer — n8n — and this is
honestly the part I think is most valuable to show you, because it's
where the system becomes *yours*, not some black box.

[show the three branches]

Three branches, matching those three qualification outcomes. Qualified
leads get an internal task created and the booking link logged. The
maybe-qualified ones get added to a nurture sequence and a manual review
queue, with a two-day follow-up reminder built in so nothing falls through
the cracks. Not-qualified gets archived — done, no further noise.

[point at a placeholder node]

Now — see this node here, the one hitting a placeholder URL? Every single
external integration in this workflow is built like that on purpose.
Right now it's pointed at a fake endpoint, but it's clearly labeled
exactly what it's for — so when we build this for your agency
specifically, swapping that for your actual Asana, or your actual
Mailchimp, or wherever your team already lives, is a couple of clicks, not
a rebuild. This is a template, not a toy.

## 6. Wrap (~30s)

[back to camera]

So that's the whole loop — form, AI scoring, automatic routing, booking,
and a CRM record, all without anyone on your team touching it unless the
workflow specifically routes it to a human.

And honestly — this is exactly how we'd build it for your agency. Same
architecture, same level of polish, just pointed at your tools instead of
placeholders. If this looks like something that'd actually give your team
hours back every week, let's talk about what it'd take to stand this up
for you.

[end screen / CTA]
