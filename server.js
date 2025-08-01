// SecureTag Backend - Node.js/Express Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/securetag', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Database Models
const UserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    company: String,
    role: { type: String, enum: ['admin', 'manufacturer', 'retailer', 'consumer'], default: 'consumer' },
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date,
    subscriptionPlan: { type: String, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' }
});

const ProductSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: String,
    price: Number,
    manufacturingDate: { type: Date, required: true },
    expiryDate: Date,
    batchNumber: String,
    serialNumber: String,
    origin: {
        country: String,
        state: String,
        city: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    secureTag: {
        qrCode: String,
        nfcId: String,
        tamperSeal: String,
        isActive: { type: Boolean, default: true },
        secretKey: String
    },
    status: {
        type: String,
        enum: ['active', 'recalled', 'expired', 'returned', 'destroyed'],
        default: 'active'
    },
    verificationCount: { type: Number, default: 0 },
    lastVerified: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const VerificationSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    verifier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    method: { type: String, enum: ['qr', 'nfc'], required: true },
    location: {
        country: String,
        state: String,
        city: String,
        coordinates: {
            lat: Number,
            lng: Number
        },
        ipAddress: String
    },
    deviceInfo: {
        userAgent: String,
        platform: String,
        browser: String
    },
    result: {
        type: String,
        enum: ['authentic', 'counterfeit', 'tampered', 'expired', 'recalled'],
        required: true
    },
    confidence: { type: Number, min: 0, max: 100 },
    timestamp: { type: Date, default: Date.now },
    additionalData: mongoose.Schema.Types.Mixed
});

const AnalyticsSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metrics: {
        totalVerifications: { type: Number, default: 0 },
        uniqueProducts: { type: Number, default: 0 },
        authenticVerifications: { type: Number, default: 0 },
        counterfeitDetections: { type: Number, default: 0 },
        tamperDetections: { type: Number, default: 0 },
        qrScans: { type: Number, default: 0 },
        nfcTaps: { type: Number, default: 0 }
    },
    geographic: [{
        country: String,
        state: String,
        verifications: Number
    }],
    devices: [{
        platform: String,
        count: Number
    }]
});

const ContactSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    company: String,
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'in-progress', 'resolved'], default: 'new' },
    createdAt: { type: Date, default: Date.now },
    respondedAt: Date
});

// Create models
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Verification = mongoose.model('Verification', VerificationSchema);
const Analytics = mongoose.model('Analytics', AnalyticsSchema);
const Contact = mongoose.model('Contact', ContactSchema);

