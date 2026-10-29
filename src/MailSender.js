import nodemailer from 'nodemailer';

class MailSender {
  constructor() {
    this._transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  sendEmail(targetEmail, data) {
    const message = {
      from: 'OpenJob',
      to: targetEmail,
      subject: `Lamaran Baru untuk ${data.job_title}`,
      text: `Halo ${data.owner_name},

Ada kandidat baru yang melamar untuk posisi "${data.job_title}".

Nama Pelamar  : ${data.applicant_name}
Email Pelamar : ${data.applicant_email}
Tanggal Lamar : ${data.application_date}

Silakan tinjau lamaran tersebut di dashboard OpenJob.`,
    };

    return this._transport.sendMail(message);
  }
}

export default MailSender;