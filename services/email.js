import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function formatEmailHtml(watch) {
  const { movie, targetDate, theatre } = watch;
  const bookingUrl = process.env.MOVIE_URL;

  return `
  <div style="background:#f4f6f8;padding:40px 20px;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 25px rgba(0,0,0,0.08);">

      <div style="background:#e53935;padding:30px;text-align:center;color:white;">
        <h1 style="margin:0;font-size:28px;">🎬 Bookings Open!</h1>
        <p style="margin-top:10px;font-size:15px;opacity:0.9;">
          Your tracked movie is now available.
        </p>
      </div>

      <div style="padding:30px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px 0;color:#666;font-weight:bold;">Movie</td>
            <td style="padding:12px 0;color:#222;">${movie}</td>
          </tr>

          <tr>
            <td style="padding:12px 0;color:#666;font-weight:bold;">Date</td>
            <td style="padding:12px 0;color:#222;">${targetDate}</td>
          </tr>

          <tr>
            <td style="padding:12px 0;color:#666;font-weight:bold;">Theatre</td>
            <td style="padding:12px 0;color:#222;">${theatre}</td>
          </tr>
        </table>

        <div style="text-align:center;margin-top:35px;">
          <a
            href="${bookingUrl}"
            style="
              background:#e53935;
              color:white;
              text-decoration:none;
              padding:14px 28px;
              border-radius:8px;
              font-size:16px;
              font-weight:bold;
              display:inline-block;
            "
          >
            🎟️ Book Now on BookMyShow
          </a>
        </div>

        <hr style="margin:35px 0;border:none;border-top:1px solid #ececec;" />

        <p style="font-size:13px;color:#888;text-align:center;">
          Generated automatically by BookMyShow Booking Monitor.
        </p>
      </div>
    </div>
  </div>
  `;
}

function formatEmailText(watch) {
  return `
🎬 BOOKINGS OPEN!

Movie: ${watch.movie}
Date: ${watch.targetDate}
Theatre: ${watch.theatre}

Book now:
${process.env.MOVIE_URL}
`;
}

export async function sendEmailNotification(watch) {
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: process.env.EMAIL_USER,
      subject: `🎬 Bookings Open • ${watch.movie}`,
      html: formatEmailHtml(watch),
      text: formatEmailText(watch),
    });

    console.log('   ✅ Email notification sent');

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error(`   ❌ Email failed: ${error.message}`);

    return {
      success: false,
      error: error.message,
    };
  }
}