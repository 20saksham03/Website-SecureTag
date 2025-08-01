// config/mongo-init.js
db = db.getSiblingDB('securetag');

// Create collections
db.createCollection('users');
db.createCollection('products');
db.createCollection('verifications');
db.createCollection('analytics');
db.createCollection('contacts');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.products.createIndex({ "productId": 1 }, { unique: true });
db.products.createIndex({ "manufacturer": 1 });
db.products.createIndex({ "secureTag.nfcId": 1 });
db.verifications.createIndex({ "productId": 1 });
db.verifications.createIndex({ "timestamp": -1 });
db.analytics.createIndex({ "date": 1, "manufacturer": 1 });

print('Database initialized successfully');
