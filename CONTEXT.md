# DigiGate-Web — Project Context

> **Purpose of this file:** This is a comprehensive context document for AI coding assistants.
> Reading this file provides full architectural understanding of the project without
> needing to scan the entire repository. Keep this file updated when making structural changes.

---

## 1. What is DigiGate?

DigiGate is a **multi-tenant SaaS gate management system** for college campuses. It digitizes entry/exit logging at hostel gates and campus gates using QR codes. Each registered college (tenant) gets isolated data within a shared PostgreSQL database using a **Schema-per-Tenant** architecture.

### User Roles
| Role | What they do |
|------|-------------|
| **Student** | Scans QR codes at gates to log entry/exit. Can also log in via Google OAuth. |
| **Guard** | Stationed at gates. Generates QR codes for students to scan. Can also log entries manually. |
| **Admin** | Full CRUD over Students, Guards, Locations, Logs, and other Admins within their institute. |
| **SuperAdmin** | Platform operator. Provisions new institutes and runs cross-tenant migrations. Not a UI role — API-only via Bearer token. |

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite | React 19, Vite 7 |
| Routing | react-router-dom | v7 |
| Styling | Vanilla CSS (glassmorphism theme) | — |
| QR Code | html5-qrcode (scanning), qrcode (generation) | — |
| Backend | Express.js | v5 |
| Database | PostgreSQL (Supabase-hosted) | — |
| Auth | express-session (password) + Google OAuth (students) | — |
| Google Auth | google-auth-library (backend), Google Identity Services (frontend) | — |
| Multi-tenancy | Schema-per-Tenant via `SET search_path` | — |

---

## 3. Directory Structure

```
Digigate-web/
├── index.html                  # Entry HTML (includes Google Identity Services script)
├── package.json                # Frontend dependencies
├── vite.config.js              # Vite config
├── vercel.json                 # Vercel SPA rewrites
├── .env                        # Frontend env (VITE_Backend_URL, VITE_GOOGLE_CLIENT_ID)
│
├── src/
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Route definitions
│   ├── App.css                 # Minimal root layout
│   ├── index.css               # Global design tokens (CSS variables)
│   ├── utils/
│   │   └── api.js              # apiFetch() — centralized fetch with X-Tenant-Domain header
│   └── pages/
│       ├── login.jsx           # Tabbed login (Student/Guard/Admin) with Google OAuth
│       ├── login.css
│       ├── landing-page.jsx    # Public landing page
│       ├── landing-page.css
│       ├── student-dashboard.jsx  # QR scanner, attendance logs
│       ├── student-dashboard.css
│       ├── guard-page.jsx      # QR generator, manual log entry
│       ├── guard-page.css
│       ├── qr-code.jsx         # QR code generation component (used by guard-page)
│       ├── admin-dashboard.jsx # Full CRUD for all entities
│       └── admin-dashboard.css
│
├── public/
│   ├── vite.svg                # Favicon
│   └── _redirects              # Netlify SPA fallback
│
└── Backend/
    ├── server.js               # Express server (all API routes)
    ├── tenantManager.js        # Tenant lookup, provisioning, migration
    ├── schema.sql              # Tenant table template (used during provisioning)
    ├── master-schema.sql       # Public tenants catalog table
    ├── package.json            # Backend dependencies
    └── .env                    # DB credentials, GOOGLE_CLIENT_ID, SUPERADMIN_API_KEY
```

---

## 4. Multi-Tenancy Architecture

### How it works
- **One Supabase PostgreSQL database**, multiple schemas
- The `public` schema contains a `tenants` table (the master catalog)
- Each college gets its own schema (e.g., `iiitdmj`) with identical table structure
- On every API request, middleware resolves the tenant from `req.session.user.domain` or the `X-Tenant-Domain` header
- A `SET search_path TO "<schema_name>"` is executed before any query
- `client.release()` is monkey-patched to always reset `search_path TO public`

### Tenant Resolution Flow
```
Request → Tenant Middleware → lookupTenant(domain) → SET search_path → Route Handler → Release (resets path)
```

### Key Files
- **`tenantManager.js`** — `lookupTenant()`, `provisionTenant()`, `runMigration()`, `invalidateCache()`
- **`master-schema.sql`** — Creates the `public.tenants` table
- **`schema.sql`** — Template tables created inside each tenant schema

### Tenant Middleware Skip Paths
These paths bypass tenant resolution (no schema switching needed):
- `/api/superadmin/*` — uses raw `pool.connect()` against `public` schema
- `/api/me` — reads from session only
- `/api/logout` — destroys session only
- `/api/public/*` — fetches tenant list for login dropdown

---

## 5. API Endpoints

### Public (No auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/tenants` | List active institutes (for login dropdown) |

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login/student` | Student login (password or `google_token`) |
| POST | `/api/login/guard` | Guard login (password) |
| POST | `/api/login/admin` | Admin login (password) |
| GET | `/api/me` | Check session status |
| POST | `/api/logout` | Destroy session |

### Student Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/mark-attendance` | QR-based attendance (validates timestamp, prevents duplicates) |
| GET | `/api/student/logs` | Get recent logs for logged-in student |

