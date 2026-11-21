# FD Connect --- Fixed Deposit Marketplace

## Complete Project Requirements, System Design, Architecture & Development Guide

**Project type:** Full-stack fintech marketplace\
**Technology:** MERN (MongoDB, Express.js, React.js, Node.js)\
**Primary market:** India\
**Document purpose:** Single source of truth for requirements,
workflows, database design, APIs, security, implementation and testing.

> **Important scope boundary:** FD Connect is initially a comparison,
> discovery and lead-generation platform. It must not accept, pool, hold
> or transfer users' FD principal money. Actual deposit booking and
> payment must happen through an authorised bank's own
> onboarding/payment flow or a formally approved bank integration.
> Before a real-money launch, obtain legal, regulatory, security and
> partner-bank review. This document is a software design specification,
> not legal or financial advice.

------------------------------------------------------------------------

# 1. Project Overview

FD Connect allows users to discover, compare and explore fixed deposit
(FD) products offered by multiple banks. Users can filter schemes,
calculate estimated maturity values, save plans, view bank-sponsored
promotions and initiate an application journey.

Banks can maintain their profiles and FD product information, subject to
platform verification and approval. Banks can also purchase advertising
campaigns to promote their products. Administrators control platform
operations, verify banks, moderate FD plans and advertisements, and
monitor activity.

## 1.1 Problem Statement

People often need to visit multiple bank websites to compare FD rates,
tenure, payout options, eligibility and special conditions. Information
may be presented differently across banks, making comparisons difficult.

FD Connect provides a central place to: - Discover FD products from
participating banks. - Compare rates and product terms. - Estimate
maturity values. - Identify sponsored listings clearly. - Start a bank
application journey. - Let participating banks promote their products
transparently.

## 1.2 Project Objectives

1.  Build a responsive web application for desktop, tablet and mobile.
2.  Provide secure email/password and Google sign-in.
3.  Support three roles: User, Bank and Admin.
4.  Maintain verified bank profiles and FD products.
5.  Provide search, filters, sorting and comparison.
6.  Provide an FD calculator using scheme-specific rules.
7.  Allow users to save schemes and track enquiries/applications.
8.  Allow banks to create paid advertisement campaigns.
9.  Provide campaign analytics such as impressions and clicks.
10. Provide administrative review, approval and audit capabilities.

## 1.3 Out of Scope for Initial MVP

-   Holding customer deposits or operating a wallet.
-   Directly transferring FD principal to banks.
-   Claiming to open an FD without bank confirmation.
-   Storing raw card, net-banking or UPI credentials.
-   Acting as a bank, deposit-taking entity or investment adviser.
-   Guaranteeing returns or insurance coverage.
-   Automated bank integrations before formal agreements and technical
    access exist.

------------------------------------------------------------------------

# 2. Users, Roles and Permissions

## 2.1 User

A customer who visits the platform to research FD products.

Capabilities: - Register and sign in. - Continue with Google. - Manage
profile and consent preferences. - Browse banks and FD plans. - Search,
filter, sort and compare FD plans. - Use the maturity calculator. - Save
and remove favourite plans. - Submit an enquiry or initiate a bank
application handoff. - Track enquiry/application status. - View
notifications and relevant disclosures. - Report incorrect product
information.

## 2.2 Bank

A verified bank organisation represented by authorised bank users.

Capabilities: - Submit bank registration details. - View verification
status. - Manage bank profile, subject to review. - Create and update FD
plans. - Submit FD plans for approval. - Create advertisement
campaigns. - Upload promotional creatives. - Pay for platform
advertising through an approved payment provider. - View campaign
analytics. - View permitted enquiries/leads, only with user consent and
appropriate agreements.

A bank user must only access records belonging to their own bank. A role
check alone is not sufficient; every bank resource must be checked
against the authenticated user's `bankId`.

## 2.3 Admin

Platform operator with privileged access.

Capabilities: - View platform dashboard and reports. - Review and
approve/reject bank registrations. - Manage bank accounts and status. -
Review and approve/reject FD plans. - Review and approve/reject
advertisements. - Manage campaign inventory and pricing. - View
applications/enquiries and operational status. - Manage users and bank
users. - Handle complaints and reported data. - View audit logs. -
Suspend campaigns, plans or accounts when required.

Use least-privilege access. Consider separate admin permissions such as
`super_admin`, `operations_admin` and `ad_moderator` as the platform
grows.

------------------------------------------------------------------------

# 3. Functional Requirements

## 3.1 Authentication and Account Management

-   Email/password registration.
-   Email/password login.
-   Google sign-in.
-   Logout and session invalidation.
-   Forgot password and secure reset flow.
-   Email verification.
-   Optional phone verification.
-   Profile view and update.
-   Role-based route and API protection.
-   Account deactivation/deletion request workflow.
-   Login and security event logging.

Rules: - Public registration always creates a `user` account. - Users
cannot assign themselves `admin` or `bank` roles. - Bank access is
granted only after admin approval and association with a bank. - Google
ID tokens must be verified by the backend using Google's supported
verification library. - Never trust user profile, role, bank ID or token
claims sent without server-side verification.

## 3.2 Bank Directory

-   List approved and active banks.
-   View bank details, logo, website and customer-care information.
-   Filter by bank category/type.
-   Search by bank name.
-   Display verification status and relevant disclosures.
-   Admin can approve, reject, suspend or deactivate a bank.

## 3.3 FD Plan Management

Each bank can have multiple FD plans.

Required information may include: - Plan name and description. - Minimum
and maximum deposit amount. - Minimum and maximum tenure. - Standard
interest rate. - Senior-citizen rate, where applicable. - Interest
payout options. - Compounding frequency, if applicable. - Premature
withdrawal availability and penalty. - Tax-saving eligibility, if
applicable. - Effective start and end dates. - Source URL/document and
last-verified date. - Product terms and disclosures. - Status: draft,
pending review, approved, rejected, inactive, expired.

All rates and terms must be traceable to a bank-provided or otherwise
authorised source. Display the date on which information was last
verified. Do not fabricate rates.

## 3.4 Search, Filter and Comparison

Users can: - Search banks and FD plan names. - Filter by deposit amount,
tenure, interest rate, bank type and payout type. - Sort by interest
rate, tenure, bank name or maturity estimate. - Compare a small number
of schemes side by side. - Distinguish sponsored placements from organic
results. - Open the source/terms for each scheme.

Sponsored status must not silently alter organic ranking.

## 3.5 FD Calculator

