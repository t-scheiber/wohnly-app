import * as nodemailer from "nodemailer";

// Create reusable transporter
const createTransporter = () => {
  // Check if email service is configured
  const emailService = process.env.EMAIL_SERVICE;
  const emailFrom = process.env.EMAIL_FROM;

  if (!emailService || !emailFrom) {
    console.warn("Email service not configured. Emails will be logged to console.");
    return null;
  }

  // Create transporter based on service type
  if (emailService === "smtp") {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } else if (emailService === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return null;
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = createTransporter();
  const emailFrom = process.env.EMAIL_FROM || "noreply@wohnly.app";

  if (!transporter) {
    // Log email instead of sending in development/when not configured
    // Email preview (development only)
    return true; // Return success for development
  }

  try {
    await transporter.sendMail({
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    });

    // Email sent successfully
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendLeaveConfirmationEmail(
  email: string,
  householdName: string,
  confirmUrl: string,
  cancelUrl: string,
  locale: "en" | "de" = "en"
): Promise<boolean> {
  const translations = {
    en: {
      subject: `Confirm leaving ${householdName}`,
      title: "Confirm Household Exit",
      greeting: "Hello,",
      message: `You have requested to leave the household "${householdName}".`,
      warning: "This action will remove you from the household and you will lose access to all shared data.",
      confirmButton: "Confirm & Leave Household",
      cancelButton: "Cancel Request",
      footer: "If you did not request this, please ignore this email or click Cancel.",
      thanks: "Best regards,<br/>The Wohnly Team",
    },
    de: {
      subject: `Austritt aus ${householdName} best\u00e4tigen`,
      title: "Haushalt-Austritt best\u00e4tigen",
      greeting: "Hallo,",
      message: `Sie haben beantragt, den Haushalt "${householdName}" zu verlassen.`,
      warning: "Diese Aktion entfernt Sie aus dem Haushalt und Sie verlieren den Zugriff auf alle gemeinsamen Daten.",
      confirmButton: "Best\u00e4tigen & Haushalt verlassen",
      cancelButton: "Anfrage abbrechen",
      footer: "Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail bitte oder klicken Sie auf Abbrechen.",
      thanks: "Mit freundlichen Gr\u00fc\u00dfen,<br/>Das Wohnly Team",
    },
  };

  const t = translations[locale];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wohnly</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">${t.title}</h2>

    <p>${t.greeting}</p>

    <p>${t.message}</p>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #92400e;">
        ${t.warning}
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${confirmUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px;">
        ${t.confirmButton}
      </a>

      <a href="${cancelUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px;">
        ${t.cancelButton}
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #6b7280; font-size: 14px;">${t.footer}</p>

    <p style="color: #6b7280; font-size: 14px;">${t.thanks}</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Wohnly - Household Management Made Simple</p>
  </div>
</body>
</html>
  `;

  const text = `
${t.title}

${t.greeting}

${t.message}

${t.warning}

Confirm & Leave: ${confirmUrl}
Cancel Request: ${cancelUrl}

${t.footer}

${t.thanks.replace(/<br\/>/g, "\n")}

---
Wohnly - Household Management Made Simple
  `;

  return sendEmail({
    to: email,
    subject: t.subject,
    html,
    text,
  });
}

export async function sendInviteEmail(
  email: string,
  householdName: string,
  inviteCode: string,
  inviterName: string,
  locale: "en" | "de" = "en"
): Promise<boolean> {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const joinUrl = `${appUrl}/${locale}/onboarding?code=${inviteCode}`;

  const translations = {
    en: {
      subject: `You're invited to join ${householdName}`,
      title: "Household Invitation",
      greeting: "Hello,",
      message: `${inviterName} has invited you to join their household "${householdName}" on Wohnly.`,
      description: "Wohnly helps you manage todos, chores, expenses, and subscriptions together with your household members.",
      inviteCode: "Your invite code:",
      joinButton: "Join Household",
      alternativeText: "Or copy and paste this link into your browser:",
      footer: "If you did not expect this invitation, you can safely ignore this email.",
      thanks: "Best regards,<br/>The Wohnly Team",
    },
    de: {
      subject: `Sie wurden zu ${householdName} eingeladen`,
      title: "Haushalt-Einladung",
      greeting: "Hallo,",
      message: `${inviterName} hat Sie zu ihrem Haushalt "${householdName}" auf Wohnly eingeladen.`,
      description: "Wohnly hilft Ihnen, Aufgaben, Putzpl\u00e4ne, Ausgaben und Abonnements gemeinsam mit Ihren Haushaltsmitgliedern zu verwalten.",
      inviteCode: "Ihr Einladungscode:",
      joinButton: "Haushalt beitreten",
      alternativeText: "Oder kopieren Sie diesen Link in Ihren Browser:",
      footer: "Falls Sie diese Einladung nicht erwartet haben, k\u00f6nnen Sie diese E-Mail ignorieren.",
      thanks: "Mit freundlichen Gr\u00fc\u00dfen,<br/>Das Wohnly Team",
    },
  };

  const t = translations[locale];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wohnly</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">${t.title}</h2>

    <p>${t.greeting}</p>

    <p>${t.message}</p>

    <p style="color: #6b7280;">${t.description}</p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">${t.inviteCode}</p>
      <p style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0; font-family: monospace; letter-spacing: 2px;">
        ${inviteCode}
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${joinUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        ${t.joinButton}
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; text-align: center;">${t.alternativeText}</p>
    <p style="color: #667eea; font-size: 12px; text-align: center; word-break: break-all;">${joinUrl}</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #6b7280; font-size: 14px;">${t.footer}</p>

    <p style="color: #6b7280; font-size: 14px;">${t.thanks}</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Wohnly - Household Management Made Simple</p>
  </div>
</body>
</html>
  `;

  const text = `
${t.title}

${t.greeting}

${t.message}

${t.description}

${t.inviteCode} ${inviteCode}

Join: ${joinUrl}

${t.footer}

${t.thanks.replace(/<br\/>/g, "\n")}

---
Wohnly - Household Management Made Simple
  `;

  return sendEmail({
    to: email,
    subject: t.subject,
    html,
    text,
  });
}