### Guard Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/guard/location` | Update guard's assigned location |
| POST | `/api/guard/manual-log` | Manual entry/exit log for a student |
| GET | `/api/guard/recent-logs?place_id=X` | Get recent logs at a location |

### Admin CRUD Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard stats (student/guard counts, recent logs) |
| GET | `/api/admin/students` | List all students |
| GET | `/api/admin/guards` | List all guards |
| GET | `/api/admin/locations` | List all locations |
| POST | `/api/admin/logs` | List all logs |
| GET | `/api/admin/admins` | List all admins |
| POST | `/api/admin/add-{entity}` | Create student/guard/location/log/admin |
| PUT | `/api/admin/update-{entity}/:id` | Update entity by ID |
| DELETE | `/api/admin/delete-{entity}/:id` | Delete entity by ID |

### SuperAdmin Routes (Bearer token auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/superadmin/tenants` | List all registered tenants |
| POST | `/api/superadmin/register-institute` | Provision new tenant (schema + tables) |
| POST | `/api/superadmin/run-migration` | Run SQL across all tenant schemas |

---

## 6. Database Schema (Per-Tenant)

Each tenant schema contains these tables:

```sql
Student(Roll_No PK, Name, Email, Hostel_Name, Password)
Location(Place_Id PK, Place_Name)
Guard(Guard_Id PK, Guard_Name, Place_Id FK→Location, Password)
Admin(Admin_Id PK, Name, Department, Password)
Log(roll_no+Guard_Id+Place_Id PK, log_type, Timestamp,
    FK→Student, FK→Location, FK→Guard)
```

### Master Catalog (`public.tenants`)
```sql
tenants(id SERIAL PK, institute_name, domain UNIQUE, schema_name UNIQUE, created_at, is_active)
```

---

## 7. Frontend Architecture

### Routing (`App.jsx`)
| Path | Component | Auth Required |
|------|-----------|--------------|
| `/` | LandingPage | No |
| `/login` | LoginPage | No |
| `/student-dashboard` | StudentDashboard | Student session |
| `/admin-dashboard` | AdminDashboard | Admin session |
| `/guard-page` | GuardPage | Guard session |

### API Communication (`src/utils/api.js`)
All frontend API calls use `apiFetch()` which:
1. Prepends `VITE_Backend_URL` to the path
2. Injects `X-Tenant-Domain` header (from subdomain or `localStorage`)
3. Sets `credentials: 'include'` for session cookies

### Login Page (`login.jsx`)
- **3 role tabs**: Student, Guard, Admin
- **Student tab**: Google Sign-In button (primary) + password fallback behind "Having trouble?" toggle
- **Guard/Admin tabs**: ID + Password form
- Institute dropdown at the top (fetched from `/api/public/tenants`)

### Design System
- **Theme**: Dark glassmorphism (`--bg-dark: #050511`)
- **Fonts**: Outfit, Inter (Google Fonts)
- **CSS Variables**: Defined in `index.css` and re-declared in page-level CSS
- **No CSS framework** — all vanilla CSS

---

## 8. Environment Variables

### Frontend (`.env`)
```
VITE_Backend_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
```

### Backend (`Backend/.env`)
```
host=<supabase-host>
DB_PORT=5432
database=postgres
user=<supabase-user>
password=<db-password>
port=3000
Frontend_URL=http://localhost:5173
NODE_ENV=development
SUPERADMIN_API_KEY=<secret-key>
GOOGLE_CLIENT_ID=<your-google-client-id>
```

> **Important**: Use Supabase's **Direct Connection** (port 5432), NOT the Transaction Pooler (port 6543). `SET search_path` is session-level state and will leak across requests if using transaction pooling.

---

## 9. Session Structure

After login, `req.session.user` contains:

**Student:**
```json
{ "userRollNo": "21BCS001", "userName": "...", "userEmail": "...", "hostelName": "...", "domain": "iiitdmj", "role": "student" }
```

**Guard:**
```json
{ "userGuardId": "G001", "userName": "...", "domain": "iiitdmj", "role": "guard" }
```

**Admin:**
```json
{ "userAdminId": "A001", "userName": "...", "userDepartment": "...", "domain": "iiitdmj", "role": "admin" }
```

The `domain` field is critical — it's how the tenant middleware resolves the schema on subsequent requests when no `X-Tenant-Domain` header is present.

---

## 10. Known Limitations & Future Work

1. **Passwords are stored in plaintext** — `bcrypt` is installed but not yet used. Hashing should be added.
2. **No RBAC middleware on all routes** — `isAdmin` middleware exists but student/guard routes rely only on session existence.
3. **Session store is in-memory** — Will be lost on server restart. Consider `connect-pg-simple` for production.
4. **No rate limiting** — SuperAdmin and login endpoints should have rate limiting.
5. **Chunk size warning** — Frontend bundle is ~880KB. Consider code-splitting with `React.lazy()`.
6. **Landing page hardcodes "IIITDMJ"** — Should be dynamic per tenant.
