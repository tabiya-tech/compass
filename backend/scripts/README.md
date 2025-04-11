# Conversation Export/Import Scripts

## Usage

The `export_import_conversation.py` script allows you to export/import conversations between different stores (JSON or
DB). When using JSON storage, each conversation is stored in a separate file named `export-{session_id}.json` in the
`exports` directory. Analysis files are stored in the `exports/analysis` directory.

### Export/Import Conversation

```bash
# Copy between databases (DB to DB)
python export_import_conversation.py --source-session-id 123 --target-session-id 456

# Export from DB to JSON (using same session ID)
python export_import_conversation.py --source-session-id 123 --target JSON

# Export latest session from a user to JSON
python export_import_conversation.py --source-user-id user123 --target JSON

# Copy latest session between users (DB to DB)
python export_import_conversation.py --source-user-id user123 --target-user-id user456

# Export and analyze a conversation
python export_import_conversation.py --source-session-id 123 --target JSON --analyze

# Bulk export all sessions from DB to JSON
python export_import_conversation.py --source DB --target JSON --bulk

# Bulk export all sessions from DB to JSON with analysis
python export_import_conversation.py --source DB --target JSON --bulk --analyze
```

#### Arguments

- `--source-session-id`: The source session ID to export conversation from (required if --source-user-id not provided
  and not using --bulk)
- `--source-user-id`: The source user ID to get the latest session from (only valid when source is DB)
- `--target-session-id`: The target session ID to import conversation to (required if --target-user-id not provided and
  not using --bulk)
- `--target-user-id`: The target user ID to get the latest session from (only valid when target is DB)
- `--source`: The source store type (either "JSON" or "DB", defaults to "DB")
- `--target`: The target store type (either "JSON" or "DB", defaults to "DB")
- `--analyze`: Export conversation to markdown for analysis (creates a file in the exports/analysis directory)
- `--bulk`: Export all sessions from source to target

## Environment Variables

The script uses the following environment variables:

- `EXPORT_IMPORT_SOURCE_MONGODB_URI`: MongoDB URI for the source database
- `EXPORT_IMPORT_SOURCE_DATABASE_NAME`: Database name for the source database
- `EXPORT_IMPORT_TARGET_MONGODB_URI`: MongoDB URI for the target database
- `EXPORT_IMPORT_TARGET_DATABASE_NAME`: Database name for the target database

You can set these variables in a `.env` file in the same directory as the script.

## Examples

### Export from DB to JSON (using same session ID)

```bash
python export_import_conversation.py --source-session-id 123 --target JSON
# Creates file: exports/export-123.json
```

### Export from DB to JSON (with different session ID)

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456 --target JSON
# Creates file: exports/export-456.json
```

### Export latest session from a user to JSON

```bash
python export_import_conversation.py --source-user-id user123 --target JSON
# Gets latest session ID from user preferences
# Creates file: exports/export-{latest_session_id}.json
```

### Import from JSON to DB

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456 --source JSON
# Reads from: exports/export-123.json
```

### Copy between databases (DB to DB)

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456
```

### Copy latest session between users (DB to DB)

```bash
python export_import_conversation.py --source-user-id user123 --target-user-id user456
# Gets latest session IDs from both users' preferences
```

### Export from JSON to JSON (copy)

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456 --source JSON --target JSON
# Reads from: exports/export-123.json
# Creates file: exports/export-456.json
```

### Export and analyze a conversation

```bash
python export_import_conversation.py --source-session-id 123 --target JSON --analyze
# Creates file: exports/export-123.json
# Creates file: exports/analysis/analysis-123.md
```

### Bulk export all sessions from DB to JSON

```bash
python export_import_conversation.py --source DB --target JSON --bulk
# Creates files: exports/export-{session_id}.json for all sessions
```

### Bulk export all sessions from DB to JSON with analysis

```bash
python export_import_conversation.py --source DB --target JSON --bulk --analyze
# Creates files: exports/export-{session_id}.json for all sessions
# Creates files: exports/analysis/analysis-{session_id}.md for all sessions
```

The analysis markdown file includes:

- Conversation title
- Conversation summary
- Recent history (last 5 turns)
- Full conversation history
- For each turn:
    - Turn number
    - User message
    - Agent type and message
    - Finished status
    - Additional fields from AgentOutput
    - Agent response time
    - LLM call stats

> this can and will be extended in the future with information like
>  - Feedback and reactions for the user