Inputs: - Principal/deposit amount. - Tenure, represented in days or
months as supported by the plan. - Applicable interest rate. -
Compounding/payout method. - Customer category, such as standard or
senior citizen, if eligible.

Outputs: - Estimated interest. - Estimated maturity amount. -
Calculation assumptions. - Applicable scheme and rate snapshot. - A
disclaimer that the bank's final calculation controls.

For a simple compound-interest illustration:

`A = P × (1 + r/n)^(n×t)`

Where: - `P` = principal. - `r` = annual nominal interest rate as a
decimal. - `n` = compounding periods per year. - `t` = time in years. -
`A` = estimated maturity amount.

This formula is not suitable for every FD. Actual bank calculations may
use daily balances, day-count conventions, quarterly compounding, payout
options, tax deductions and bank-specific rounding. Implement
calculation strategies per product rules and validate them against
bank-published examples. Do not treat the illustrative formula as a
guaranteed quote.

## 3.6 Favourites

-   Add an FD plan to favourites.
-   Remove a favourite.
-   List saved plans.
-   Prevent duplicate favourite records for the same user and plan.

## 3.7 Enquiry / Application Journey

MVP journey: - User selects a plan. - User enters amount and relevant
basic details. - Platform displays the bank's terms and privacy
notice. - User explicitly consents to share selected details with the
bank, where applicable. - Platform creates an enquiry/application
initiation record. - User is redirected to the official bank website or
approved partner journey. - Bank completes KYC, eligibility checks,
payment and booking. - Platform status is updated only from a trusted
bank confirmation or authorised operations process.

Do not show `booked` merely because a user clicked a link. Use distinct
statuses such as `initiated`, `redirected`, `submitted_to_bank`,
`bank_processing`, `booked`, `rejected`, `cancelled`, `expired`, and
`unknown`.

## 3.8 Advertisements and Campaigns

Banks may purchase: - Homepage banner placements. - Featured FD
placements. - Sponsored search/list placements. - Sidebar placements.

Campaign requirements: - Campaign name and objective. - Bank and
optional FD plan. - Placement and creative. - Start/end date. - Budget
and pricing model. - Approval status. - Payment status. - Impression and
click counters. - Spend and performance reporting.

Pricing models may include: - Fixed-fee placement. - CPC (cost per
click). - CPM (cost per thousand impressions).

Campaign billing and delivery must be controlled by server-side rules.
Prevent duplicate click billing, fraudulent impression inflation and
unauthorised campaign changes. Display a clear `Sponsored` or
`Advertisement` label.

## 3.9 Notifications

-   Application/enquiry status updates.
-   Bank or FD plan approval/rejection notifications.
-   Campaign approval and expiry notifications.
-   Account/security notifications.
-   Maturity reminders only if a real FD has been verified and the user
    has opted in.

Channels may include in-app notifications and email. SMS/WhatsApp should
be added only with consent and provider/compliance review.

## 3.10 Admin Dashboard and Reporting

Suggested metrics: - Registered users. - Active and pending banks. -
Active FD plans. - Pending plan approvals. - Active and pending
campaigns. - Total ad impressions and clicks. - Enquiries initiated and
bank-confirmed bookings, where verified. - Campaign revenue and
outstanding payments.

Clearly distinguish estimated, reported and bank-confirmed metrics.

------------------------------------------------------------------------

# 4. Non-Functional Requirements

## 4.1 Security

-   HTTPS in all deployed environments.
-   Secure password hashing with bcrypt or Argon2.
-   HttpOnly, Secure, SameSite cookies for refresh/session tokens where
    appropriate.
-   Short-lived access tokens and rotation/revocation strategy.
-   CSRF protection when cookie-based authentication is used.
-   Rate limiting on login, registration, password reset and sensitive
    APIs.
-   Input validation and output encoding.
-   Protection against NoSQL injection, XSS, CSRF and IDOR.
-   Secrets stored in environment/secret manager, never committed.
-   Restrict upload file types, size and content.
-   Audit privileged actions.
-   Avoid storing unnecessary personal or KYC data.
-   Do not log passwords, access tokens, full identity numbers or
    payment credentials.

## 4.2 Performance

-   Pagination for list endpoints.
-   Index common search/filter fields.
-   Use projections to return only required fields.
-   Avoid unbounded population and large documents.
-   Cache public bank/FD catalogue data where suitable.
-   Use aggregation pipelines for analytics.
-   Add monitoring for slow queries and API latency.

## 4.3 Reliability and Maintainability

-   Centralised error handling.
-   Structured application logs.
-   Health-check endpoint.
-   Automated tests.
-   Database backups and restore procedures.
-   API versioning.
-   Environment separation: development, staging and production.
-   Clear README and API documentation.

## 4.4 Accessibility and Responsiveness

-   Mobile-first responsive layout.
-   Keyboard navigation.
-   Labels and accessible form errors.
-   Adequate contrast and readable typography.
-   Responsive tables/cards for bank comparisons.
-   Avoid colour-only status indicators.

------------------------------------------------------------------------

# 5. System Architecture

Use a **modular monolith** for the first release. It is simpler to
develop and deploy than microservices, while keeping modules separated
so they can evolve later.

## 5.1 High-Level Architecture

``` mermaid
flowchart TB
    USER[User Browser / Mobile Browser]
    BANK[Bank Staff Browser]
    ADMIN[Admin Browser]

    USER --> WEB[React Web Application]
    BANK --> WEB
    ADMIN --> WEB

    WEB --> API[HTTPS REST API - Express.js]

    API --> AUTH[Authentication and RBAC]
    API --> USERMOD[User/Profile Module]
    API --> BANKMOD[Bank Module]
    API --> FDMOD[FD Catalogue and Calculator]
    API --> COMP[Search and Comparison]
    API --> APP[Enquiry/Application Module]
    API --> ADS[Advertisement/Campaign Module]
    API --> NOTIFY[Notification Module]
    API --> REPORT[Admin/Bank Reporting]

    AUTH --> GOOGLE[Google Identity Services]
    AUTH --> DB[(MongoDB Atlas)]
    USERMOD --> DB
    BANKMOD --> DB
    FDMOD --> DB
    COMP --> DB
    APP --> DB
    ADS --> DB
    NOTIFY --> DB
    REPORT --> DB

    API --> MEDIA[Cloudinary or Object Storage]
    API --> EMAIL[Email Provider]
    ADS --> PAY[Approved Payment Gateway]
    APP --> PARTNER[Official Bank Website / Approved Bank API]
```

## 5.2 Backend Module Boundaries

