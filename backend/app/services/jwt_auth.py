from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

# Try to import JWT, fallback to simple token store
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    logger.warning("PyJWT library not available, using simple token store")

from .auth_tokens import token_store, TokenInfo


class JWTAuth:
    """JWT authentication with fallback to simple token store."""
    
    def __init__(self):
        self.secret = settings.JWT_SECRET
        self.algorithm = "HS256"
        self.token_ttl = timedelta(hours=24)
        
        if JWT_AVAILABLE and self.secret != "change-me":
            self.use_jwt = True
            logger.info("Using JWT authentication")
        else:
            self.use_jwt = False
            logger.info("Using simple token store authentication")
    
    def create_access_token(self, email: str, plan: str, user_id: str) -> str:
        """Create an access token for the user."""
        if not self.use_jwt:
            return token_store.issue_token(email, plan)
        
        try:
            expires_at = datetime.utcnow() + self.token_ttl
            payload = {
                "sub": user_id,
                "email": email,
                "plan": plan,
                "exp": expires_at,
                "iat": datetime.utcnow(),
            }
            
            token = jwt.encode(payload, self.secret, algorithm=self.algorithm)
            logger.info(f"Created JWT token for {email} ({plan})")
            return token
            
        except Exception as e:
            logger.error(f"Failed to create JWT token: {e}")
            # Fallback to simple token
            return token_store.issue_token(email, plan)
    
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode a token."""
        if not self.use_jwt:
            plan = token_store.resolve_plan(token)
            if plan:
                # We don't have email/user_id in simple store, so make fake ones
                return {
                    "sub": f"{plan}-user",
                    "email": f"{plan}@local",
                    "plan": plan,
                }
            return None
        
        try:
            payload = jwt.decode(token, self.secret, algorithms=[self.algorithm])
            
            # Check if token is expired
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.debug("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.debug(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return None
    
    def refresh_token(self, token: str) -> Optional[str]:
        """Refresh a token if it's valid."""
        payload = self.verify_token(token)
        if not payload:
            return None
        
        # Create new token with same claims
        return self.create_access_token(
            email=payload["email"],
            plan=payload["plan"],
            user_id=payload["sub"]
        )


jwt_auth = JWTAuth()