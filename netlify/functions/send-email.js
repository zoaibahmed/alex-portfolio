const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    let rawBody = event.body || '{}';
    if (event.isBase64Encoded) {
      try {
        rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
      } catch (e) {
        console.warn('Base64 decode warning:', e);
      }
    }

    let data = {};
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      // Fallback in case sent as form-urlencoded
      const params = new URLSearchParams(rawBody);
      data = Object.fromEntries(params.entries());
    }

    const { name, email, service, message } = data;

    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Name, email, and message are required fields.',
          received: { hasName: !!name, hasEmail: !!email, hasMessage: !!message }
        })
      };
    }

    // Flexible env variable resolution (supports GMAIL_PASS, GMAIL_PASSWORD, APP_PASSWORD, etc.)
    const rawPass = (
      process.env.GMAIL_PASS || 
      process.env.GMAIL_PASSWORD || 
      process.env.GMAIL_APP_PASSWORD || 
      process.env.APP_PASSWORD || 
      process.env.EMAIL_PASS ||
      process.env.gmail_pass ||
      process.env.gmail_password
    );

    const gmailPass = rawPass ? rawPass.trim().replace(/\s+/g, '') : null;

    const gmailUser = (
      process.env.GMAIL_USER || 
      process.env.GMAIL_EMAIL || 
      process.env.EMAIL_USER || 
      'alexbruclee68@gmail.com'
    ).trim();

    if (!gmailPass) {
      console.warn('GMAIL_PASS is not detected in Netlify environment variables.');
      const matchingKeys = Object.keys(process.env).filter(k => 
        k.toLowerCase().includes('gmail') || 
        k.toLowerCase().includes('pass') || 
        k.toLowerCase().includes('mail')
      );

      return {
        statusCode: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'GMAIL_PASS is not detected yet. In Netlify, adding environment variables requires a new deploy to take effect.',
          detected_relevant_keys: matchingKeys,
          note: 'Please trigger a new deploy in Netlify or run git push.'
        })
      };
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });

    const mailOptions = {
      from: `"Alex · Studio Website" <${gmailUser}>`,
      to: 'alexbruclee68@gmail.com',
      replyTo: `"${name}" <${email}>`,
      subject: `[Client Inquiry] ${name} — ${service || 'General Project'}`,
      text: `Client Name: ${name}\nClient Email: ${email}\nService Scope: ${service || 'General Inquiry'}\n\nProject Overview:\n${message}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 10px; color: #111;">
          <div style="border-bottom: 2px solid #1D4ED8; padding-bottom: 16px; margin-bottom: 24px;">
            <h2 style="margin: 0; color: #111827; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">New Project Inquiry</h2>
            <p style="margin: 6px 0 0 0; color: #6B7280; font-size: 13px;">Received via alex-studio platform inquiry form</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; width: 130px; font-weight: 500;">Client Name:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 15px; font-weight: 600;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500;">Work Email:</td>
              <td style="padding: 10px 0; color: #1D4ED8; font-size: 15px; font-weight: 600;"><a href="mailto:${email}" style="color: #1D4ED8; text-decoration: none;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500;">Service Scope:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 15px; font-weight: 600;">${service || 'General Inquiry'}</td>
            </tr>
          </table>

          <div style="background: #F8F8F6; border: 1px solid #E5E7EB; padding: 18px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0 0 10px 0; color: #374151; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Project Overview & Requirements:</p>
            <p style="margin: 0; color: #1F2937; font-size: 14px; line-height: 1.65; white-space: pre-line;">${message}</p>
          </div>

          <div style="padding-top: 16px; border-top: 1px solid #E5E7EB; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9CA3AF;">You can reply directly to this email to respond to ${name} (${email})</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, message: 'Inquiry dispatched to inbox successfully!' })
    };
  } catch (error) {
    console.error('Nodemailer dispatch error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
