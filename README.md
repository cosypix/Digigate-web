# DigiGate Web

A **multi-tenant SaaS gate management system** for college campuses. DigiGate digitizes entry/exit logging at hostel and campus gates using QR codes, with full data isolation per institute.

> **For AI assistants:** Read [`CONTEXT.md`](./CONTEXT.md) for full architectural context instead of scanning the repo.

## 🚀 Features

### Multi-Tenancy
- **Schema-per-Tenant** architecture on a single PostgreSQL database
- Automatic schema routing via subdomain or login selection
- SuperAdmin API for provisioning new institutes

### 🎓 Student Portal
- **Google Sign-In** for seamless authentication
- Password-based login as fallback
- QR code scanning for entry/exit logging
- Personal log history

### 🛡️ Guard Interface
- QR code generation for students to scan
- Manual entry/exit logging
- Live feed of recent logs at assigned location

### 🔑 Admin Dashboard
- Full CRUD for Students, Guards, Admins, Locations, and Logs
- Real-time campus statistics

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 |
| Styling | Vanilla CSS (dark glassmorphism) |
| Backend | Express.js 5 |
| Database | PostgreSQL (Supabase) |
| Auth | Session-based + Google OAuth |
| QR | html5-qrcode / qrcode |

## ⚙️ Setup

### 1. Clone & Install
```bash
git clone https://github.com/abhay-006/Digigate-web.git
cd Digigate-web
npm install          # Frontend deps
cd Backend && npm install  # Backend deps
```

### 2. Configure Environment

**Frontend `.env`:**
```env
VITE_Backend_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Backend `Backend/.env`:**
```env
host=your-supabase-host
DB_PORT=5432
database=postgres
user=your-db-user
password=your-db-password
port=3000
Frontend_URL=http://localhost:5173
NODE_ENV=development
SUPERADMIN_API_KEY=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### 3. Database Setup

Run the following SQL in your Supabase SQL Editor to create the master catalog and your first tenant:

```sql
-- Master catalog
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    institute_name VARCHAR(100) NOT NULL,
    domain VARCHAR(50) UNIQUE NOT NULL,
    schema_name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- First tenant (example)
-- Use the SuperAdmin API or run schema.sql manually inside a new schema
```

Or use the SuperAdmin API after starting the server:
```bash
curl -X POST http://localhost:3000/api/superadmin/register-institute \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"institute_name": "IIITDM Jabalpur", "domain": "iiitdmj", "schema_name": "iiitdmj"}'
```

### 4. Run

```bash
# Terminal 1: Backend
cd Backend && node server.js

# Terminal 2: Frontend
npm run dev
```

### 5. Local Dev: Set Tenant

In browser console:
```javascript
localStorage.setItem('tenantDomain', 'iiitdmj');
```

## 📁 Project Structure

```
├── src/pages/       # React page components (login, dashboards)
├── src/utils/api.js # Centralized fetch with tenant header injection
├── Backend/
│   ├── server.js         # All API routes + tenant middleware
│   ├── tenantManager.js  # Tenant lookup, provisioning, migrations
│   ├── schema.sql        # Per-tenant table template
│   └── master-schema.sql # Public tenants catalog
└── CONTEXT.md       # Full project context for AI assistants
```

## 📄 License

ISC License
