const { createClerkClient, verifyToken } = require('@clerk/backend');

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * Middleware to verify Clerk authentication token using JWT verification
 * Uses networkless verification with short-lived session tokens
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('[Auth] Checking authorization header...');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] No bearer token found');
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('[Auth] Token received, verifying...');

    // Verify the JWT token (networkless verification)
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    console.log('[Auth] Token verified, payload.sub:', payload?.sub);
    
    if (!payload || !payload.sub) {
      console.log('[Auth] Invalid payload');
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Get user details from Clerk
    console.log('[Auth] Getting user from Clerk...');
    const user = await clerkClient.users.getUser(payload.sub);
    console.log('[Auth] User found:', user.id);
    
    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed: ' + (error.message || 'Unknown error')
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Verify the JWT token (networkless verification)
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      
      if (payload && payload.sub) {
        const user = await clerkClient.users.getUser(payload.sub);
        req.user = {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        };
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    console.warn('Optional auth failed:', error.message);
    next();
  }
};

module.exports = {
  authenticateUser,
  optionalAuth
};
