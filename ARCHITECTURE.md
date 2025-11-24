# LeadConnectBackend Architecture

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                      │
│                    (Frontend - React/Next.js)                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ HTTP/REST API
                               │ (Bearer Token Auth)
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      NestJS Application Layer                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     API Gateway                            │  │
│  │                    (Express/HTTP)                          │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │                  Authentication Layer                       │ │
│  │  • TokenAuthGuard (Custom JWT-like Guard)                  │ │
│  │  • TokenService (Custom Token Generation)                  │ │
│  │  • EmailService (Nodemailer/Hostinger SMTP)                │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                        │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │                    Business Logic Layer                     │ │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │ AuthService  │ │ Leads    │ │ Profile  │ │Analytics │ │ │
│  │  │              │ │ Service  │ │ Service  │ │ Service  │ │ │
│  │  └──────────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                        │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │                    Data Access Layer                        │ │
│  │                  (TypeORM Repositories)                     │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           │ SQL Queries
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      PostgreSQL Database                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  users   │ │  leads   │ │  tokens  │ │password_ │         │
│  │          │ │          │ │          │ │ resets   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │notif_    │ │security_ │ │user_     │ │user_     │         │
│  │settings  │ │settings  │ │prefs     │ │perms     │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Module Structure

```
src/
├── main.ts                      # Application entry point
├── app.module.ts                # Root module
│
├── auth/                        # Authentication Module
│   ├── auth.module.ts
│   ├── auth.controller.ts       # /auth/* endpoints
│   ├── auth.service.ts          # Login, Signup, Password Reset
│   ├── guards/
│   │   └── token-auth.guard.ts  # Custom token authentication
│   ├── services/
│   │   ├── token.service.ts     # Token generation & validation
│   │   └── email.service.ts     # Email sending (OTP, notifications)
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── signup.dto.ts
│   │   ├── forgot-password.dto.ts
│   │   ├── verify-otp.dto.ts
│   │   └── reset-password.dto.ts
│   └── enums/
│       └── user.enums.ts        # UserRole, CompanySize, Industry
│
├── users/                       # Users Module
│   ├── users.module.ts
│   ├── users.controller.ts      # /users/* endpoints
│   ├── users.service.ts
│   └── dto/
│       └── user-response.dto.ts
│
├── leads/                       # Leads Module
│   ├── leads.module.ts
│   ├── leads.controller.ts      # /leads/* endpoints
│   ├── leads.service.ts         # CRUD + Import/Export
│   ├── dto/
│   │   ├── create-lead.dto.ts
│   │   ├── update-lead.dto.ts
│   │   ├── lead-response.dto.ts
│   │   ├── get-leads-query.dto.ts
│   │   ├── paginated-leads-response.dto.ts
│   │   ├── import-leads.dto.ts
│   │   └── import-leads-response.dto.ts
│   └── enums/
│       └── lead.enums.ts        # CustomerCategory, LeadStatus, LeadSource
│
├── analytics/                   # Analytics Module
│   ├── analytics.module.ts
│   ├── analytics.controller.ts  # /analytics endpoint
│   ├── analytics.service.ts     # Analytics calculations
│   └── dto/
│       ├── analytics-query.dto.ts
│       └── analytics-response.dto.ts
│
├── profile/                     # Profile & Settings Module
│   ├── profile.module.ts
│   ├── profile.controller.ts    # /profile/* endpoints
│   ├── profile.service.ts       # Settings + Sub-user management
│   └── dto/
│       ├── update-profile.dto.ts
│       ├── change-password.dto.ts
│       ├── update-profile-preferences.dto.ts
│       ├── profile-preferences-response.dto.ts
│       ├── create-sub-user.dto.ts
│       ├── sub-user-response.dto.ts
│       └── update-sub-user-permissions.dto.ts
│
├── entities/                    # TypeORM Entities
│   ├── user.entity.ts
│   ├── lead.entity.ts
│   ├── token.entity.ts
│   ├── password-reset.entity.ts
│   ├── notification-settings.entity.ts
│   ├── security-settings.entity.ts
│   ├── user-preferences.entity.ts
│   └── user-permissions.entity.ts
│
└── apis/                        # Frontend Integration Files
    ├── axios.config.ts          # Axios instance with interceptors
    ├── types.ts                 # TypeScript types
    ├── auth.service.ts          # Auth API client
    ├── leads.service.ts         # Leads API client
    ├── analytics.service.ts     # Analytics API client
    ├── profile.service.ts       # Profile API client
    └── index.ts                 # Main exports
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                        users                                 │
├─────────────────────────────────────────────────────────────┤
│ PK  id               INTEGER (Auto-increment)                │
│     name             VARCHAR(255)                            │
│     email            VARCHAR(255) UNIQUE                     │
│     password         VARCHAR(255)                            │
│     role             VARCHAR(50)                             │
│     custom_role      VARCHAR(255)                            │
│     company_name     VARCHAR(255)                            │
│     company_size     VARCHAR(50)                             │
│     industry         VARCHAR(255)                            │
│     custom_industry  VARCHAR(255)                            │
│     website          VARCHAR(255)                            │
│     phone_number     VARCHAR(50)                             │
│     subscription_status VARCHAR(50)                          │
│     subscription_plan VARCHAR(50)                            │
│     is_active        BOOLEAN                                 │
│     created_at       TIMESTAMP                               │
│     updated_at       TIMESTAMP                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    leads      │   │    tokens     │   │password_resets│
├───────────────┤   ├───────────────┤   ├───────────────┤
│ PK  id        │   │ PK  id        │   │ PK  id        │
│ FK  user_id   │   │ FK  user_id   │   │ FK  user_id   │
│     name      │   │     token     │   │     email     │
│     phone     │   │     token_type│   │     otp       │
│     email     │   │     expires_at│   │     expires_at│
│     ...       │   │     created_at│   │     used      │
│               │   │               │   │     created_at│
└───────────────┘   └───────────────┘   └───────────────┘

┌─────────────────────────────────────────────────────────────┐
│              user_permissions                                │
├─────────────────────────────────────────────────────────────┤
│ PK  user_id         VARCHAR(255) → users(id)                 │
│ FK  parent_user_id  VARCHAR(255) → users(id)                 │
│     can_view_leads  BOOLEAN                                 │
│     can_edit_leads  BOOLEAN                                 │
│     can_add_leads   BOOLEAN                                 │
│     created_at      TIMESTAMP                               │
│     updated_at      TIMESTAMP                               │
└─────────────────────────────────────────────────────────────┘
         │                           │
         │                           │
         │ 1:1                       │ 1:N
         │                           │
         ▼                           ▼
┌──────────────────┐      ┌───────────────────────────┐
│notification_     │      │    security_settings      │
│settings          │      ├───────────────────────────┤
├──────────────────┤      │ PK  id                    │
│ PK  id           │      │ FK  user_id               │
│ FK  user_id      │      │     two_factor_enabled    │
│     new_leads    │      │     login_notifications   │
│     follow_ups   │      │     session_timeout       │
│     hot_leads    │      │     api_key               │
│     conversions  │      │     last_password_change  │
│     browser_push │      │     ...                   │
│     daily_summary│      └───────────────────────────┘
│     ...          │
└──────────────────┘
         │
         │ 1:1
         │
         ▼
┌──────────────────┐
│ user_preferences │
├──────────────────┤
│ PK  id           │
│ FK  user_id      │
│     default_view │
│     items_per_page│
│     auto_save    │
│     compact_mode │
│     export_format│
│     export_notes │
│     ...          │
└──────────────────┘
```

