# Security Plugin Test Scenarios

Complete test suite for validating opencode-ignore plugin behavior.

**Entry Point**: All tests run from this directory (test-data/). This IS the project root for testing.

---

## Directory Structure

All paths are relative to THIS directory (`.` = test-data/).

```
.                                    (Project root for tests)
├── .ignore                          # Pattern rules
├── README.md                        # Test structure documentation
├── TEST-SCENARIOS.md               # This file - test commands
├── .env                            # BLOCKED: .env pattern
├── config/
│   ├── .env.staging                # BLOCKED: .env* pattern
│   ├── app.env.production          # BLOCKED: *.env pattern
│   ├── master-password.txt         # BLOCKED: specific path
│   ├── development/
│   │   └── app.server.properties   # BLOCKED: app*.properties + *.server.properties
│   ├── production/
│   │   └── app.server.properties   # BLOCKED: /config/production/** + patterns
│   └── staging/
│       └── app.server.properties   # BLOCKED: /config/staging/** + patterns
├── certs/
│   ├── server.key                  # BLOCKED: /certs/** + *.key
│   ├── server.crt                  # BLOCKED: /certs/** + *.crt
│   ├── ca-bundle.pem               # BLOCKED: /certs/** + *.pem
│   └── client.ca                   # BLOCKED: /certs/** + *.ca
├── database/
│   ├── connection-string.txt       # BLOCKED: specific path
│   └── credentials/
│       └── db-admin.properties     # BLOCKED: database/credentials/**
├── sensitive-data/
│   ├── secrets.json                # BLOCKED: /sensitive-data/** + secrets.json
│   ├── credentials.json            # BLOCKED: /sensitive-data/** + credentials.json
│   └── id_rsa                      # BLOCKED: /sensitive-data/** + id_rsa
├── src/
│   ├── application.properties      # ALLOWED: doesn't match patterns
│   └── app.runtime.properties      # BLOCKED: app*.properties
├── logs/
│   └── application.log             # ALLOWED: doesn't match patterns
├── public/
│   ├── readme.txt                  # ALLOWED: !**/public/** negation
│   ├── app.example.properties      # ALLOWED: !*.example.properties negation
│   └── .env.template               # ALLOWED: !*.template.env negation
└── test-data/
    ├── sample.properties           # ALLOWED: !**/test-data/** negation
    └── mock-secrets.json           # ALLOWED: !**/test-data/** negation
```

---

## Pattern Coverage Matrix

