// Email.js
// --------
// Email Service Configuration and Management

import { createTransport } from "nodemailer";
import { ServEmail, EmailFromDef } from "../Cfg.js";

// Transport Configuration
// ---------------------
// Supports two email service configurations:
// 1. Gmail service
// 2. Custom SMTP server with TLS

let Transport = null;
const { service, NameUser, Pass, smtpHost } = ServEmail;
if (NameUser && Pass) {
  const auth = {
    user: NameUser,
    pass: Pass,
  };
  const oOpts =
    !service || service === "Gmail"
      ? {
          service: "Gmail",
          auth,
          pool: true,
        }
      : {
          host: smtpHost,
          port: 465,
          secure: true, // TLS enabled
          pool: true,
          auth,
          tls: {
            rejectUnauthorized: false, // Accept self-signed certificates
          },
        };
  const oDefs = {
    from: EmailFromDef,
  };
  Transport = createTransport(oOpts, oDefs);
}

/** Sends an email with retry capability on failure.
 *  @param {Object} aMsg - Email message object containing:
 *    - to: Recipient email address
 *    - subject: Email subject
 *    - text: Plain text content (optional if html is provided)
 *    - html: HTML content (optional if text is provided)
 *    - from: Sender address (optional, uses default if not provided)
 *  @param {number} retryCount - Number of retry attempts (internal use)
 *  @returns {Promise<void>}
 */
export async function wSend(aMsg, retryCount = 0) {
  if (!Transport) return;

  if (!aMsg.to || !aMsg.subject || (!aMsg.text && !aMsg.html))
    throw Error("Email wSend: Invalid message");

  try {
    await Transport.sendMail(aMsg);
  } catch (error) {
    console.error(`Error in sending email: ${error}`);
    if (retryCount < 3) {
      // If email sending fails, wait 5 seconds and then try again
      await new Promise(resolve => setTimeout(resolve, 500));
      await wSend(aMsg, retryCount + 1);
    } else {
      // If email sending fails 3 times, log the failure and give up
      console.error(`Failed to send email after 3 attempts: ${error}`);
    }
  }
}