## Authentication Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. POST /auth/login
     │    { email, password }
     │
     ▼
┌──────────────────┐
│ AuthController   │
└────┬─────────────┘
     │
     │ 2. AuthService.login()
     │
     ▼
┌──────────────────┐
│ AuthService      │
│ • Find user by   │
│   email          │
│ • Verify password│
│ • Check isActive │
└────┬─────────────┘
     │
     │ 3. TokenService.generateTokens()
     │
     ▼
┌──────────────────┐
│ TokenService     │
│ • Create access  │
│   token (1 hour) │
│ • Create refresh │
│   token (7 days) │
│ • Save to DB     │
└────┬─────────────┘
     │
     │ 4. Return tokens + user data
     │
     ▼
┌─────────┐
│ Client  │
│ Stores  │
│ tokens  │
└────┬────┘
     │
     │ 5. Subsequent Requests
     │    Header: Authorization: Bearer <token>
     │
     ▼
┌──────────────────┐
│ TokenAuthGuard   │
│ • Extract token  │
│ • Validate token │
│ • Get user       │
│ • Attach to req  │
└────┬─────────────┘
     │
     │ 6. Allow request
     │
     ▼
┌──────────────────┐
│  Endpoint Handler│
│  • Access req.user│
│  • Process request│
└──────────────────┘
```

## Sub-User Management Flow

```
┌──────────────────┐
│ Management User  │
│ (Parent User)    │
└────┬─────────────┘
     │
     │ 1. POST /profile/sub-users
     │    { fullName, email, password, role, permissions }
     │
     ▼