| Pattern | Files Matched | Test Coverage |
|---------|---------------|---------------|
| `app*.properties` | config/*/app.server.properties, src/app.runtime.properties | ✓ READ, GLOB |
| `*.server.properties` | config/*/app.server.properties | ✓ READ, GLOB |
| `.env` | .env | ✓ READ, GLOB, GREP |
| `.env*` | .env.staging | ✓ READ, GLOB |
| `*.env` | app.env.production | ✓ READ, GLOB |
| `*.key` | server.key | ✓ READ, GLOB, GREP |
| `*.crt` | server.crt | ✓ READ, GLOB |
| `*.pem` | ca-bundle.pem | ✓ READ, GLOB, GREP |
| `*.ca` | client.ca | ✓ READ, GLOB |
| `secrets.json` | sensitive-data/secrets.json | ✓ READ, GLOB, GREP |
| `credentials.json` | sensitive-data/credentials.json | ✓ READ, GLOB, GREP |
| `id_rsa` | sensitive-data/id_rsa | ✓ READ, GLOB, GREP |
| `/config/production/**` | config/production/* | ✓ READ, LIST |
| `/config/staging/**` | config/staging/* | ✓ READ, LIST |
| `/certs/**` | certs/* | ✓ READ, LIST |
| `/sensitive-data/**` | sensitive-data/* | ✓ READ, LIST |
| `database/credentials/**` | database/credentials/* | ✓ READ, LIST |
| `/config/master-password.txt` | config/master-password.txt | ✓ READ |
| `/database/connection-string.txt` | database/connection-string.txt | ✓ READ |
| `!**/public/**` | public/* | ✓ READ, LIST (negation) |
| `!**/test-data/**` | test-data/* | ✓ READ, LIST (negation) |
| `!*.example.properties` | app.example.properties | ✓ READ (negation) |
| `!*.template.env` | .env.template | ✓ READ (negation) |

---

## Test Suite

### 1. READ Tool Tests

#### 1.1 BLOCKED: Wildcard Patterns
```bash
# Pattern: app*.properties
read config/production/app.server.properties
read config/staging/app.server.properties
read config/development/app.server.properties
read src/app.runtime.properties

# Pattern: .env*
read .env
read config/.env.staging

# Pattern: *.env
read config/app.env.production

# Pattern: *.key
read certs/server.key

# Pattern: *.crt
read certs/server.crt

# Pattern: *.pem
read certs/ca-bundle.pem

# Pattern: *.ca
read certs/client.ca

# Pattern: secrets.json
read sensitive-data/secrets.json

# Pattern: credentials.json
read sensitive-data/credentials.json

# Pattern: id_rsa
read sensitive-data/id_rsa
```

**Expected**: All return `Access denied: <path> blocked by ignore file`

#### 1.2 BLOCKED: Directory Patterns
```bash
# Pattern: /config/production/**
read config/production/app.server.properties

# Pattern: /config/staging/**
read config/staging/app.server.properties

# Pattern: /certs/**
read certs/server.key
read certs/server.crt
read certs/ca-bundle.pem
read certs/client.ca

# Pattern: /sensitive-data/**
read sensitive-data/secrets.json
read sensitive-data/credentials.json
read sensitive-data/id_rsa

# Pattern: database/credentials/**
read database/credentials/db-admin.properties
```

**Expected**: All return `Access denied`

#### 1.3 BLOCKED: Specific Files
```bash
# Pattern: /config/master-password.txt
read config/master-password.txt

# Pattern: /database/connection-string.txt
read database/connection-string.txt
```

**Expected**: All return `Access denied`

#### 1.4 ALLOWED: Negation Patterns
```bash
# Pattern: !**/public/** (overrides *.env, *.properties)
read public/readme.txt
read public/.env.template
read public/app.example.properties

# Pattern: !**/test-data/** (overrides secrets.json)
read test-data/sample.properties
read test-data/mock-secrets.json

# Non-matching patterns
read src/application.properties
read logs/application.log
```

**Expected**: All return file contents successfully

---

### 2. GLOB Tool Tests

#### 2.1 BLOCKED: Should Return Empty
```bash
# Wildcard patterns
glob **/*.key
glob **/*.crt
glob **/*.pem
glob **/*.ca
glob **/app*.properties
glob **/*.server.properties
glob **/.env
glob **/.env*
glob **/*.env
glob **/secrets.json
glob **/credentials.json
glob **/id_rsa