-   `auth`: registration, login, Google verification, sessions.
-   `users`: profile, preferences and consent.
-   `banks`: bank directory and bank-user association.
-   `fdPlans`: FD plan lifecycle and approval.
-   `calculator`: product-specific maturity estimates.
-   `search`: filtering, sorting and comparison.
-   `applications`: enquiries, redirect and bank status.
-   `advertisements`: creatives, placements and delivery.
-   `campaigns`: budgets, pricing and scheduling.
-   `payments`: advertising invoices/payment transactions.
-   `notifications`: in-app/email notifications.
-   `admin`: moderation and dashboard operations.
-   `audit`: privileged action records.

## 5.3 Recommended Technology

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  Frontend                            React.js + Vite

  Styling                             Tailwind CSS

  Routing                             React Router

  Server state                        TanStack Query

  Forms                               React Hook Form + Zod

  Backend                             Node.js + Express.js

  Database                            MongoDB Atlas

  ODM                                 Mongoose

  Authentication                      Secure session/JWT strategy +
                                      Google Identity Services

  Validation                          Zod or express-validator

  Password hashing                    bcrypt

  File storage                        Cloudinary or S3-compatible object
                                      storage

  Email                               Approved transactional email
                                      provider

  Charts                              Recharts

  API testing                         Postman

  Unit/integration testing            Vitest/Jest + Supertest

  Deployment                          Vercel frontend; Render/Railway/AWS
                                      backend

  CI                                  GitHub Actions
  -----------------------------------------------------------------------

Pin supported dependency versions and update them regularly.

------------------------------------------------------------------------

# 6. Database Design --- MongoDB Collections

Use MongoDB references for relationships. Add indexes and validate
ownership in application logic. MongoDB references are not SQL
foreign-key constraints.

## 6.1 `users`

Purpose: all platform identities, including customers, admins and bank
staff.

