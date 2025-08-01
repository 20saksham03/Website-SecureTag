// healthcheck.js
const http = require('http');

const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3001,
    path: '/api/health',
    method: 'GET',
    timeout: 2000
};

const healthCheck = http.request(options, (res) => {
    console.log(`Health check status: ${res.statusCode}`);
    if (res.statusCode === 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

healthCheck.on('error', (err) => {
    console.error('Health check failed:', err.message);
    process.exit(1);
});

healthCheck.on('timeout', () => {
    console.error('Health check timeout');
    healthCheck.destroy();
    process.exit(1);
});

healthCheck.end();