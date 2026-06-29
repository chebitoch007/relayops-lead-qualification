import { EmailProviderError, type EmailMessage, type EmailProvider } from './types';

abstract class UnimplementedEmailProvider implements EmailProvider {
  abstract readonly providerName: string;

  send(_message: EmailMessage): Promise<void> {
    throw new EmailProviderError(
      `send() is not yet implemented. Implement this provider's API call in ` +
        `src/lib/email/${this.providerName}.ts — the EmailProvider contract and factory wiring ` +
        `are already in place.`,
      this.providerName
    );
  }
}

/** Production-ready alternative to Gmail SMTP. Implement via the Resend SDK when ready to cut over. */
export class ResendProvider extends UnimplementedEmailProvider {
  readonly providerName = 'resend';
}

/** Production-ready alternative to Gmail SMTP. Implement via @sendgrid/mail when ready to cut over. */
export class SendgridProvider extends UnimplementedEmailProvider {
  readonly providerName = 'sendgrid';
}
