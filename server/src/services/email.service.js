import nodemailer from 'nodemailer';

const isConfigured = () =>
  Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

const transporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendAuthEmail = async ({ to, subject, text, html }) => {
  if (!isConfigured()) return false;

  await transporter().sendMail({
    from: process.env.EMAIL_FROM || 'FD Connect <noreply@fdconnect.in>',
    to,
    subject,
    text,
    html,
  });
  return true;
};
