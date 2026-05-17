const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mySecretKeyForJWTTokenGenerationAndValidation12345678901234567890';

// Middleware to protect routes and verify JWT tokens
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Spring Boot subject maps to decoded.sub
    req.user = {
      username: decoded.sub,
      role: decoded.role
    };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Helper utility to generate token (matches Spring Boot token structure)
const generateToken = (username, role) => {
  return jwt.sign({ role }, JWT_SECRET, {
    subject: username,
    expiresIn: '24h' // Matches Spring's 86400000ms (24 hours)
  });
};

module.exports = {
  authMiddleware,
  generateToken
};