// Email configuration
const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'securetag6@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Utility functions
const generateSecureId = () => crypto.randomBytes(16).toString('hex');
const generateQRData = (product) => {
    return `ST-${product.productId}-${product.secureTag.secretKey}`;
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'securetag-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// User Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, company, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Generate verification token
        const verificationToken = generateSecureId();

        // Create user
        const user = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            company,
            role: role || 'consumer',
            verificationToken
        });

        await user.save();

        // Send verification email
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SecureTag - Verify Your Email',
            html: `
                <h2>Welcome to SecureTag!</h2>
                <p>Please click the link below to verify your email address:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
            `
        });

        res.status(201).json({ 
            message: 'User created successfully. Please check your email for verification.',
            userId: user._id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if email is verified
        if (!user.isVerified) {
            return res.status(401).json({ error: 'Please verify your email before logging in' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET || 'securetag-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                company: user.company,
                role: user.role,
                subscriptionPlan: user.subscriptionPlan
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Product Management Routes
app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            price,
            manufacturingDate,
            expiryDate,
            batchNumber,
            serialNumber,
            origin
        } = req.body;

        // Generate unique product ID
        const productId = `ST${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Generate secure tag data
        const secretKey = generateSecureId();
        const nfcId = generateSecureId();
        const tamperSeal = generateSecureId();

        // Create product
        const product = new Product({
            productId,
            name,
            description,
            manufacturer: req.user.userId,
            category,
            price,
            manufacturingDate: new Date(manufacturingDate),
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            batchNumber,
            serialNumber,
            origin,
            secureTag: {
                nfcId,
                tamperSeal,
                secretKey
            }
        });

        // Generate QR code
        const qrData = generateQRData(product);
        const qrCodeUrl = await QRCode.toDataURL(qrData);
        product.secureTag.qrCode = qrCodeUrl;

        await product.save();

        res.status(201).json({
            message: 'Product created successfully',
            product: {
                id: product._id,
                productId: product.productId,
                name: product.name,
                qrCode: product.secureTag.qrCode,
                nfcId: product.secureTag.nfcId
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, category, status } = req.query;
        
        let query = {};
        
        // Filter by manufacturer if not admin
        if (req.user.role !== 'admin') {
            query.manufacturer = req.user.userId;
        }
        
        // Add search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { productId: { $regex: search, $options: 'i' } },
                { batchNumber: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Add category filter
        if (category) {
            query.category = category;
        }
        
        // Add status filter
        if (status) {
            query.status = status;
        }

        const products = await Product.find(query)
            .populate('manufacturer', 'firstName lastName company')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Product.countDocuments(query);

        res.json({
            products,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Product Verification Routes
app.post('/api/verify/qr', async (req, res) => {
    try {
        const { qrData, location, deviceInfo } = req.body;

        // Parse QR data
        const qrParts = qrData.split('-');
        if (qrParts.length < 3 || qrParts[0] !== 'ST') {
            return res.status(400).json({ 
                result: 'counterfeit',
                message: 'Invalid QR code format'
            });
        }

        const productId = qrParts[1];
        const providedKey = qrParts[2];

        // Find product
        const product = await Product.findOne({ productId }).populate('manufacturer');
        if (!product) {
            return res.status(404).json({
                result: 'counterfeit',
                message: 'Product not found'
            });
        }

        // Verify secret key
        if (product.secureTag.secretKey !== providedKey) {
            return res.status(400).json({
                result: 'counterfeit',
                message: 'Invalid authentication key'
            });
        }

        // Check product status
        let result = 'authentic';
        let message = 'Product verified as authentic';
        let confidence = 100;

        if (product.status === 'recalled') {
            result = 'recalled';
            message = 'Product has been recalled';
            confidence = 95;
        } else if (product.status === 'expired' || (product.expiryDate && product.expiryDate < new Date())) {
            result = 'expired';
            message = 'Product has expired';
            confidence = 90;
        } else if (!product.secureTag.isActive) {
            result = 'tampered';
            message = 'Product seal may have been tampered with';
            confidence = 85;
        }

        // Record verification
        const verification = new Verification({
            productId: product.productId,
            product: product._id,
            method: 'qr',
            location,
            deviceInfo,
            result,
            confidence
        });
        await verification.save();

        // Update product verification count
        product.verificationCount += 1;
        product.lastVerified = new Date();
        await product.save();

        // Update analytics
        await updateAnalytics(product.manufacturer, 'qr', result);

        res.json({
            result,
            message,
            confidence,
            product: {
                id: product.productId,
                name: product.name,
                manufacturer: product.manufacturer.company || `${product.manufacturer.firstName} ${product.manufacturer.lastName}`,
                manufacturingDate: product.manufacturingDate,
                origin: product.origin,
                verificationCount: product.verificationCount
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify/nfc', async (req, res) => {
    try {
        const { nfcId, location, deviceInfo } = req.body;

        // Find product by NFC ID
        const product = await Product.findOne({ 'secureTag.nfcId': nfcId }).populate('manufacturer');
        if (!product) {
            return res.status(404).json({
                result: 'counterfeit',
                message: 'Invalid NFC tag'
            });
        }

        // Similar verification logic as QR
        let result = 'authentic';
        let message = 'Product verified as authentic via NFC';
        let confidence = 100;

        if (product.status === 'recalled') {
            result = 'recalled';
            message = 'Product has been recalled';
            confidence = 95;
        } else if (product.status === 'expired' || (product.expiryDate && product.expiryDate < new Date())) {
            result = 'expired';
            message = 'Product has expired';
            confidence = 90;
        } else if (!product.secureTag.isActive) {
            result = 'tampered';
            message = 'Product seal may have been tampered with';
            confidence = 85;
        }

        // Record verification
        const verification = new Verification({
            productId: product.productId,
            product: product._id,
            method: 'nfc',
            location,
            deviceInfo,
            result,
            confidence
        });
        await verification.save();

        // Update product verification count
        product.verificationCount += 1;
        product.lastVerified = new Date();
        await product.save();

        // Update analytics
        await updateAnalytics(product.manufacturer, 'nfc', result);

        res.json({
            result,
            message,
            confidence,
            product: {
                id: product.productId,
                name: product.name,
                manufacturer: product.manufacturer.company || `${product.manufacturer.firstName} ${product.manufacturer.lastName}`,
                manufacturingDate: product.manufacturingDate,
                origin: product.origin,
                verificationCount: product.verificationCount
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analytics Routes
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        
        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }

        let matchQuery = { timestamp: { $gte: startDate } };
        if (req.user.role !== 'admin') {
            const userProducts = await Product.find({ manufacturer: req.user.userId }).select('_id');
            matchQuery.product = { $in: userProducts.map(p => p._id) };
        }

        // Aggregate verification data
        const verificationStats = await Verification.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalVerifications: { $sum: 1 },
                    authenticCount: { $sum: { $cond: [{ $eq: ['$result', 'authentic'] }, 1, 0] } },
                    counterfeitCount: { $sum: { $cond: [{ $eq: ['$result', 'counterfeit'] }, 1, 0] } },
                    tamperedCount: { $sum: { $cond: [{ $eq: ['$result', 'tampered'] }, 1, 0] } },
                    qrScans: { $sum: { $cond: [{ $eq: ['$method', 'qr'] }, 1, 0] } },
                    nfcTaps: { $sum: { $cond: [{ $eq: ['$method', 'nfc'] }, 1, 0] } }
                }
            }
        ]);

        // Get geographic distribution
        const geographicData = await Verification.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$location.country',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Get daily verification trends
        const dailyTrends = await Verification.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    verifications: { $sum: 1 },
                    authentic: { $sum: { $cond: [{ $eq: ['$result', 'authentic'] }, 1, 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const stats = verificationStats[0] || {
            totalVerifications: 0,
            authenticCount: 0,
            counterfeitCount: 0,
            tamperedCount: 0,
            qrScans: 0,
            nfcTaps: 0
        };

        res.json({
            summary: {
                totalVerifications: stats.totalVerifications,
                authenticityRate: stats.totalVerifications > 0 
                    ? ((stats.authenticCount / stats.totalVerifications) * 100).toFixed(1)
                    : 0,
                counterfeitDetections: stats.counterfeitCount,
                tamperedDetections: stats.tamperedCount
            },
            methods: {
                qr: stats.qrScans,
                nfc: stats.nfcTaps
            },
            geographic: geographicData,
            trends: dailyTrends
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Contact form
app.post('/api/contact', async (req, res) => {
    try {
        const { firstName, lastName, email, company, message } = req.body;

        // Save contact message
        const contact = new Contact({
            firstName,
            lastName,
            email,
            company,
            message
        });
        await contact.save();

        // Send notification email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'New SecureTag Contact Form Submission',
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Company:</strong> ${company || 'Not provided'}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `
        });

        // Send confirmation email to user
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SecureTag - We received your message',
            html: `
                <h3>Thank you for contacting SecureTag!</h3>
                <p>Hi ${firstName},</p>
                <p>We've received your message and will get back to you within 24 hours.</p>
                <p>Best regards,<br>The SecureTag Team</p>
            `
        });

        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Utility function to update analytics
async function updateAnalytics(manufacturerId, method, result) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        await Analytics.findOneAndUpdate(
            { date: today, manufacturer: manufacturerId },
            {
                $inc: {
                    'metrics.totalVerifications': 1,
                    [`metrics.${method}Scans`]: 1,
                    [`metrics.${result}Verifications`]: 1
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('Analytics update failed:', error);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`SecureTag Backend Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;