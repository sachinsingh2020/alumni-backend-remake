import { createTransport } from "nodemailer";

export const sendEmail = async (to, subject, text, html) => {
  const transporter = createTransport({
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    port: 465,
    host: 'smtp.gmail.com',
  });

  await transporter.sendMail({
    from: process.env.SMTP_MAIL,
    to,
    subject,
    text,
    html, // Include HTML content here
  });
};
