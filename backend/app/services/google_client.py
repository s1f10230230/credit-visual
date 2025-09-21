from __future__ import annotations

import logging
import random
import string
import base64
from datetime import datetime, timedelta
from typing import List, Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

# Try to import Google libraries, fallback to stub if not available
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False
    logger.warning("Google API libraries not available, using stub implementation")


class GoogleClient:
    """Real Google OAuth/Gmail client with fallback to stub."""

    def __init__(self):
        self.use_real_api = (
            GOOGLE_API_AVAILABLE 
            and settings.GMAIL_CLIENT_ID 
            and settings.GMAIL_CLIENT_SECRET
        )
        
        if self.use_real_api:
            logger.info("Using real Google API")
        else:
            logger.info("Using stub Google API")

    async def exchange_code_for_token(self, code: str) -> dict[str, str | float]:
        if not self.use_real_api:
            return self._stub_token_exchange(code)
        
        try:
            from google_auth_oauthlib.flow import Flow
            
            # Create OAuth flow
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": settings.GMAIL_CLIENT_ID,
                        "client_secret": settings.GMAIL_CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [settings.GMAIL_REDIRECT_URI or "http://localhost:8080"]
                    }
                },
                scopes=["https://www.googleapis.com/auth/gmail.readonly"]
            )
            flow.redirect_uri = settings.GMAIL_REDIRECT_URI or "http://localhost:8080"
            
            # Exchange code for token
            flow.fetch_token(code=code)
            
            credentials = flow.credentials
            return {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token or "",
                "expires_in": 3600,  # 1 hour
            }
            
        except Exception as e:
            logger.error(f"Failed to exchange code for token: {e}")
            return self._stub_token_exchange(code)

    async def fetch_messages(self, access_token: str, max_results: int = 5) -> List[bytes]:
        if not self.use_real_api:
            return self._stub_fetch_messages(max_results)
        
        try:
            # Create credentials from access token
            credentials = Credentials(token=access_token)
            
            # Build Gmail service
            service = build('gmail', 'v1', credentials=credentials)
            
            # Search for credit card related emails
            query = 'from:noreply OR from:no-reply OR subject:"ご利用明細" OR subject:"決済" OR subject:"支払い"'
            
            # Get message list
            results = service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            email_data = []
            
            for message in messages:
                # Get full message
                msg = service.users().messages().get(
                    userId='me',
                    id=message['id'],
                    format='raw'
                ).execute()
                
                # Decode raw message
                raw_data = msg['raw']
                decoded_data = base64.urlsafe_b64decode(raw_data).decode('utf-8')
                email_data.append(decoded_data.encode('utf-8'))
            
            logger.info(f"Fetched {len(email_data)} real Gmail messages")
            return email_data
            
        except Exception as e:
            logger.error(f"Failed to fetch Gmail messages: {e}")
            return self._stub_fetch_messages(max_results)

    def _stub_token_exchange(self, code: str) -> dict[str, str | float]:
        """Fallback stub token exchange."""
        access_token = "access-" + "".join(random.choices(string.ascii_letters + string.digits, k=16))
        refresh_token = "refresh-" + code
        expires_in = 3300  # 55 minutes
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": expires_in,
        }

    def _stub_fetch_messages(self, max_results: int = 5) -> List[bytes]:
        """Fallback stub message fetching."""
        messages: List[bytes] = []
        now = datetime.utcnow().replace(microsecond=0)
        templates = [
            ("Netflix", 1490, now - timedelta(days=1)),
            ("Spotify", 980, now - timedelta(days=2)),
            ("Kindle", 980, now - timedelta(days=10)),
        ]
        for merchant, amount, ts in templates[:max_results]:
            body = (
                "From: billing@example.com\n"
                f"Subject: {merchant} ご請求のお知らせ\n\n"
                f"ご利用先：{merchant}\n"
                f"ご利用金額 {amount} 円\n"
                f"ご利用日 {ts.strftime('%Y/%m/%d')}"
            )
            messages.append(body.encode("utf-8"))
        return messages


google_client = GoogleClient()