``` javascript
{
  _id: ObjectId,
  fullName: String,
  email: String,              // normalized lowercase
  phone: String,
  passwordHash: String,       // absent for Google-only accounts if appropriate
  googleId: String,
  authProvider: ["local", "google"],
  role: ["user", "bank", "admin"],
  bankId: ObjectId,           // nullable; required for bank role
  profileImage: String,
  emailVerifiedAt: Date,
  phoneVerifiedAt: Date,
  isActive: Boolean,
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes: - Unique index on normalized `email`. - Sparse unique index on
`googleId`. - Index on `{ role, isActive }`. - Index on `bankId`.

Security: - Never return `passwordHash`. - Role changes must be
privileged admin operations. - A bank user must have an approved bank
association.

## 6.2 `banks`

``` javascript
{
  _id: ObjectId,
  bankName: String,
  bankCode: String,
  bankType: ["public", "private", "small_finance", "cooperative", "other"],
  logoUrl: String,
  description: String,
  officialWebsite: String,
  customerCare: String,
  headquarters: String,
  verificationStatus: ["pending", "approved", "rejected", "suspended"],
  verificationNotes: String,
  verifiedAt: Date,
  verifiedBy: ObjectId,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes: - Unique index on `bankCode`. - Text/search index on
`bankName`. - Index on `{ verificationStatus, isActive }`.

Only show approved, active banks in the public directory.

Do not use a simple unverified `isDICGCInsured` boolean as a substitute
for checking current coverage. If displaying insurance information,
store its source, verification date and applicable caveats.

## 6.3 `fdPlans`

``` javascript
{
  _id: ObjectId,
  bankId: ObjectId,
  planName: String,
  description: String,

  minAmount: Decimal128,
  maxAmount: Decimal128,

  minTenureDays: Number,
  maxTenureDays: Number,

  standardInterestRate: Number,
  seniorCitizenInterestRate: Number,

  interestPayout: ["monthly", "quarterly", "half_yearly", "yearly", "maturity"],
  compoundingFrequency: ["monthly", "quarterly", "half_yearly", "yearly", "none"],
  calculationMethod: String,

  prematureWithdrawalAllowed: Boolean,
  prematureWithdrawalPenaltyDescription: String,

  taxSavingEligible: Boolean,
  eligibilityDescription: String,
  termsUrl: String,

  sourceUrl: String,
  sourceDocumentUrl: String,
  lastVerifiedAt: Date,
  effectiveFrom: Date,
  effectiveUntil: Date,

  status: ["draft", "pending_review", "approved", "rejected", "inactive", "expired"],
  submittedBy: ObjectId,
  reviewedBy: ObjectId,
  reviewedAt: Date,
  reviewNotes: String,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes: - `{ bankId: 1, status: 1 }` -
`{ status: 1, effectiveFrom: 1, effectiveUntil: 1 }` -
`{ standardInterestRate: -1 }` - Indexes for common amount/tenure
filters.

Use `Decimal128` or integer minor units for money, not binary
floating-point. Define rate precision and rounding policy. Validate that
min amount \<= max amount and min tenure \<= max tenure.

## 6.4 `applications`

This collection represents an enquiry or bank handoff unless a trusted
bank integration confirms an actual booking.

``` javascript
{
  _id: ObjectId,
  referenceCode: String,

  userId: ObjectId,
  bankId: ObjectId,
  fdPlanId: ObjectId,

  depositAmount: Decimal128,
  tenureDays: Number,
  customerCategory: ["standard", "senior_citizen"],

  rateSnapshot: Number,
  planNameSnapshot: String,
  termsSnapshot: Object,

  estimatedInterest: Decimal128,
  estimatedMaturityAmount: Decimal128,
  calculationDisclaimerVersion: String,

  consent: {
    dataSharingAccepted: Boolean,
    acceptedAt: Date,
    noticeVersion: String
  },

  status: [
    "initiated",
    "redirected",
    "submitted_to_bank",
    "bank_processing",
    "booked",
    "rejected",
    "cancelled",
    "expired",
    "unknown"
  ],

  bankReferenceId: String,
  officialBankRedirectUrl: String,
  bankConfirmedAt: Date,
  statusUpdatedAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes: - Unique index on `referenceCode`. -
`{ userId: 1, createdAt: -1 }` -
`{ bankId: 1, status: 1, createdAt: -1 }` -
`{ fdPlanId: 1, createdAt: -1 }`

Do not store bank login credentials or payment credentials. Avoid
storing full FD account numbers unless necessary, contractually
authorised and appropriately protected.

## 6.5 `advertisements`

``` javascript
{
  _id: ObjectId,
  bankId: ObjectId,
  fdPlanId: ObjectId,

  title: String,
  description: String,
  bannerImageUrl: String,
  destinationUrl: String,

  placement: [
    "homepage_banner",
    "featured_fd",
    "sponsored_search",
    "sidebar"
  ],

  startAt: Date,
  endAt: Date,

  status: [
    "draft",
    "pending_review",
    "approved",
    "rejected",
    "scheduled",
    "active",
    "paused",
    "expired"
  ],

  reviewedBy: ObjectId,
  reviewedAt: Date,
  rejectionReason: String,

  impressionCount: Number,
  clickCount: Number,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes: - `{ status: 1, startAt: 1, endAt: 1 }` -
`{ bankId: 1, createdAt: -1 }` - `{ placement: 1, status: 1 }`

For high traffic, store event-level impressions/clicks in a separate
analytics/event collection and aggregate counts rather than relying only
on mutable counters.

## 6.6 `adCampaigns`

``` javascript
{
  _id: ObjectId,
  bankId: ObjectId,
  campaignName: String,
  campaignType: ["fixed_fee", "cpc", "cpm"],
  totalBudget: Decimal128,
  spentAmount: Decimal128,
  currency: "INR",
  startAt: Date,
  endAt: Date,
  status: ["draft", "pending_payment", "pending_review", "active", "paused", "completed", "cancelled"],
  createdAt: Date,
  updatedAt: Date
}
```

## 6.7 `payments`

For advertising fees only in the MVP.

``` javascript
{
  _id: ObjectId,
  bankId: ObjectId,
  campaignId: ObjectId,
  amount: Decimal128,
  currency: "INR",
  gateway: String,
  gatewayOrderId: String,
  gatewayPaymentId: String,
  status: ["created", "pending", "success", "failed", "refunded"],
  verifiedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Verify payment status from signed server-to-server gateway webhooks.
Never trust a frontend success redirect alone.

## 6.8 `favorites`

``` javascript
{
  _id: ObjectId,
  userId: ObjectId,
  fdPlanId: ObjectId,
  createdAt: Date
}
```

Unique compound index: `{ userId: 1, fdPlanId: 1 }`.

## 6.9 `notifications`

``` javascript
{
  _id: ObjectId,
  userId: ObjectId,
  title: String,
  message: String,
  type: String,
  relatedEntityType: String,
  relatedEntityId: ObjectId,
  isRead: Boolean,
  createdAt: Date
}
```

Index: `{ userId: 1, isRead: 1, createdAt: -1 }`.

## 6.10 `auditLogs`

``` javascript
{
  _id: ObjectId,
  performedBy: ObjectId,
  action: String,
  entityType: String,
  entityId: ObjectId,
  oldData: Object,
  newData: Object,
  ipAddress: String,
  createdAt: Date
}
```

Use a restricted schema for audit snapshots. Exclude credentials,
secrets and unnecessary personal data. Consider append-only permissions
and retention rules.

## 6.11 Optional `adEvents`

For detailed campaign analytics:

``` javascript
{
  _id: ObjectId,
  advertisementId: ObjectId,
  campaignId: ObjectId,
  bankId: ObjectId,
  eventType: ["impression", "click"],
  occurredAt: Date,
  anonymousSessionId: String,
  placement: String
}
```

Apply bot filtering, deduplication, privacy controls and retention
limits.

------------------------------------------------------------------------

# 7. Entity Relationship Diagram

``` mermaid
erDiagram
    USERS ||--o{ APPLICATIONS : initiates
    BANKS ||--o{ FDPLANS : offers
    BANKS ||--o{ APPLICATIONS : receives
    FDPLANS ||--o{ APPLICATIONS : selected_for

    BANKS ||--o{ ADVERTISEMENTS : owns
    FDPLANS o|--o{ ADVERTISEMENTS : promotes
    BANKS ||--o{ ADCAMPAIGNS : purchases
    ADCAMPAIGNS ||--o{ PAYMENTS : has

    USERS ||--o{ FAVORITES : saves
    FDPLANS ||--o{ FAVORITES : saved_in

    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDITLOGS : performs
    ADVERTISEMENTS ||--o{ ADEVENTS : records

    USERS {
      ObjectId _id PK
      string email
      string role
      ObjectId bankId FK
    }
    BANKS {
      ObjectId _id PK
      string bankName
      string verificationStatus
    }
    FDPLANS {
      ObjectId _id PK
      ObjectId bankId FK
      number standardInterestRate
      string status
    }
    APPLICATIONS {
      ObjectId _id PK
      ObjectId userId FK
      ObjectId bankId FK
      ObjectId fdPlanId FK
      string status
    }
    ADVERTISEMENTS {
      ObjectId _id PK
      ObjectId bankId FK
      ObjectId fdPlanId FK
      string status
    }
    ADCAMPAIGNS {
      ObjectId _id PK
      ObjectId bankId FK
      string campaignType
    }
    PAYMENTS {
      ObjectId _id PK
      ObjectId campaignId FK
      number amount
      string status
    }
    FAVORITES {
      ObjectId _id PK
      ObjectId userId FK
      ObjectId fdPlanId FK
    }
    NOTIFICATIONS {
      ObjectId _id PK
      ObjectId userId FK
      string message
    }
    AUDITLOGS {
      ObjectId _id PK
      ObjectId performedBy FK
      string action
    }
    ADEVENTS {
      ObjectId _id PK
      ObjectId advertisementId FK
      string eventType
    }
```

Relationship summary: - One bank offers many FD plans. - One bank has
many authorised bank users. - One user can create many
enquiries/applications. - One FD plan can be selected in many
applications. - One bank can create many advertisements and campaigns. -
One campaign can have many payment attempts/transactions. - One user can
save many FD plans. - One user can receive many notifications. - One
advertisement can generate many analytics events.

------------------------------------------------------------------------

# 8. Application Workflows

## 8.1 User Registration and Login

``` mermaid
flowchart TD
    A[Open FD Connect] --> B{Choose sign-in method}
    B -->|Email| C[Enter name, email and password]
    B -->|Google| D[Google sign-in]
    C --> E[Validate and hash password]
    D --> F[Backend verifies Google ID token]
    E --> G[Create or identify user]
    F --> G
    G --> H{Account active?}
    H -->|No| I[Show account status]
    H -->|Yes| J[Create secure session]
    J --> K[User dashboard]
```

## 8.2 Bank Onboarding

``` mermaid
flowchart TD
    A[Bank representative requests access] --> B[Submit organisation details]
    B --> C[Admin reviews documents/details]
    C --> D{Approved?}
    D -->|No| E[Reject with reason]
    D -->|Yes| F[Create/activate bank association]
    F --> G[Bank dashboard access]
    G --> H[Create FD plan]
    H --> I[Submit for review]
    I --> J[Admin approves plan]
    J --> K[Public FD catalogue]
```

## 8.3 User FD Discovery and Enquiry

``` mermaid
flowchart TD
    A[User dashboard] --> B[Browse banks or FD plans]
    B --> C[Search and filter]
    C --> D[Open FD plan]
    D --> E[Review rate, tenure and terms]
    E --> F[Enter deposit and tenure]
    F --> G[Calculate estimate]
    G --> H[Accept disclosure and consent]
    H --> I[Create enquiry/application record]
    I --> J[Redirect to official bank journey]
    J --> K[Bank handles KYC and payment]
    K --> L[Bank confirms status]
    L --> M[Update platform status]
```

## 8.4 Advertisement Approval

``` mermaid
flowchart TD
    A[Bank creates campaign] --> B[Upload creative and choose placement]
    B --> C[Select budget and dates]
    C --> D[Complete advertising payment]
    D --> E[Submit for moderation]
    E --> F{Admin approves?}
    F -->|No| G[Rejected with reason]
    F -->|Yes| H[Schedule campaign]
    H --> I[Campaign becomes active in date window]
    I --> J[Record impressions and clicks]
    J --> K[Bank views analytics]
    K --> L[Campaign expires or budget ends]
```

## 8.5 Application Status Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> initiated
    initiated --> redirected
    redirected --> submitted_to_bank
    submitted_to_bank --> bank_processing
    bank_processing --> booked
    bank_processing --> rejected
    initiated --> cancelled
    redirected --> cancelled
    submitted_to_bank --> unknown
    unknown --> bank_processing
    unknown --> booked
    unknown --> rejected
    booked --> [*]
    rejected --> [*]
    cancelled --> [*]
```

Only a trusted bank callback, partner API response or verified
operational process can set `booked`.

------------------------------------------------------------------------

# 9. API Design

Base URL: `/api/v1`

Use consistent JSON responses, validation errors, HTTP status codes,
pagination and request IDs.

## 9.1 Authentication

  Method   Endpoint                  Access          Purpose
  -------- ------------------------- --------------- ----------------------
  POST     `/auth/register`          Public          Register user
  POST     `/auth/login`             Public          Email login
  POST     `/auth/google`            Public          Verify Google token
  POST     `/auth/logout`            Authenticated   End session
  POST     `/auth/refresh`           Session         Rotate session/token
  POST     `/auth/forgot-password`   Public          Start reset
  POST     `/auth/reset-password`    Public          Complete reset
  GET      `/auth/me`                Authenticated   Current user

## 9.2 Users

  Method   Endpoint           Access
  -------- ------------------ --------
  GET      `/users/profile`   User
  PATCH    `/users/profile`   User
  DELETE   `/users/account`   User

## 9.3 Banks

  Method   Endpoint                        Access
  -------- ------------------------------- -----------------------
  GET      `/banks`                        Public
  GET      `/banks/:bankId`                Public
  POST     `/banks`                        Admin
  PATCH    `/banks/:bankId`                Admin/authorised bank
  PATCH    `/banks/:bankId/verification`   Admin

## 9.4 FD Plans

  Method   Endpoint                     Access
  -------- ---------------------------- -------------------
  GET      `/fd-plans`                  Public
  GET      `/fd-plans/:planId`          Public
  POST     `/fd-plans`                  Bank
  PATCH    `/fd-plans/:planId`          Owning bank/Admin
  POST     `/fd-plans/:planId/submit`   Owning bank
  PATCH    `/fd-plans/:planId/review`   Admin

Example filters:
`GET /fd-plans?minAmount=10000&maxTenureDays=730&sortBy=rate&order=desc&page=1&limit=20`

## 9.5 Calculator and Comparison

  Method   Endpoint                 Access
  -------- ------------------------ --------
  POST     `/calculator/estimate`   Public
  POST     `/fd-plans/compare`      Public

Validate all plan IDs and input values server-side. Return assumptions
and a disclaimer with the result.

## 9.6 Applications

  Method   Endpoint                     Access
  -------- ---------------------------- -----------------------------
  POST     `/applications`              User
  GET      `/applications/my`           User
  GET      `/applications/:id`          Owner/Admin/authorised bank
  GET      `/bank/applications`         Bank
  PATCH    `/applications/:id/status`   Admin/approved integration

A bank must only view leads where the user has consented and the bank
owns the related application.

## 9.7 Advertisements and Campaigns

  ----------------------------------------------------------------------------------
  Method                  Endpoint                           Access
  ----------------------- ---------------------------------- -----------------------
  GET                     `/advertisements/active`           Public

  POST                    `/advertisements`                  Bank

  PATCH                   `/advertisements/:id`              Owning bank/Admin

  POST                    `/advertisements/:id/submit`       Owning bank

  PATCH                   `/advertisements/:id/review`       Admin

  POST                    `/advertisements/:id/impression`   Public, protected
                                                             against abuse

  POST                    `/advertisements/:id/click`        Public, protected
                                                             against abuse

  GET                     `/bank/campaigns`                  Bank

  POST                    `/bank/campaigns`                  Bank

  GET                     `/bank/campaigns/:id/analytics`    Owning bank
  ----------------------------------------------------------------------------------

## 9.8 Favourites and Notifications

  Method   Endpoint                    Access
  -------- --------------------------- --------
  POST     `/favorites/:planId`        User
  DELETE   `/favorites/:planId`        User
  GET      `/favorites`                User
  GET      `/notifications`            User
  PATCH    `/notifications/:id/read`   Owner

## 9.9 Dashboard

  Method   Endpoint             Access
  -------- -------------------- --------
  GET      `/dashboard/user`    User
  GET      `/dashboard/bank`    Bank
  GET      `/dashboard/admin`   Admin

------------------------------------------------------------------------

# 10. Backend Project Structure

``` text
server/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── env.js
│   │   ├── google.js
│   │   └── storage.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Bank.js
│   │   ├── FDPlan.js
│   │   ├── Application.js
│   │   ├── Advertisement.js
│   │   ├── AdCampaign.js
│   │   ├── Payment.js
│   │   ├── Favorite.js
│   │   ├── Notification.js
│   │   ├── AuditLog.js
│   │   └── AdEvent.js
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── banks/
│   │   ├── fdPlans/
│   │   ├── calculator/
│   │   ├── applications/
│   │   ├── advertisements/
│   │   ├── campaigns/
│   │   ├── payments/
│   │   ├── favorites/
│   │   ├── notifications/
│   │   └── dashboard/
│   │
│   ├── middleware/
│   │   ├── authenticate.js
│   │   ├── authorizeRole.js
│   │   ├── validate.js
│   │   ├── rateLimiter.js
│   │   ├── errorHandler.js
│   │   └── notFound.js
│   │
│   ├── utils/
│   ├── jobs/
│   ├── routes/
│   ├── app.js
│   └── server.js
│
├── tests/
├── .env.example
├── package.json
└── README.md
```

Recommended module pattern:

``` text
modules/fdPlans/
├── fdPlan.model.js
├── fdPlan.routes.js
├── fdPlan.controller.js
├── fdPlan.service.js
├── fdPlan.validation.js
└── fdPlan.test.js
```

Keep controllers thin. Put business rules in services and database
operations in model/repository functions.

# 11. Frontend Project Structure

``` text
client/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   ├── bank/
│   │   ├── fd/
│   │   ├── comparison/
│   │   └── advertisements/
│   │
│   ├── pages/
│   │   ├── public/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── bank/
│   │   └── admin/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── banks/
│   │   ├── fdPlans/
│   │   ├── applications/
│   │   └── campaigns/
│   │
│   ├── services/
│   │   └── apiClient.js
│   ├── hooks/
│   ├── context/
│   ├── routes/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
│
├── .env.example
└── package.json
```

## 11.1 Suggested Pages

Public: - Home - Bank directory - Bank details - FD listing - FD
details - FD comparison - FD calculator - About, contact, privacy policy
and terms

Authentication: - Register - Login - Forgot password - Reset password

User: - Dashboard - Profile - Saved FDs - My enquiries/applications -
Notifications - Consent preferences

Bank: - Bank dashboard - Bank profile - FD plans - Create/edit FD plan -
Applications/leads - Advertisement manager - Campaign analytics

Admin: - Admin dashboard - Users - Bank verification - FD plan
moderation - Application monitoring - Advertisement moderation -
Campaigns and payments - Reports - Audit logs

------------------------------------------------------------------------

# 12. UI/UX Design Guidelines

## 12.1 Design Principles

-   Professional, trustworthy fintech visual language.
-   Clear hierarchy and readable financial figures.
-   Mobile-first responsive design.
-   Use consistent spacing, typography and component patterns.
-   Clearly label estimates and sponsored content.
-   Avoid misleading urgency or guaranteed-return language.
-   Show source and last-verified date for FD terms.

## 12.2 Homepage Layout

1.  Header: logo, FD rates, banks, calculator, login/register.
2.  Hero section: headline and FD search.
3.  FD calculator preview.
4.  Featured banks.
5.  Popular FD schemes.
6.  FD comparison section.
7.  Sponsored bank advertisements, visibly labelled.
8.  How it works.
9.  Safety and disclosures.
10. Footer with policies and contact details.

## 12.3 FD Card Fields

-   Bank logo and bank name.
-   FD plan name.
-   Standard interest rate.
-   Senior citizen rate, where applicable.
-   Minimum deposit.
-   Tenure range.
-   Interest payout.
-   Last verified date.
-   Sponsored label, if paid.
-   View details and compare actions.

## 12.4 Admin Dashboard Layout

-   Sidebar navigation.
-   Summary KPI cards.
-   Pending approvals.
-   Recent user activity.
-   Campaign performance.
-   Application/enquiry status chart.
-   Bank and plan management tables.

## 12.5 Bank Dashboard Layout

-   Campaign overview.
-   FD plans and approval statuses.
-   Enquiry counts.
-   Ad spend and budget.
-   Impressions, clicks and click-through rate.
-   Create campaign and add FD plan actions.

------------------------------------------------------------------------

# 13. Authentication and Authorisation Design

## 13.1 Authentication Flow

1.  Frontend submits credentials or Google ID token.
2.  Backend validates input.
3.  For local login, backend verifies password hash.
4.  For Google login, backend verifies token signature, issuer, audience
    and expiry using Google's official library.
5.  Backend finds or creates an account under safe account-linking
    rules.
6.  Backend issues a secure session.
7.  Protected endpoints authenticate the session.
8.  Logout revokes/clears the session.

Prefer a secure server-managed session or short-lived access token with
rotating refresh token. If using cookies, configure HttpOnly, Secure,
SameSite and CSRF controls correctly. Do not store long-lived bearer
tokens in localStorage.

## 13.2 Role Middleware

Conceptual example:

``` javascript
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }
    next();
  };
};
```

This is only a role check. Bank ownership must also be checked in the
service:

``` javascript
if (
  req.user.role === "bank" &&
  String(resource.bankId) !== String(req.user.bankId)
) {
  throw new ForbiddenError("You cannot access another bank's resource");
}
```

Never rely on frontend route hiding as security.

------------------------------------------------------------------------

# 14. Advertising Business Rules

1.  Only approved banks can publish campaigns.
2.  Campaigns must have valid start/end dates and budgets.
3.  Every creative and destination URL must pass moderation.
4.  Admin approval is required before publication.
5.  Every paid placement is labelled `Sponsored` or `Advertisement`.
6.  Sponsored listings are visually distinct from organic results.
7.  Ad placement must not falsify FD rates or terms.
8.  Campaigns stop when they expire, are paused, or exhaust their valid
    budget.
9.  Bank users can only see their own campaign analytics.
10. Payment confirmation must be verified server-side.
11. Click/impression analytics require deduplication and abuse
    protection.
12. Refunds and disputes must be auditable.
13. Advertising contracts must define placement, pricing, invalid
    traffic, refunds and data use.

Example campaign status flow:

`draft -> pending_payment -> pending_review -> scheduled -> active -> completed`

Other terminal or exception states: `rejected`, `paused`, `cancelled`.

------------------------------------------------------------------------

# 15. Security, Privacy and Compliance Checklist

Before production: - Obtain legal review of the marketplace,
lead-generation and advertising model. - Confirm the platform is not
accepting or holding deposits. - Sign appropriate agreements with
participating banks. - Confirm permitted use of bank logos, names,
product data and trademarks. - Confirm whether any regulated
intermediary, marketing, referral or outsourcing rules apply. - Review
applicable Indian data protection and cybersecurity requirements. -
Publish privacy policy, terms, cookie/consent notices and grievance
contact. - Obtain explicit user consent before sharing personal data
with a bank. - Collect only necessary personal information. - Provide a
process for data access, correction and deletion requests where
applicable. - Verify claims about deposit insurance directly against
official DICGC information. - Keep source and last-verified date for
rates and bank product terms. - Use bank-hosted KYC/payment flow unless
a formally approved integration says otherwise. - Perform security
testing before handling real users.

Official references to review: - RBI: https://www.rbi.org.in/ - DICGC:
https://www.dicgc.org.in/ - Google Identity:
https://developers.google.com/identity - MongoDB security:
https://www.mongodb.com/docs/manual/security/ - Express production
security:
https://expressjs.com/en/advanced/best-practice-security.html - OWASP:
https://owasp.org/www-project-top-ten/

This list is a starting point, not a complete legal checklist.

------------------------------------------------------------------------

# 16. Development Roadmap --- Step by Step

Build in the following order. Do not attempt all panels and integrations
at once.

## Phase 0 --- Requirements and Design

Tasks: - Confirm MVP scope. - Confirm bank onboarding model. - Confirm
redirect-only versus partner API booking. - Finalise roles and
permissions. - Finalise collection schemas. - Finalise API contracts. -
Draw ER diagram and architecture. - Design wireframes in Figma.

Deliverables: - Requirements document. - ER diagram. - API
specification. - UI wireframes. - Security and data-flow decisions.

## Phase 1 --- Repository and Environment Setup

1.  Create a GitHub repository.
2.  Create `client` and `server` folders.
3.  Initialise React with Vite.
4.  Initialise Express backend.
5.  Connect MongoDB Atlas.
6.  Add environment variable configuration.
7.  Add linting and formatting.
8.  Add health-check route.
9.  Create development and staging environments.

Suggested commands:

``` bash
mkdir fd-connect
cd fd-connect
mkdir client server

