import nodemailer from 'nodemailer';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

// Create email transporter
const createTransporter = () => {
  if (!process.env.EMAIL_SERVICE || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email configuration not found. Email features will be disabled.');
    return null;
  }

  return nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, userName) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    logger.warn('Email service not configured. Reset token will be logged instead.');
    logger.info(`Password reset token for ${email}: ${resetToken}`);
    return { success: true, message: 'Reset token logged (email service not configured)' };
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'FlowlyHub - Reset Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #007bff; margin: 0;">FlowlyHub</h1>
          <p style="color: #6c757d; margin: 5px 0;">Sistem Manajemen UMKM</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2 style="color: #333;">Reset Password</h2>
          <p>Halo ${userName || 'User'},</p>
          <p>Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah ini untuk mereset password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6c757d; font-size: 14px;">
            Atau salin link berikut ke browser Anda:<br>
            <a href="${resetUrl}" style="color: #007bff;">${resetUrl}</a>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #6c757d; font-size: 14px;">
              <strong>Penting:</strong>
              <br>• Link ini akan kedaluwarsa dalam 10 menit
              <br>• Jika Anda tidak meminta reset password, abaikan email ini
              <br>• Jangan berikan link ini kepada siapa pun
            </p>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>Email ini dikirim otomatis, mohon jangan dibalas.</p>
          <p>&copy; 2025 FlowlyHub. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent successfully to ${email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    // Fallback to logging the token
    logger.info(`Email failed, password reset token for ${email}: ${resetToken}`);
    throw new Error('Failed to send reset email. Please try again later.');
  }
};

// Send welcome email for new registration
export const sendWelcomeEmail = async (email, userName) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    logger.info(`Welcome email would be sent to ${email} (email service not configured)`);
    return { success: true, message: 'Welcome email skipped (email service not configured)' };
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Selamat Datang di FlowlyHub!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #007bff; margin: 0;">FlowlyHub</h1>
          <p style="color: #6c757d; margin: 5px 0;">Sistem Manajemen UMKM</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2 style="color: #333;">Selamat Datang!</h2>
          <p>Halo ${userName},</p>
          <p>Terima kasih telah mendaftar di FlowlyHub! Akun Anda telah berhasil dibuat dan siap digunakan.</p>
          
          <div style="background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0056b3; margin-top: 0;">Fitur yang tersedia:</h3>
            <ul style="color: #333; margin: 0;">
              <li>📊 Dashboard analitik</li>
              <li>📦 Manajemen stok barang</li>
              <li>👥 Manajemen karyawan</li>
              <li>📋 Absensi karyawan</li>
              <li>📈 Laporan penjualan</li>
              <li>🤖 AI Analytics</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Mulai Sekarang
            </a>
          </div>
          
          <p style="color: #6c757d; font-size: 14px;">
            Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi tim support kami.
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>Email ini dikirim otomatis, mohon jangan dibalas.</p>
          <p>&copy; 2025 FlowlyHub. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent successfully to ${email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
    // Don't throw error for welcome email failure - it's not critical
    return { success: false, error: error.message };
  }
};

export default {
  sendPasswordResetEmail,
  sendWelcomeEmail
};