┌──────────────────┐
│ ProfileController│
└────┬─────────────┘
     │
     │ 2. Verify user role = Management
     │
     ▼
┌──────────────────┐
│ ProfileService   │
│ • Validate data  │
│ • Hash password  │
│ • Create user    │
│   (inherit company│
│    from parent)  │
│ • Create         │
│   permissions    │
└────┬─────────────┘
     │
     │ 3. Save to DB
     │
     ▼
┌─────────────────────────────────────┐
│ Database                            │
│ • Insert into users                 │
│ • Insert into user_permissions      │
│   - user_id (sub-user)              │
│   - parent_user_id (management)     │
│   - can_view_leads                  │
│   - can_edit_leads                  │
│   - can_add_leads                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Sub-User Access Flow                    │
├─────────────────────────────────────────┤
│ 1. Sub-user logs in                    │
│ 2. Gets token with their user ID       │
│ 3. Accesses endpoint (e.g., /leads)    │
│ 4. LeadsService checks:                │
│    - Is sub-user? (check user_perms)   │
│    - Has permission?                   │
│    - Get parent user ID                │
│    - Filter leads by:                  │
│      • parent user's leads OR          │
│      • same company leads              │
└─────────────────────────────────────────┘
```

## API Endpoints Structure

```
Base URL: http://localhost:3000/api

Authentication Endpoints (Public)
├── POST   /auth/signup
├── POST   /auth/login
├── POST   /auth/refresh
├── POST   /auth/logout
├── POST   /auth/forgot-password
├── POST   /auth/verify-otp
└── POST   /auth/reset-password

Users Endpoints (Protected)
├── GET    /users
└── GET    /users/:id

Leads Endpoints (Protected)
├── GET    /leads              # Get all leads (paginated, filtered)
├── GET    /leads/:id          # Get lead by ID
├── POST   /leads              # Create lead
├── PATCH  /leads/:id          # Update lead
├── DELETE /leads/:id          # Delete lead
├── POST   /leads/import       # Bulk import leads
└── GET    /leads/export       # Export leads as CSV

Analytics Endpoints (Protected)
└── GET    /analytics          # Get analytics (query: ?days=7)

Profile Endpoints (Protected)
├── GET    /profile/preferences              # Get all settings
├── PUT    /profile/preferences/notifications # Update notifications
├── PUT    /profile/preferences/security      # Update security
├── PUT    /profile/preferences/app           # Update app prefs
├── PATCH  /profile                          # Update profile
├── POST   /profile/change-password          # Change password
│
└── Sub-Users (Management only)
    ├── GET    /profile/sub-users                    # List sub-users
    ├── POST   /profile/sub-users                    # Create sub-user
    ├── PATCH  /profile/sub-users/:id/permissions    # Update permissions
    └── DELETE /profile/sub-users/:id                # Delete sub-user
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        Technology Stack                      │
├─────────────────────────────────────────────────────────────┤
│ Runtime          │ Node.js                                  │
│ Framework        │ NestJS (v10+)                            │
│ Language         │ TypeScript                               │
│ ORM              │ TypeORM                                  │
│ Database         │ PostgreSQL (AWS RDS)                     │
│ Validation       │ class-validator, class-transformer       │
│ Password Hashing │ bcryptjs                                 │
│ Email            │ Nodemailer (Hostinger SMTP)              │
│ HTTP Server      │ Express (via NestJS)                     │
│ Security         │ Custom Token System (Bearer Auth)        │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Token-Based Authentication                               │
│    • Custom token system (256-char hex tokens)              │
│    • Access tokens: 1 hour expiration                       │
│    • Refresh tokens: 7 days expiration                      │
│    • Tokens stored in database                              │
│                                                             │
│ 2. Password Security                                        │
│    • bcrypt hashing (10 rounds)                             │
│    • Password reset via OTP (6 digits, 10 min expiry)       │
│    • Current password verification for changes              │
│                                                             │
│ 3. Role-Based Access Control                                │
│    • User roles: Sales Rep, Sales Manager, Management       │
│    • Management users can create sub-users                  │
│    • Sub-user permissions granular (view/edit/add leads)    │
│                                                             │
│ 4. Data Isolation                                           │
│    • Users can only access their own leads                  │
│    • Sub-users see parent's company leads                   │
│    • Company-based filtering for sub-users                  │
│                                                             │
│ 5. Input Validation                                         │
│    • DTO validation with class-validator                    │
│    • Type safety with TypeScript                            │
│    • SQL injection prevention via TypeORM                   │
│                                                             │
│ 6. SSL/TLS                                                  │
│    • Database connections over SSL                          │
│    • Production: HTTPS required                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: Lead Creation

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /leads
     │ Authorization: Bearer <token>
     │ Body: { name, phoneNumber, email, ... }
     │
     ▼
