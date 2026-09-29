# EOT Couplings ERP - Industrial Tube & Pipe Manufacturing ERP System

[![Production Build](https://github.com/your-org/tube-pipe-erp/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/tube-pipe-erp/actions/workflows/deploy.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2.15%20(App%20Router)-black.svg)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Prisma%205-blue.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/license-Enterprise-blue.svg)]()

An enterprise-grade, end-to-end Enterprise Resource Planning (ERP) platform architected specifically for **OCTG (Oil Country Tubular Goods), API 5CT casing and tubing processing, and precision coupling manufacturing operations**. 

The system enforces strict mathematical cutting yield calculations, physical weighbridge receiving tolerance gates, multi-stage shop floor routing balance checks, defect disposition categorization, bidirectional metallurgical provenance tracing (from mill heat number down to individual pipe scrap), and dynamic database-backed Role-Based Access Control (RBAC).

---

## 1. Executive Summary & Tech Stack

### Core Technologies
- **Application Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Actions, Edge/Node Route Handlers, Client Components)
- **Frontend & UI**: React 18, Tailwind CSS, Lucide React Icons, Dynamic Sticky Action Modals, `<PasswordInput />` Visibility Toggles
- **Database ORM**: [Prisma ORM 5.22+](https://www.prisma.io/) with full PostgreSQL dialect support
- **Production Database**: PostgreSQL 16+ (AWS RDS / Amazon Aurora Serverless)
- **Authentication & Security**: Pure WebAssembly Argon2id (`hash-wasm`), HTTP-only encrypted session cookies, tamper-evident Audit Logging
- **CI/CD & DevOps**: GitHub Actions, Docker, AWS RDS, AWS App Runner / Amplify / ECS Fargate

---

## 2. Enterprise Relational Architecture (15 Tables)

The database schema (`prisma/schema.prisma`) models the complete industrial manufacturing lifecycle across 15 interconnected relational tables:

```mermaid
erDiagram
    Supplier ||--o{ PurchaseOrder : issues
    PurchaseOrder ||--|{ POItem : contains
    Product ||--o{ POItem : references
    PurchaseOrder ||--o{ GRN : delivers
    GRN ||--|{ GRNItem : inspects
    POItem ||--o{ GRNItem : fulfills
    GRNItem ||--|{ TallySheet : records
    TallySheet ||--|{ TallyItem : logs
    CustomerOrder ||--|{ CustomerPOLineItem : specifies
    CustomerOrder ||--o{ WorkOrder : triggers
    CustomerPOLineItem ||--o{ WorkOrder : produces
    TallyItem ||--o{ WorkOrder : allocates
    Product ||--o{ WorkOrder : targets
    WorkOrder ||--|{ ProductionPosting : routes
    ProductionPosting ||--o{ RejectionPosting : categorizes
    WorkOrder ||--o{ RejectionPosting : scraps
    User ||--o{ Session : maintains
    User ||--o{ AuditLog : audits
    RoleModulePermission }|--|| User : authorizes
```

### Table Definitions & Roles

| # | Entity / Model | Primary Key | Description & Domain Logic |
|---|---|---|---|
| **1** | `Supplier` | `supplier_id` (PK) | Master record for raw pipe mills, plant addresses, GST/Tax IDs, and onboarding dates. |
| **2** | `Product` | `product_id` (PK) | API 5CT specifications: Outer Diameter (OD), Wall Thickness (WT), Grade (`J55`, `K55`, `L80`, `P110`, `Q125`), Thread profile (`BTC`, `LTC`, `STC`, `Premium`), Charpy V-Notch (CVN) impact toughness, and nominal weight (kg/m). |
| **3** | `PurchaseOrder` | `po_no` (PK) | Procurement order header, supplier association, delivery & payment terms, advance value, and remaining balance. |
| **4** | `POItem` | `po_item_id` (PK) | Purchase order line items for plain-end (PE) raw mother pipes with ordered quantity, weight in MT, unit pricing, and status. |
| **5** | `GRN` | `grn_id` (PK) | Goods Receipt Note with weighbridge gross vs invoice weight reconciliation and physical pipe vs tally count gate (`Matched` / `Mismatch`). |
| **6** | `GRNItem` | `grn_item_id` (PK) | Inwarded pipe inspection gate (`Pending QA`, `Accepted`, `Rejected`) with received vs invoice weight deltas. |
| **7** | `TallySheet` | `ts_id` (PK) | Heat number and Lot number master header, Mill Test Certificate (MTC) link, inspector identity, bundle counts. |
| **8** | `TallyItem` | `ti_id` (PK) | Individual pipe barcode/tag entry with **automated cutting yield math**: $\text{Expected Qty} = \text{Length} / \text{Parting}$, $\text{Scrap} = \text{Length} - (\text{Rounded Qty} \times \text{Parting})$. |
| **9** | `CustomerOrder` | `customer_po_no` (PK) | Finished casing/coupling sales demand header with customer identity, delivery dates, and financial sums. |
| **10** | `CustomerPOLineItem` | `cpo_item_id` (PK) | Finished coupling/casing requirements (exact Size, Grade, and Thread specification requested by customer). |
| **11** | `WorkOrder` | `wo_id` (PK) | Shop job card allocating available plain-end mother pipes from the yard, linking to customer demand or stock production. |
| **12** | `ProductionPosting` | `pp_id` (PK) | 8-stage manufacturing routing logs (`Cutting`, `ID Roughing`, `OD Roughing`, `Threading`, `MPI`, `Phosphating`, `Painting`, `Packing`). Enforces $\text{Input Qty} \equiv \text{Accepted} + \text{Rejected} + \text{Rework}$. |
| **13** | `RejectionPosting` | `rp_id` (PK) | Defect categorization across 14 failure modes and 4 scrap dispositions (`Scrap`, `Down-grade`, `Recut Short`, `Rework Thread`). |
| **14** | `User` | `id` (UUID PK) | Corporate user directory, credentials (Argon2id WASM hash), primary role, secondary roles, and force-password-change flags. |
| **15** | `Session` | `id` (UUID PK) | High-security session tracking table with encrypted `session_token`, client IP, user agent, and TTL expiration. |
| **16** | `AuditLog` | `id` (UUID PK) | Cryptographically auditable trail of administrative events (`LOGIN`, `PASSWORD_CHANGED`, `ROLE_PERMISSIONS_UPDATED`, etc.). |
| **17** | `RoleModulePermission` | `id` (UUID PK) | Dynamic database-backed permission matrix defining `can_read`, `can_write`, and `is_enabled` per role and module. |

---

## 3. Seed Accounts & Default RBAC Matrix

The system includes pre-configured administrative and operational users across all core ERP roles.

### Default Seed Credentials

> [!IMPORTANT]
> Change all default seed passwords immediately after deploying to a public or production environment using `/user-management` or `/change-password`.

| Role | Name | Corporate Email | Default Password | Department |
|---|---|---|---|---|
| **SUPER_ADMIN** | Super Administrator | `superadmin@energyoilfield.com` | `SuperAdmin@2026!` | IT & Enterprise Security |
| **ADMIN** | Vikram Joshi | `admin@energyoilfield.com` | `EotErp@2026!` | IT Administration |
| **MD** | Rajesh Mehra | `md@energyoilfield.com` | `EotErp@2026!` | Executive Board |
| **PROCUREMENT** | Anita Sharma | `procurement@energyoilfield.com` | `EotErp@2026!` | Sourcing & Supply Chain |
| **MANUFACTURING** | Sunil Rao | `manufacturing@energyoilfield.com` | `EotErp@2026!` | Plant Operations |
| **SALES** | Priya Verma | `sales@energyoilfield.com` | `EotErp@2026!` | Commercial & Sales |
| **INVENTORY** | Karan Patel | `inventory@energyoilfield.com` | `EotErp@2026!` | Weighbridge & Yard |
| **QUALITY** | Marcus Vance | `quality@energyoilfield.com` | `EotErp@2026!` | Quality Assurance & NDT |

### Module Permissions Matrix

| ERP Module | Route Path | Full Access (Read/Write) | Read-Only Access | Disabled / Hidden |
|---|---|---|---|---|
| **Dashboard Overview** | `/` | All Roles | - | - |
| **Master Data** | `/master-data` | `SUPER_ADMIN`, `ADMIN`, `PROCUREMENT`, `MANUFACTURING`, `QUALITY` | `MD` | `SALES`, `INVENTORY` |
| **Procurement (PO)** | `/procurement` | `SUPER_ADMIN`, `ADMIN`, `PROCUREMENT` | `MD` | `MANUFACTURING`, `SALES`, `INVENTORY`, `QUALITY` |
| **Receiving & Tally** | `/receiving` | `SUPER_ADMIN`, `ADMIN`, `INVENTORY` | `MD` | `PROCUREMENT`, `MANUFACTURING`, `SALES`, `QUALITY` |
| **Customer Orders** | `/customer-orders` | `SUPER_ADMIN`, `ADMIN`, `SALES` | `MD` | `PROCUREMENT`, `MANUFACTURING`, `INVENTORY`, `QUALITY` |
| **Shop Floor (WO)** | `/shop-floor` | `SUPER_ADMIN`, `ADMIN`, `MANUFACTURING` | `MD` | `PROCUREMENT`, `SALES`, `INVENTORY`, `QUALITY` |
| **Quality & NDT** | `/quality` | `SUPER_ADMIN`, `ADMIN`, `QUALITY` | `MD` | `PROCUREMENT`, `MANUFACTURING`, `SALES`, `INVENTORY` |
| **Traceability Explorer** | `/traceability` | All Roles (Read-Only) | All Roles | - |
| **User Management** | `/user-management` | `SUPER_ADMIN`, `ADMIN` | - | All Other Roles |
| **Role Permissions** | `/api/admin/role-permissions` | `SUPER_ADMIN` | `ADMIN` | All Other Roles |

---

## 4. Local Development Quickstart

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v14+ (Local instance, Docker, or remote AWS RDS)

### Step-by-Step Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-org/tube-pipe-erp.git
   cd tube-pipe-erp
   ```

2. **Install Dependencies**:
   ```bash
   npm ci
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your local or cloud PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pipe_erp?schema=public"
   SESSION_SECRET="your-development-session-secret-at-least-32-chars-long"
   NODE_ENV="development"
   PORT=3000
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Initialize Database & Apply Migrations**:
   ```bash
   # Generate Prisma TypeScript Client
   npx prisma generate

   # Apply migrations to PostgreSQL
   npx prisma migrate deploy

   # Or push schema directly for rapid prototyping
   npx prisma db push
   ```

5. **Seed Administrative Users & Initial Catalog**:
   ```bash
   # Seed authentication users and default roles
   node scripts/seed-auth.mjs

   # Seed default role-to-module permission allocations
   node scripts/seed-role-permissions.mjs

   # Seed initial supplier, product catalog, and work orders (optional)
   node prisma/seed.js
   ```

6. **Launch Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. PostgreSQL & AWS RDS Migration Guide

### 1. Provision AWS RDS PostgreSQL Instance

1. In the **AWS Management Console**, navigate to **Amazon RDS** > **Databases** > **Create database**.
2. Select:
   - **Database engine**: `PostgreSQL` (Version `16.x` or latest `15.x`)
   - **Template**: `Production` (Multi-AZ) or `Dev/Test` (Single-AZ)
   - **DB instance identifier**: `erp-postgres-primary`
   - **Master username**: `dbadmin`
   - **Master password**: Use a strong generated password (e.g. 32 characters)
   - **Instance class**: `db.t4g.medium` or higher
   - **Storage**: Minimum 20 GiB gp3 with storage autoscaling enabled
   - **Connectivity**: Associate with your VPC private application subnets.
   - **Security Group**: Allow inbound TCP port `5432` from your application servers / App Runner / ECS security group.
   - **Encryption**: Enable storage encryption with AWS KMS.

### 2. Configure Production Connection String

In AWS Secrets Manager or your deployment environment variables, configure:

```env
DATABASE_URL="postgresql://dbadmin:<PASSWORD>@erp-postgres-primary.c9xxxxxx.us-east-1.rds.amazonaws.com:5432/pipe_erp?schema=public&sslmode=require"
```

> [!TIP]
> The `&sslmode=require` query parameter guarantees all traffic between Next.js and Amazon RDS is encrypted using TLS in transit.

### 3. Apply Production Migrations

From your local machine or during CI/CD execution:

```bash
# Apply all tracked migrations to the RDS instance
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Seed baseline credentials and role permissions
DATABASE_URL="postgresql://..." node scripts/seed-auth.mjs
DATABASE_URL="postgresql://..." node scripts/seed-role-permissions.mjs
```

---

## 6. AWS Production Deployment Blueprints

### Blueprint A: AWS App Runner (Recommended — Fully Managed Serverless)

AWS App Runner provides containerized auto-scaling with zero infrastructure maintenance.

1. **Push Container to Amazon ECR**:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com
   docker build -t tube-pipe-erp .
   docker tag tube-pipe-erp:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/tube-pipe-erp:latest
   docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/tube-pipe-erp:latest
   ```

2. **Create App Runner Service**:
   - Source: Amazon ECR image `<account_id>.dkr.ecr.us-east-1.amazonaws.com/tube-pipe-erp:latest`.
   - Port: `3000`.
   - Environment Variables:
     - `DATABASE_URL`: Stored in AWS Secrets Manager or configured directly with `sslmode=require`.
     - `SESSION_SECRET`: 64-character cryptographic key.
     - `NODE_ENV`: `production`.
     - `NEXT_PUBLIC_APP_URL`: Your custom domain (e.g. `https://erp.energyoilfield.com`).
   - VPC Connector: Attach an **App Runner VPC Connector** to route internal traffic directly to the private RDS subnets without exposing the database to the public internet.

---

### Blueprint B: AWS ECS Fargate + Application Load Balancer (Enterprise High-Scale)

For enterprises requiring strict multi-AZ compliance, AWS WAF, and private VPC clustering:

1. **ECS Cluster**: Create an AWS ECS cluster using AWS Fargate (serverless compute).
2. **Task Definition**:
   - Container Image: ECR URI
   - Memory: 2 GB, CPU: 1 vCPU
   - Port Mapping: `3000`
   - Secrets: Pull `DATABASE_URL` and `SESSION_SECRET` directly from **AWS Secrets Manager** using IAM execution role ARN.
3. **Application Load Balancer (ALB)**:
   - HTTPS Listener on port 443 with AWS Certificate Manager (ACM) SSL certificate.
   - Health check path: `/login` (Status code `200`).
   - Forwarding to ECS Target Group on port 3000.

---

### Blueprint C: AWS Amplify Hosting (Continuous GitHub Integration)

1. Connect your GitHub repository to **AWS Amplify Console**.
2. Select branch `main`.
3. Use the following build settings in `amplify.yml`:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
           - npx prisma generate
           - npx prisma migrate deploy
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - .next/cache/**/*
         - node_modules/**/*
   ```
4. Set Environment Variables under **App settings > Environment variables**:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `NODE_ENV = production`

---

## 7. GitHub Actions CI/CD Pipeline

The `.github/workflows/deploy.yml` pipeline automates continuous integration and production verification:

```mermaid
flowchart LR
    A["Push / PR to main"] --> B["npm ci"]
    B --> C["prisma generate"]
    C --> D["tsc --noEmit"]
    D --> E["Test Suite (Routes & RBAC)"]
    E --> F["next build (44 Static & Dynamic Pages)"]
    F --> G["prisma migrate deploy (AWS RDS)"]
    G --> H["AWS Deployment Trigger"]
```

### GitHub Repository Secrets Required

To enable automatic AWS migrations and deployment from GitHub Actions, configure the following secrets under **Settings > Secrets and variables > Actions**:

| Secret Key | Description | Example |
|---|---|---|
| `DATABASE_URL` | Production PostgreSQL RDS connection string | `postgresql://user:pass@host:5432/pipe_erp?sslmode=require` |
| `SESSION_SECRET` | 64-char production encryption key | `a1b2c3d4e5f6...` |
| `AWS_ACCESS_KEY_ID` | IAM deployment user access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM deployment user secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Target AWS datacenter region | `us-east-1` |

---

## 8. Test Suites & Verification

Run the automated test and validation scripts locally:

```powershell
# 1. Verify all 45 ERP Route Handlers and Endpoints
node scripts/verify-all-urls.mjs

# 2. End-to-End Role-Based Access Control (RBAC) & Middleware Tests
node scripts/test-e2e-rbac.mjs

# 3. Dynamic Role-to-Module Mapping Customization Verification
node scripts/test-role-module-customization.mjs

# 4. Interactive Password Visibility Toggle & Complexity Validation
node scripts/test-password-input.mjs

# 5. PO Plain-End Mother Pipe Workflow (Thread Type Removal Verification)
node scripts/test-po-thread-removal.mjs

# 6. Cutting Yield & Relational Traversal Gate Equations
node scripts/verify-business-logic.js
```

---

## 9. License & Support

Copyright &copy; 2026 Energy Oilfield Technologies (EOT Couplings). All rights reserved.  
Confidential and proprietary industrial enterprise software.