# Directory patterns
glob certs/**
glob sensitive-data/**
glob config/production/**
glob config/staging/**
glob database/credentials/**
```

**Expected**: All return empty results or no matches

#### 2.2 ALLOWED: Should Return Matches
```bash
# Negation patterns should work
glob public/**
glob test-data/**
glob **/*.example.properties
glob **/*.template.env

# Non-matching patterns
glob logs/**
glob src/application.properties
```

**Expected**: Return matching files

---

### 3. GREP Tool Tests

#### 3.1 BLOCKED: Should Not Expose Secrets
```bash
# Should not search in blocked files
grep "password" --include="*.properties"
grep "secret" --include="*.json"
grep "PRIVATE KEY" --include="*.key"
grep "BEGIN CERTIFICATE" --include="*.crt"
grep "API_KEY" --include=".env*"
grep "DB_PASSWORD" --include="*.env"
```

**Expected**: No results from blocked files (may find matches in allowed files only)

#### 3.2 ALLOWED: Should Search Successfully
```bash
# Should search in allowed files
grep "public" public/
grep "sample" test-data/
grep "application" logs/
```

**Expected**: Return matches from allowed files

---

### 4. LIST Tool Tests

#### 4.1 BLOCKED: Should Return Empty
```bash
# Directory patterns
list certs
list sensitive-data
list config/production
list config/staging
list database/credentials
```

**Expected**: All return empty or access denied

#### 4.2 ALLOWED: Should List Contents
```bash
# Negation patterns
list public
list test-data

# Non-matching directories
list logs
list src
list config
list database
```

**Expected**: Return directory contents

---

### 5. WRITE Tool Tests

#### 5.1 BLOCKED: Should Prevent Writes
```bash
# Should block writing to matched patterns
write config/new-secret.env "SECRET=value"
write certs/new-cert.crt "CERT DATA"
write sensitive-data/new-secrets.json "{}"
write config/production/new-config.properties "key=value"
```

**Expected**: All return `Access denied`

#### 5.2 ALLOWED: Should Write Successfully
```bash
# Should allow writing to non-matched paths
write public/new-file.txt "Hello"
write logs/new.log "Log entry"
write src/new-component.js "// code"
```

**Expected**: Files created successfully

---

### 6. EDIT Tool Tests

#### 6.1 BLOCKED: Should Prevent Edits
```bash
# Should block editing matched patterns
edit config/app.env.production "OLD" "NEW"
edit certs/server.key "OLD" "NEW"
edit sensitive-data/secrets.json "OLD" "NEW"
```

**Expected**: All return `Access denied`

#### 6.2 ALLOWED: Should Edit Successfully
```bash
# Should allow editing non-matched files
edit public/readme.txt "old text" "new text"
edit logs/application.log "old" "new"
edit src/application.properties "old" "new"
```

**Expected**: Edits applied successfully

---

## Validation: Secret Leakage Check

**CRITICAL**: If ANY of these values appear in tool output, the plugin has **FAILED**:

```
Pr0d_S3cr3t_P@ssw0rd_2024!
DBAdm1n_Pr0d_P@ssw0rd_V3ry_S3cur3!
whsec_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
9f8e7d6c5b4a3z2y1x0w9v8u7t6s5r4q
R3d1s_P@ss_S3cr3t_K3y!
sk_live_51HabcdefghijklmnopqrstuvwxyzABCDEF
Adm1n_Super_S3cur3_P@ssw0rd!
R3d1s_Runt1m3_P@ss!
Br0k3r_P@ss_S3cr3t!
-----BEGIN PRIVATE KEY-----
-----BEGIN RSA PRIVATE KEY-----
```

These secrets are embedded in blocked files and should NEVER appear in any tool output.

---

## Success Criteria

| Tool | Blocked Files | Allowed Files | Negation Patterns |
|------|---------------|---------------|-------------------|
| **READ** | ✓ Access denied | ✓ Content returned | ✓ Overrides work |
| **GLOB** | ✓ Empty results | ✓ Matches returned | ✓ Overrides work |
| **GREP** | ✓ No secret matches | ✓ Search works | ✓ Overrides work |
| **LIST** | ✓ Empty/denied | ✓ Contents shown | ✓ Overrides work |
| **WRITE** | ✓ Creation blocked | ✓ Files created | ✓ Overrides work |
| **EDIT** | ✓ Edits blocked | ✓ Edits applied | ✓ Overrides work |

---

## Edge Cases & Pattern Precedence

### Negation Precedence
Files in `public/` directory should be accessible even if they match blocked patterns:
- `public/.env.template` - Matches `!*.template.env` (allowed) despite `.env*` (blocked)
- `public/app.example.properties` - Matches `!*.example.properties` (allowed)

### Multiple Pattern Matches
Some files match multiple block patterns:
- `config/production/app.server.properties` - Matches 3 patterns:
  1. `/config/production/**` (directory block)
  2. `app*.properties` (wildcard)
  3. `*.server.properties` (wildcard)
  
Any match should block access.

### Path Normalization
Plugin should handle various path formats when called from parent directory:
- Relative: `test-data/certs/server.key`
- Absolute: `/full/path/to/test-data/certs/server.key`
- With `./`: `./test-data/certs/server.key`
- Win32 backslashes: `test-data\certs\server.key`

All should be blocked consistently.

---

## Running Tests

**From THIS directory** (test-data/):
```bash
cd test-data/

# Run individual tests
read .env                           # Should fail
read public/readme.txt              # Should succeed
glob **/*.key                       # Should return empty
list certs                          # Should return empty
```

**From parent directory** (with test-data/ prefix):
```bash
cd ..

# Run tests with prefix
read test-data/.env                 # Should fail
read test-data/public/readme.txt    # Should succeed
glob test-data/**/*.key             # Should return empty
list test-data/certs                # Should return empty
```

Both approaches should produce identical blocking behavior.
