# SecureTag Backend API

A comprehensive backend API for SecureTag - Smart Authentication system with NFC and QR code verification.

## 🚀 Features

- **User Authentication** - JWT-based authentication system
- **Product Management** - Create and manage products with secure tags
- **QR & NFC Verification** - Verify product authenticity
- **Analytics Dashboard** - Real-time verification analytics
- **Contact Management** - Handle customer inquiries
- **Security** - Rate limiting, helmet protection, input validation
- **Email Integration** - Automated email notifications

## 📋 Prerequisites

- Node.js (v16+)
- MongoDB (v5+)
- Gmail account (for email functionality)
- Redis (optional, for caching)

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/securetag-backend.git
cd securetag-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Create required directories**
```bash
mkdir uploads logs
```

5. **Start MongoDB**
```bash
# If using local MongoDB
mongod

# Or start MongoDB service
sudo systemctl start mongodb
```

6. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

## 📁 Project Structure

```
securetag-backend/
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
├── uploads/              # File uploads directory
├── logs/                 # Application logs
├── scripts/              # Database scripts
│   └── seedDatabase.js   # Sample data seeder
└── tests/                # Test files
    ├── auth.test.js
    ├── products.test.js
    └── verification.test.js
```

## 🔌 API Endpoints

### Authentication Routes

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "company": "Tech Corp",
  "role": "manufacturer"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

#### Verify Email
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "verification-token-from-email"
}
```

### Product Management

#### Create Product
```http
POST /api/products
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Premium Widget",
  "description": "High-quality widget with security features",
  "category": "Electronics",
  "price": 99.99,
  "manufacturingDate": "2025-01-15",
  "expiryDate": "2027-01-15",
  "batchNumber": "BATCH001",
  "serialNumber": "SN123456",
  "origin": {
    "country": "India",
    "state": "Karnataka",
    "city": "Bangalore",
    "coordinates": {
      "lat": 12.9716,
      "lng": 77.5946
    }
  }
}
```

#### Get Products
```http
GET /api/products?page=1&limit=10&search=widget&category=Electronics
Authorization: Bearer <jwt-token>
```

### Verification Routes

#### Verify QR Code
```http
POST /api/verify/qr
Content-Type: application/json

{
  "qrData": "ST-ST1704976123ABC45-secretkey123",
  "location": {
    "country": "India",
    "state": "Karnataka",
    "city": "Bangalore",
    "coordinates": {
      "lat": 12.9716,
      "lng": 77.5946
    },
    "ipAddress": "203.192.12.34"
  },
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "platform": "Android",
    "browser": "Chrome"
  }
}
```

#### Verify NFC Tag
```http
POST /api/verify/nfc
Content-Type: application/json

{
  "nfcId": "nfc-tag-id-here",
  "location": { /* same as QR */ },
  "deviceInfo": { /* same as QR */ }
}
```

### Analytics

#### Get Dashboard Analytics
```http
GET /api/analytics/dashboard?period=30d
Authorization: Bearer <jwt-token>
```

### Contact Form

#### Submit Contact Form
```http
POST /api/contact
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@company.com",
  "company": "ABC Corp",
  "message": "Interested in SecureTag for our products"
}
```

### Health Check

#### Server Health
```http
GET /api/health
```

## 📊 Response Formats

### Success Response
```json
{
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

### Verification Response
```json
{
  "result": "authentic",
  "message": "Product verified as authentic",
  "confidence": 100,
  "product": {
    "id": "ST1704976123ABC45",
    "name": "Premium Widget",
    "manufacturer": "Tech Corp",
    "manufacturingDate": "2025-01-15T00:00:00.000Z",
    "origin": {
      "country": "India",
      "state": "Karnataka",
      "city": "Bangalore"
    },
    "verificationCount": 5
  }
}
```

## 🔒 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens expire after 7 days and need to be refreshed by logging in again.

## 🏷️ User Roles

- **admin** - Full system access
- **manufacturer** - Can create and manage own products
- **retailer** - Can verify products and view analytics
- **consumer** - Can verify products only

## 📈 Rate Limiting

- **Global limit**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 login attempts per 15 minutes
- **Verification endpoints**: 50 requests per minute

## 🛡️ Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing protection
- **Rate limiting** - Prevent abuse
- **Input validation** - Sanitize all inputs
- **Password hashing** - Bcrypt with 12 rounds
- **JWT tokens** - Secure authentication
- **Environment variables** - Sensitive data protection

## 📝 Database Models

### User Model
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  password: String (hashed),
  company: String,
  role: Enum(['admin', 'manufacturer', 'retailer', 'consumer']),
  isVerified: Boolean,
  createdAt: Date,
  subscriptionPlan: Enum(['free', 'basic', 'premium', 'enterprise'])
}
```

### Product Model
```javascript
{
  productId: String (unique),
  name: String,
  description: String,
  manufacturer: ObjectId (ref: User),
  category: String,
  manufacturingDate: Date,
  secureTag: {
    qrCode: String,
    nfcId: String,
    secretKey: String,
    isActive: Boolean
  },
  status: Enum(['active', 'recalled', 'expired', 'returned']),
  verificationCount: Number
}
```

### Verification Model
```javascript
{
  productId: String,
  method: Enum(['qr', 'nfc']),
  result: Enum(['authentic', 'counterfeit', 'tampered', 'expired']),
  location: Object,
  deviceInfo: Object,
  timestamp: Date,
  confidence: Number
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test auth.test.js
```

## 📦 Deployment

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables for Production
```bash
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/securetag
JWT_SECRET=your-production-jwt-secret
EMAIL_USER=your-production-email
EMAIL_PASS=your-production-email-password
```

## 🔧 Configuration

### Email Setup (Gmail)
1. Enable 2-factor authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use App Password in EMAIL_PASS environment variable

### MongoDB Setup
1. **Local**: Install MongoDB and start service
2. **Atlas**: Create cluster at https://cloud.mongodb.com
3. **Connection**: Update MONGODB_URI in .env

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [JWT.io](https://jwt.io/)
- [Nodemailer Documentation](https://nodemailer.com/)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

Built with ❤️ by Team Pentacode

## 📞 Support

For support, email securetag6@gmail.com or create an issue in the repository.