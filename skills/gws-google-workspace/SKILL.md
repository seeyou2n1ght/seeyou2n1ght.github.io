---
name: gws-google-workspace
description: Google Workspace CLI integration for Drive, Gmail, Calendar, Sheets, Docs. Use when you need to access Google services, manage files in Drive, read/send emails, or work with Google documents.
---

# Google Workspace CLI (gws)

One CLI for all Google Workspace services.

## Prerequisites

Authentication required before use:
```bash
gws auth login --scopes drive,gmail,calendar,sheets,docs
```

Or set environment variable:
```bash
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/credentials.json
```

## Common Commands

### Google Drive
```bash
# List files
gws drive files list --params '{"pageSize": 10}'

# Create folder
gws drive files create --json '{"name": "Folder Name", "mimeType": "application/vnd.google-apps.folder"}'

# Upload file
gws drive files create --json '{"name": "file.pdf"}' --upload ./file.pdf

# Download file
gws drive files get --params '{"fileId": "xxx"}' --download ./local.file

# Search files
gws drive files list --params '{"q": "name contains '\''keyword'\''"}'
```

### Gmail
```bash
# List messages
gws gmail users messages list --params '{"maxResults": 10}'

# Get message
gws gmail users messages get --params '{"id": "msg_id"}'

# Send message (via drafts)
gws gmail users drafts create --json '{"message": {"raw": "base64encoded"}}'
```

### Calendar
```bash
# List events
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10}'

# Create event
gws calendar events insert --params '{"calendarId": "primary"}' --json '{
  "summary": "Meeting",
  "start": {"dateTime": "2026-03-06T10:00:00", "timeZone": "Asia/Shanghai"},
  "end": {"dateTime": "2026-03-06T11:00:00", "timeZone": "Asia/Shanghai"}
}'
```

### Sheets
```bash
# Read values
gws sheets spreadsheets values get --params '{"spreadsheetId": "id", "range": "Sheet1!A1:D10"}'

# Update values
gws sheets spreadsheets values update --params '{"spreadsheetId": "id", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' --json '{"values": [["A", "B", "C"]]}'
```

## Output Format

All commands output structured JSON. Parse with `jq`:
```bash
gws drive files list --params '{"pageSize": 5}' | jq '.files[].name'
```

## Security Notes

- Credentials encrypted at rest (AES-256-GCM)
- Token stored in OS keyring
- Use `--dry-run` to preview requests
