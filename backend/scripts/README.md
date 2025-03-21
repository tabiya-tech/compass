# Conversation Export/Import Scripts
## Usage

The `export_import_conversation.py` script allows you to export/import conversations between different stores (JSON or DB). When using JSON storage, each conversation is stored in a separate file named `export-{session_id}.json` in the `exported-conversations` directory.

### Export/Import Conversation

```bash
# Copy between databases (DB to DB)
python export_import_conversation.py --source-session-id 123 --target-session-id 456

# Export from DB to JSON (using same session ID)
python export_import_conversation.py --source-session-id 123 --target JSON
```

#### Arguments

- `--source-session-id`: The source session ID to export conversation from
- `--target-session-id`: The target session ID to import conversation to (optional when exporting to JSON, defaults to source session ID)
- `--source`: The source store type (either "JSON" or "DB", defaults to "DB")
- `--target`: The target store type (either "JSON" or "DB", defaults to "DB")

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
# Creates file: exported-conversations/export-123.json
```

### Export from DB to JSON (with different session ID)

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456 --target JSON
# Creates file: exported-conversations/export-456.json
```

### Import from JSON to DB

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456 --source JSON
# Reads from: exported-conversations/export-123.json
```

### Copy between databases (DB to DB)

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456
```

### Export from JSON to JSON (copy)

```bash
python export_import_conversation.py --source-session-id 123 --target-session-id 456 --source JSON --target JSON
# Reads from: exported-conversations/export-123.json
# Creates file: exported-conversations/export-456.json
```