# Frontend
cd client
npm create vite@latest . -- --template react
npm install
npm install react-router-dom axios @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install lucide-react

# Backend
cd ../server
npm init -y
npm install express mongoose dotenv cors helmet express-rate-limit
npm install bcrypt jsonwebtoken cookie-parser zod
npm install google-auth-library
npm install -D nodemon vitest supertest
```

Select compatible package versions and review dependency advisories. Use
a supported Node.js LTS version.

## Phase 2 --- Database Models

Create models in this order: 1. User 2. Bank 3. FDPlan 4. Application 5.
Advertisement 6. AdCampaign 7. Payment 8. Favorite 9. Notification 10.
AuditLog 11. AdEvent, if required

Tasks: - Define schemas and enums. - Add required-field and range
validation. - Add indexes. - Add timestamps. - Add unique constraints. -
Write model tests. - Create seed script with clearly fictional/test data
or verified public data with source metadata.

Deliverable: all models load and tests pass.

## Phase 3 --- Authentication and RBAC

Tasks: - Registration. - Login. - Password hashing. - Email
verification. - Google authentication. - Session/refresh token
handling. - Logout. - Protected API middleware. - Role middleware. -
Bank ownership middleware. - Admin-created bank access.

Deliverable: test all roles and forbidden access scenarios in Postman.

## Phase 4 --- Bank Management

Tasks: - Admin bank listing. - Bank registration request. - Bank
verification workflow. - Bank profile update. - Public approved bank
directory. - Bank-user association. - Audit all admin decisions.

Deliverable: verified banks appear in public listings.

## Phase 5 --- FD Plan Management

Tasks: - Bank creates draft FD plan. - Bank submits plan for approval. -
Admin reviews plan. - Admin approves/rejects plan. - Public catalogue
shows only approved active plans. - Add source URL and last-verified
date. - Implement search, filters, pagination and sorting. - Implement
comparison API.

Deliverable: users can browse and compare verified FD plans.

## Phase 6 --- Calculator

Tasks: - Define supported calculation methods. - Implement input
validation. - Support standard/senior rates where applicable. - Support
payout/compounding variations. - Add rounding and day-count policy. -
Test against bank examples. - Display assumptions and disclaimers.

Deliverable: calculator returns tested estimates.

## Phase 7 --- User Features

Tasks: - User dashboard. - Profile. - Favourite FD plans. -
Enquiry/application initiation. - Consent capture. - Official bank
redirect. - Application status timeline. - Notifications.

Deliverable: complete discovery-to-bank-handoff journey.

## Phase 8 --- Bank Advertising

Tasks: - Campaign creation. - Creative upload. - Placement selection. -
Budget and dates. - Advertising payment integration. - Webhook
verification. - Admin moderation. - Campaign scheduling. -
Impression/click analytics. - Bank analytics dashboard.

Deliverable: approved paid campaigns can be displayed and measured.

## Phase 9 --- Admin Panel

Tasks: - Admin dashboard. - User management. - Bank approval. - FD plan
moderation. - Advertisement moderation. - Campaign and payment
reports. - Application/enquiry monitoring. - Audit logs.

Deliverable: platform operations can be managed centrally.

## Phase 10 --- Testing and Deployment

Tasks: - Unit tests. - API integration tests. - Frontend component
tests. - End-to-end tests. - RBAC and IDOR tests. - Responsive UI
tests. - Accessibility checks. - Security review. - Load/performance
tests. - Production deployment. - Backups, monitoring and alerting.

Deliverable: production-ready release candidate.

------------------------------------------------------------------------

# 17. Testing Strategy

## 17.1 Authentication Tests

-   Valid registration.
-   Duplicate email rejected.
-   Invalid email rejected.
-   Incorrect password rejected.
-   Google token verification.
-   Expired session rejected.
-   Inactive account rejected.
-   User cannot become admin by editing request payload.

## 17.2 Authorisation Tests

-   User cannot access admin APIs.
-   User cannot access bank APIs.
-   Bank A cannot read or update Bank B's plans.
-   Bank cannot approve its own plan.
-   Admin-only moderation is protected.
-   User cannot read another user's application.

## 17.3 FD Plan Tests

-   Invalid amount range rejected.
-   Invalid tenure range rejected.
-   Inactive plan excluded from public results.
-   Unapproved plan excluded from public results.
-   Expired plan excluded from active results.
-   Rate and source snapshots remain stable in historical application
    records.

## 17.4 Calculator Tests

-   Zero/negative principal rejected.
-   Invalid tenure rejected.
-   Rate outside allowed range rejected.
-   Standard and senior rates selected correctly.
-   Payout methods use the correct calculation strategy.
-   Rounding matches documented policy.
-   Test values against bank-published examples.

## 17.5 Advertisement Tests

-   Unapproved campaign never appears publicly.
-   Campaign outside date window is not served.
-   Paused campaign is not served.
-   Bank cannot edit another bank's campaign.
-   Duplicate webhook does not double-credit payment.
-   Duplicate event does not inflate analytics.
-   Sponsored label is always visible.

## 17.6 Application Tests

-   Consent is recorded.
-   User can only see own application.
-   Redirect does not imply booking.
-   Only trusted confirmation can mark booked.
-   Repeated requests do not create duplicate applications when
    idempotency is required.

------------------------------------------------------------------------

# 18. Deployment and Environment Variables

## 18.1 Example Backend `.env.example`

``` env
NODE_ENV=development
PORT=5000

