const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting for contact form
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many contact requests from this IP, please try again later.'
});

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Validation middleware
const validateContactForm = (req, res, next) => {
    const { firstName, lastName, email, message } = req.body;
    const errors = [];

    // Required field validation
    if (!firstName || firstName.trim().length === 0) {
        errors.push('First name is required');
    } else if (firstName.length < 2 || firstName.length > 50) {
        errors.push('First name must be between 2 and 50 characters');
    }

    if (!lastName || lastName.trim().length === 0) {
        errors.push('Last name is required');
    } else if (lastName.length < 2 || lastName.length > 50) {
        errors.push('Last name must be between 2 and 50 characters');
    }

    if (!email || email.trim().length === 0) {
        errors.push('Email is required');
    } else if (!validator.isEmail(email)) {
        errors.push('Please provide a valid email address');
    }

    if (!message || message.trim().length === 0) {
        errors.push('Message is required');
    } else if (message.length < 10 || message.length > 1000) {
        errors.push('Message must be between 10 and 1000 characters');
    }

    // Optional field validation
    if (req.body.company && req.body.company.length > 100) {
        errors.push('Company name must be less than 100 characters');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors: errors
        });
    }

    // Sanitize input
    req.body.firstName = validator.escape(firstName.trim());
    req.body.lastName = validator.escape(lastName.trim());
    req.body.email = email.trim().toLowerCase();
    req.body.company = req.body.company ? validator.escape(req.body.company.trim()) : '';
    req.body.message = validator.escape(message.trim());

    next();
};

// Contact form submission endpoint
app.post('/api/contact', contactLimiter, validateContactForm, async (req, res) => {
    const { firstName, lastName, email, company, message } = req.body;

    try {
        // Email to business owner
        const businessMailOptions = {
            from: process.env.EMAIL_USER,
            to: 'securetag6@gmail.com',
            subject: `New Contact Form Submission from ${firstName} ${lastName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #0f172a, #334155); color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">🛡️ New SecureTag Contact Form Submission</h2>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Name:</strong></td>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${firstName} ${lastName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Email:</strong></td>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><a href="mailto:${email}">${email}</a></td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Company:</strong></td>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${company || 'Not provided'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Message:</strong></td>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${message}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Submitted:</strong></td>
                                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                            </tr>
                        </table>
                    </div>
                    <div style="background: #e9ecef; padding: 15px; text-align: center; color: #6c757d;">
                        <p style="margin: 0; font-size: 12px;">This email was sent from the SecureTag contact form</p>
                        <p style="margin: 5px 0 0 0; font-size: 11px;">Built by Team Pentacode</p>
                    </div>
                </div>
            `
        };

        // Confirmation email to user
        const userMailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Thank you for contacting SecureTag',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #0f172a, #334155); color: white; padding: 30px; text-align: center;">
                        <h1 style="margin: 0;">🛡️ Thank You for Contacting SecureTag</h1>
                    </div>
                    <div style="padding: 30px; background: #ffffff;">
                        <p style="font-size: 16px; color: #333;">Dear ${firstName},</p>
                        <p style="font-size: 16px; color: #333; line-height: 1.6;">
                            Thank you for reaching out to us. We have received your message and our team will review it shortly.
                        </p>
                        <p style="font-size: 16px; color: #333; line-height: 1.6;">
                            We typically respond to all inquiries within 24-48 hours during business days.
                        </p>
                        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #06b6d4;">
                            <h3 style="margin-top: 0; color: #0f172a;">Your Message:</h3>
                            <p style="color: #64748b; font-style: italic;">"${message}"</p>
                        </div>
                        <p style="font-size: 16px; color: #333;">
                            If you have any urgent questions, please don't hesitate to email us directly at 
                            <a href="mailto:securetag6@gmail.com" style="color: #06b6d4;">securetag6@gmail.com</a>
                        </p>
                        <p style="font-size: 16px; color: #333;">
                            Best regards,<br>
                            <strong>The SecureTag Team</strong><br>
                            <em style="color: #64748b; font-size: 14px;">Team Pentacode</em>
                        </p>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; text-align: center;">
                        <p style="color: #6c757d; font-size: 14px; margin: 0;">
                            © 2025 SecureTag - Advanced Authentication Technology
                        </p>
                        <p style="color: #6c757d; font-size: 12px; margin: 10px 0 0 0;">
                            This is an automated response. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            `
        };

        // Send emails
        await transporter.sendMail(businessMailOptions);
        await transporter.sendMail(userMailOptions);

        console.log(`Contact form submission from ${firstName} ${lastName} (${email}) at ${new Date().toISOString()}`);

        res.status(200).json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Error sending email:', error);
        
        res.status(500).json({
            success: false,
            message: 'There was an error processing your request. Please try again later.'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'SecureTag Contact Form API'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'SecureTag Backend API',
        endpoints: {
            contact: 'POST /api/contact',
            health: 'GET /api/health'
        }
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});