┌──────────────────┐
│ TokenAuthGuard   │
│ • Validate token │
│ • Get user ID    │
│ • Attach to req  │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ LeadsController  │
│ • Validate DTO   │
│ • Extract userId │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ LeadsService     │
│ • Check if       │
│   sub-user?      │
│ • Check          │
│   permissions    │
│ • Use parent ID  │
│   if sub-user    │
│ • Create lead    │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Lead Entity      │
│ • Save to DB     │
│ • Link to user   │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ PostgreSQL       │
│ • Insert lead    │
│ • Return lead    │
└────┬─────────────┘
     │
     ▼
┌─────────┐
│ Client  │
│ Response│
└─────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Production Environment                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐          │
│  │   Load Balancer │────────▶│  NestJS App     │          │
│  │   (HTTPS)       │         │  Instance 1     │          │
│  │                 │         │  Port: 3000     │          │
│  │                 │         └─────────────────┘          │
│  │                 │                                       │
│  │                 │         ┌─────────────────┐          │
│  │                 │────────▶│  NestJS App     │          │
│  │                 │         │  Instance 2     │          │
│  └─────────────────┘         │  Port: 3000     │          │
│                              └────────┬────────┘          │
│                                       │                    │
│                              ┌────────▼────────┐          │
│                              │  PostgreSQL     │          │
│                              │  AWS RDS        │          │
│                              │  (AWS RDS)      │          │
│                              └─────────────────┘          │
│                                                             │
│  Environment Variables:                                     │
│  • DATABASE_URL                                             │
│  • SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS              │
│  • NODE_ENV=production                                      │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Handling                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Request → Guard → Controller → Service → Repository        │
│                                                             │
│ Errors:                                                     │
│ • 400 Bad Request     → Validation errors                  │
│ • 401 Unauthorized    → Invalid/missing token              │
│ • 403 Forbidden       → Permission denied (sub-users)      │
│ • 404 Not Found       → Resource not found                 │
│ • 409 Conflict        → Duplicate email/user               │
│ • 500 Internal Server → Unexpected errors                  │
│                                                             │
│ All errors return:                                         │
│ {                                                           │
│   "message": string | string[],                            │
│   "error": string,                                         │
│   "statusCode": number                                     │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

```
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Files                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ .env (Environment Variables)                                │
│ • DATABASE_URL          → PostgreSQL connection string      │
│ • SMTP_HOST             → Email server host                 │
│ • SMTP_PORT             → Email server port                 │
│ • SMTP_USER             → Email username                    │
│ • SMTP_PASS             → Email password                    │
│ • SMTP_SECURE           → SSL/TLS enabled                   │
│                                                             │
│ tsconfig.json                                              │
│ • TypeScript compiler options                              │
│ • Decorator metadata enabled                               │
│                                                             │
│ package.json                                               │
│ • Dependencies                                            │
│ • Scripts (start, build, etc.)                            │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

1. **Custom Token Authentication** - Secure token system without JWT
2. **Role-Based Access Control** - Management, Sales Manager, Sales Rep roles
3. **Sub-User Management** - Hierarchical user structure with permissions
4. **Lead Management** - Full CRUD with filtering, search, pagination
5. **Bulk Operations** - Import/Export leads (CSV)
6. **Analytics** - Comprehensive analytics with time-based metrics
7. **Profile Settings** - Notifications, Security, App preferences
8. **Password Reset** - OTP-based password reset flow
9. **Data Isolation** - Users only see their own data
10. **Company-Based Filtering** - Sub-users see company-wide leads





