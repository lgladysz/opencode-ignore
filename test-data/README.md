# Test Directory Structure for Security Plugin Testing

Complete test suite for validating the opencode-ignore plugin with realistic sensitive and non-sensitive files.

**This directory is the test project root.** All patterns in `.ignore` are relative to this directory.

## Quick Reference

### BLOCKED Patterns:
1. Files matching `app*.properties` and `*.server.properties` anywhere
2. All directories: `/config/production/**`, `/config/staging/**`, `/certs/**`, `/sensitive-data/**`, `database/credentials/**`
3. All environment files: `.env`, `.env*`, `*.env`
4. All certificates & keys: `*.key`, `*.crt`, `*.pem`, `*.ca`
5. All secrets: `secrets.json`, `credentials.json`, `id_rsa`
6. Specific files: `/config/master-password.txt`, `/database/connection-string.txt`

### ALLOWED Patterns (Negations):
1. All files in `/public/**` - Templates and documentation
2. All files in `/test-data/**` - Mock test data
3. Files matching `*.example.properties` - Example templates
4. Files matching `*.template.env` - Environment templates
5. Non-matching files: `application.properties`, `*.log`

## Complete File Inventory

**24 test files** organized across **12 directories**:

```
.                                    (Project root - test-data/)
├── .ignore                          Pattern definitions
├── README.md                        This file
├── TEST-SCENARIOS.md               Test command reference
├── .env                            ❌ BLOCKED
│
├── config/                          Mixed (directory + file patterns)
│   ├── .env.staging                ❌ BLOCKED (.env* pattern)
│   ├── app.env.production          ❌ BLOCKED (*.env pattern)
│   ├── master-password.txt         ❌ BLOCKED (specific path)
│   ├── development/
│   │   └── app.server.properties   ❌ BLOCKED (2 patterns)
│   ├── production/
│   │   └── app.server.properties   ❌ BLOCKED (directory + 2 patterns)
│   └── staging/
│       └── app.server.properties   ❌ BLOCKED (directory + 2 patterns)
│
├── certs/                           ❌ BLOCKED (entire directory)
│   ├── server.key                  ❌ BLOCKED (directory + *.key)
│   ├── server.crt                  ❌ BLOCKED (directory + *.crt)
│   ├── ca-bundle.pem               ❌ BLOCKED (directory + *.pem)
│   └── client.ca                   ❌ BLOCKED (directory + *.ca)
│
├── database/
│   ├── connection-string.txt       ❌ BLOCKED (specific path)
│   └── credentials/                ❌ BLOCKED (directory pattern)
│       └── db-admin.properties     ❌ BLOCKED (directory)
│
├── sensitive-data/                  ❌ BLOCKED (entire directory)
│   ├── secrets.json                ❌ BLOCKED (directory + pattern)
│   ├── credentials.json            ❌ BLOCKED (directory + pattern)
│   └── id_rsa                      ❌ BLOCKED (directory + pattern)
│
├── src/
│   ├── application.properties      ✅ ALLOWED (doesn't match patterns)
│   └── app.runtime.properties      ❌ BLOCKED (app*.properties)
│
├── logs/
│   └── application.log             ✅ ALLOWED (doesn't match patterns)
│
├── public/                          ✅ ALLOWED (negation: !**/public/**)
│   ├── readme.txt                  ✅ ALLOWED
│   ├── app.example.properties      ✅ ALLOWED (negation: !*.example.properties)
│   └── .env.template               ✅ ALLOWED (negation: !*.template.env)
│
└── test-data/                       ✅ ALLOWED (negation: !**/test-data/**)
    ├── sample.properties           ✅ ALLOWED
    └── mock-secrets.json           ✅ ALLOWED
```

## Test Coverage

See **TEST-SCENARIOS.md** for comprehensive test commands covering:
- ✓ All 23 patterns (16 block + 4 negation + 3 specific paths)
- ✓ All 6 tools (READ, GLOB, GREP, LIST, WRITE, EDIT)
- ✓ Pattern precedence and negation override validation
- ✓ Secret leakage detection tests

## Statistics

| Category | Count |
|----------|-------|
| **Total Files** | 26 (includes .ignore, README.md, TEST-SCENARIOS.md) |
| **Test Files** | 24 |
| **Blocked Files** | 16 |
| **Allowed Files** | 8 |
| **Block Patterns** | 19 |
| **Negation Patterns** | 4 |
| **Directories** | 12 |

## Usage

**Run tests from THIS directory** (test-data is the project root):

```bash
# Change to test directory
cd test-data/

# Read blocked file (should fail)
read .env

# Read allowed file (should succeed)
read public/readme.txt

# Glob blocked pattern (should return empty)
glob **/*.key

# List blocked directory (should return empty)
list certs

# List allowed directory (should show contents)
list public
```

See **TEST-SCENARIOS.md** for complete test suite.
