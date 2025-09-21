# Gmail OAuth & Sync (Future Work)

Currently the Gmail integration uses stubbed API calls. To enable real Gmail synchronization:

1. **Install Google API packages**
   ```bash
   pip install google-auth google-auth-oauthlib google-api-python-client
   ```

2. **OAuth Flow**
   - Store client ID/secret/redirect URI via `/api/admin/gmail/config`.
   - On `/api/admin/gmail/start`, generate state and create authorization URL:
     ```python
     flow = Flow.from_client_config({"web": {...}}, scopes=["https://www.googleapis.com/auth/gmail.readonly"], redirect_uri=...)
     flow.params.update({'access_type': 'offline', 'prompt': 'consent'})
     authorize_url, state = flow.authorization_url()
     ```
   - In `/api/admin/gmail/callback`, exchange code for tokens:
     ```python
     flow.fetch_token(code=payload.code)
     credentials = flow.credentials
     ```
     Store `credentials.token`, `credentials.refresh_token`, `credentials.expiry` in `GmailToken`.

3. **Message Fetching**
   ```python
   service = build("gmail", "v1", credentials=credentials)
   messages = service.users().messages().list(userId="me", q="newer_than:7d", labelIds=["IMPORTANT"]).execute()
   for msg in messages.get("messages", []):
       raw = service.users().messages().get(userId="me", id=msg["id"], format="raw").execute()["raw"]
       content = base64.urlsafe_b64decode(raw)
       ingest_raw_messages(session, user_id, [content])
   ```

4. **Refresh Tokens**
   - Use `google.oauth2.credentials.Credentials` with stored refresh token and call `credentials.refresh(Request())` inside the scheduler.