MONGODB_URI=mongodb_connection_string

CLIENT_URL=http://localhost:5173
API_BASE_URL=http://localhost:5000

GOOGLE_CLIENT_ID=your_google_client_id

SESSION_SECRET=replace_with_strong_secret
JWT_ACCESS_SECRET=replace_with_strong_secret
JWT_REFRESH_SECRET=replace_with_strong_secret

EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

PAYMENT_GATEWAY_KEY=
PAYMENT_GATEWAY_SECRET=
PAYMENT_WEBHOOK_SECRET=
```

Never commit a real `.env` file. Add `.env` to `.gitignore`. Use
different secrets for each environment. Do not expose server secrets in
frontend variables.

## 18.2 Deployment Layout

``` mermaid
flowchart TB
    USER[Browser]
    USER --> VERCEL[React Frontend - Vercel]
    VERCEL --> API[Express API - Render/Railway/AWS]
    API --> MONGO[MongoDB Atlas]
    API --> CLOUD[Cloudinary/Object Storage]
    API --> MAIL[Email Provider]
    API --> PAY[Payment Provider for Ad Fees]
    API --> BANK[Official Bank Journey / Approved API]
```

Deployment steps: 1. Create production MongoDB cluster. 2. Restrict
database network access. 3. Configure secrets in backend hosting
environment. 4. Deploy Express API. 5. Deploy React frontend. 6.
Configure allowed CORS origins. 7. Configure HTTPS and cookies. 8.
Configure Google OAuth authorised origins and redirect URIs. 9.
Configure payment webhooks for advertising fees, if enabled. 10.
Configure logs, alerts and backups. 11. Run smoke tests after
deployment.

------------------------------------------------------------------------

# 19. Git and Team Collaboration

Recommended branch strategy:

``` text
main
develop
feature/authentication
feature/bank-management
feature/fd-plans
feature/calculator
feature/advertisements
feature/admin-dashboard
feature/user-dashboard
```

Rules: - Protect `main`. - Create a feature branch for each task. - Use
pull requests. - Require review before merging. - Do not commit `.env`,
credentials or private documents. - Use consistent commit messages. -
Keep API contracts and schema changes documented. - Coordinate shared
files such as route configuration and package files.

Suggested team allocation: - Developer 1: Authentication and users. -
Developer 2: Bank and FD plan backend. - Developer 3: User frontend and
comparison. - Developer 4: Admin/bank dashboards and advertising. -
Integrator: API integration, reviews, testing and deployment.

For a small team, adjust roles based on availability and experience.

------------------------------------------------------------------------

# 20. MVP Acceptance Criteria

The MVP is complete when all of the following work:

-   [ ] User can register and log in.
-   [ ] User can continue with Google.
-   [ ] Admin can securely log in.
-   [ ] Bank representative can access only an approved bank account.
-   [ ] Admin can approve/reject banks.
-   [ ] Approved banks can submit FD plans.
-   [ ] Admin can approve/reject FD plans.
-   [ ] Users can browse approved FD plans.
-   [ ] Users can filter and compare FD plans.
-   [ ] FD calculator displays estimates and assumptions.
-   [ ] Users can save favourite plans.
-   [ ] Users can initiate an enquiry and be redirected to the official
    bank journey.
-   [ ] Application status is not falsely marked booked.
-   [ ] Banks can create advertisement campaigns.
-   [ ] Admin can approve advertisements.
-   [ ] Sponsored content is clearly labelled.
-   [ ] Campaign analytics are available to the owning bank.
-   [ ] Role and bank ownership checks are tested.
-   [ ] The UI works on mobile, tablet and desktop.
-   [ ] API documentation and setup instructions are available.

------------------------------------------------------------------------

# 21. Future Enhancements

After the MVP: - Formal bank API integrations. - Bank-confirmed FD
booking status synchronisation. - Advanced FD comparison and
recommendation engine. - Historical rate charts. - Maturity reminders
for verified deposits. - Tax estimation with clear assumptions. - FD
ladder planning. - Multilingual interface. - More detailed bank campaign
analytics. - Fraud and invalid-traffic detection. - Customer support
ticketing. - Mobile application.

------------------------------------------------------------------------

# 22. Important Product Decisions to Confirm

Before coding, record decisions for these items:

  -----------------------------------------------------------------------
  Decision                            Recommended initial choice
  ----------------------------------- -----------------------------------
  Booking model                       Redirect to official bank website

  Real money handling                 No FD principal handled by platform

  User roles                          User, Bank, Admin

  Architecture                        Modular monolith

  Database                            MongoDB Atlas

  Frontend                            React + Vite + Tailwind

  Backend                             Node + Express

  Authentication                      Email/password + Google

  Bank onboarding                     Admin verification

  FD plan publishing                  Bank submits; admin approves

  Advertising                         Paid campaigns with admin approval

  Sponsored listings                  Clearly labelled and separate from
                                      organic ranking

  KYC                                 Handled by the bank in MVP

  Payment gateway                     Only for platform advertising fees
                                      in MVP
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 23. Definition of Done

A feature is not complete merely because its screen exists. It is
complete when: 1. The UI is responsive and accessible. 2. The API
validates all inputs. 3. The backend enforces authentication and
ownership. 4. Database indexes and constraints are considered. 5.
Loading, empty, success and error states exist. 6. Unit/integration
tests pass. 7. Sensitive data is not exposed in responses or logs. 8.
API documentation is updated. 9. The feature is reviewed and merged
through a pull request.

------------------------------------------------------------------------

# 24. Final Build Recommendation

Build FD Connect in this order:

**Foundation → Authentication → Bank verification → FD plans →
Search/comparison → Calculator → User enquiries → Advertisements → Admin
operations → Testing → Deployment.**

Keep the first release focused on accurate FD information, transparent
comparisons and a secure handoff to banks. Add actual bank booking
integrations only after formal partnerships and regulatory review.

This document should be maintained as the project's living
specification. Update it whenever a schema, API, permission, workflow or
business rule changes.
