#!/bin/bash

# SecureTag Backend Automated Setup Script
# Run this script after creating all the files

set -e  # Exit on any error

echo "🚀 SecureTag Backend Setup Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16+ required. Current version: $(node --version)"
    exit 1
fi

print_status "Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "npm version: $(npm --version)"

# Create necessary directories
print_info "Creating project directories..."
mkdir -p uploads logs config scripts tests
touch uploads/.gitkeep logs/.gitkeep

print_status "Project directories created"

# Install dependencies
print_info "Installing Node.js dependencies..."
npm install

print_status "Dependencies installed successfully"

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Copying from .env.example..."
    cp .env.example .env
    print_warning "Please edit .env file with your configuration before running the server"
else
    print_status ".env file already exists"
fi

# Check MongoDB connection
print_info "Checking MongoDB connection..."
if command -v mongo &> /dev/null; then
    if mongo --eval "db.adminCommand('ismaster')" &> /dev/null; then
        print_status "MongoDB is running and accessible"
        
        # Ask if user wants to seed database
        read -p "Do you want to seed the database with sample data? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Seeding database..."
            npm run seed
            print_status "Database seeded successfully"
        fi
    else
        print_warning "MongoDB is not running or not accessible"
        print_info "You can start MongoDB with: sudo systemctl start mongodb"
        print_info "Or use Docker: docker run -d --name mongodb -p 27017:27017 mongo:7.0"
    fi
elif command -v mongod &> /dev/null; then
    print_warning "MongoDB is installed but may not be running"
    print_info "Start MongoDB with: sudo systemctl start mongodb"
else
    print_warning "MongoDB not found. You need to install MongoDB or use MongoDB Atlas"
    print_info "Install MongoDB: https://docs.mongodb.com/manual/installation/"
    print_info "Or use MongoDB Atlas: https://cloud.mongodb.com"
fi

# Initialize git repository if not already initialized
if [ ! -d .git ]; then
    print_info "Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: SecureTag backend setup"
    print_status "Git repository initialized"
    print_info "Add remote with: git remote add origin <your-repo-url>"
    print_info "Push with: git push -u origin main"
else
    print_status "Git repository already exists"
fi

# Run tests
print_info "Running tests..."
if npm test; then
    print_status "All tests passed"
else
    print_warning "Some tests failed. This might be due to MongoDB not running."
fi

# Check if Docker is available
if command -v docker &> /dev/null; then
    print_status "Docker detected"
    print_info "You can run with Docker using: docker-compose up -d"
else
    print_warning "Docker not found. Install Docker for containerized deployment."
fi

# Final instructions
echo
echo "🎉 Setup completed successfully!"
echo
echo "📋 Next Steps:"
echo "1. Edit .env file with your configuration"
echo "2. Ensure MongoDB is running"
echo "3. Start the server:"
echo "   Development: npm run dev"
echo "   Production:  npm start"
echo "   Docker:      docker-compose up -d"
echo
echo "📚 Sample Login Credentials (after seeding):"
echo "   Admin:        admin@securetag.com / SecureTag2025!"
echo "   Manufacturer: john@techcorp.com / Manufacturer123!"
echo "   Retailer:     jane@retailstore.com / Retailer123!"
echo "   Consumer:     bob@gmail.com / Consumer123!"
echo
echo "🌐 API will be available at: http://localhost:3001"
echo "📖 Health check: curl http://localhost:3001/api/health"
echo
print_status "Setup script completed!"