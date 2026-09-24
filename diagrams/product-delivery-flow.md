# Product Delivery Flow

**Implements:** baseline §8 delivery model, BR-15 · `docs/04` §6 files, §7.3 entitlements and delivery, §7.9 flags · `docs/05` T-entitlements, T-subscriptions, T-service_progress, T-downloads, T-delivery_tasks, T-release_files · MASTER_SPEC §4.3, §7 (license key channel, manual grants)
**Decision IDs:** A-601, A-602, D-406, D-601, D-602, D-603, D-604, D-605, D-606, D-607, D-608, D-1108, D-1602 (flag automated_provisioning)

---

## 1. Entitlement state machine (`entitlements.status`)

```mermaid
stateDiagram-v2
    [*] --> pending : created on paid, delivery needs admin (hosted, service, custom)
    [*] --> active : created on paid for download, license and saas (manual provisioning tracked by provisioning_state, does not block active), or admin manual grant D-1108
    pending --> active : handler onGranted done, provisioning_state = done or checklist complete
    active --> suspended : subscription grace expired, or admin suspend
    suspended --> active : renewal confirmed, or admin reinstate
    active --> expired : access_ends_at passed, cron
    suspended --> expired : access_ends_at passed
    active --> revoked : refund, chargeback, admin revoke, account deletion
    suspended --> revoked : refund or admin revoke
    pending --> revoked : refund before delivery
    revoked --> [*]
    expired --> [*]

    note left of expired
        re-purchase creates a new entitlement row,
        the expired one is kept for history
    end note

    note right of active
        orders.status = fulfilled once every
        entitlement of the order is active and
        every service checklist is complete
    end note
    note right of revoked
        revoked_at, revoke_reason set
        automatic for platform assets,
        delivery_tasks revoke_external otherwise
    end note
```

---

## 2. Handler dispatch by `delivery_type` (`docs/04` §7.3)

```mermaid
flowchart TD
    Paid["orders.status = paid<br/>entitlements.service.grantForOrder"] --> Each["for each order_items row with offering_id"]
    Each --> Create["entitlements row<br/>delivery_type from offering<br/>access_ends_at from delivery_config.access_months or null<br/>update_policy, download_cap copied"]
    Create --> Sub{"purchase_model = subscription?"}
    Sub -->|"yes"| SubRow["subscriptions row<br/>status = trialing or active<br/>current_period_end = start + interval"]
    Sub -->|"no"| Handler
    SubRow --> Handler{"modules/delivery/handlers/<br/>delivery_type.ts onGranted"}
    Handler -->|"saas"| HSaas["saas handler"]
    Handler -->|"hosted"| HHosted["hosted handler"]
    Handler -->|"download"| HDl["download handler"]
    Handler -->|"license"| HLic["license handler"]
    Handler -->|"service"| HSvc["service handler"]
    Handler -->|"custom"| HCust["custom handler"]
    HSaas --> Notify["notifications + email: purchase confirmed, what happens next<br/>offerings.instructions_json rendered"]
    HHosted --> Notify
    HDl --> Notify
    HLic --> Notify
    HSvc --> Notify
    HCust --> Notify
```

**Legend:** each handler implements `onGranted`, `onRevoked`, `render(customerView)`, `adminActions`. The entitlement never knows the provider or the storage; the handler does.

---

## 3. SaaS delivery: manual now, automated behind flag (D-601, flag `automated_provisioning`)

```mermaid
flowchart TD
    G["saas onGranted"] --> Flag{"delivery_config.provisioning<br/>and feature flag automated_provisioning"}
    Flag -->|"manual, release 1"| Task["delivery_tasks kind = provision, status = open<br/>entitlements.provisioning_state = pending<br/>entitlements.status = active, MASTER_SPEC section 7"]
    Task --> Queue["Admin operations queue widget"]
    Queue --> Admin["Admin creates the account in the SaaS by hand"]
    Admin --> Done["Admin marks task done<br/>provisioning_notes: login URL, username<br/>credentials sent by email, never stored in plain text"]
    Done --> Active["provisioning_state = done<br/>delivery_tasks.status = done<br/>order fulfilled when all entitlements active and checklists complete"]
    Flag -->|"automated, V2"| Adapter["ProvisioningAdapter.create(user, offering)"]
    Adapter --> Ok{"success?"}
    Ok -->|"yes"| Active
    Ok -->|"no"| Task
    Active --> View["Customer dashboard: access card with URL and instructions"]
```

---

## 4. Hosted delivery (D-601, A-601)

```mermaid
sequenceDiagram
    autonumber
    participant H as hosted handler
    participant DB as Postgres
    actor A as Admin
    actor C as Customer
    participant N as notifications + email

    H->>DB: entitlements status = pending, provisioning_state = pending
    H->>DB: delivery_tasks kind = provision
    H->>N: customer: setup in progress, expected timeline from instructions_json
    A->>A: deploy hosted instance, configure domain, create login
    A->>DB: provisioning_notes = instance URL, admin login hint, done_at
    A->>DB: entitlements status = active, provisioning_state = done
    A->>N: customer: your instance is ready
    N-->>C: email + in-app
    C->>C: dashboard shows URL, instructions, support query link
```

---

## 5. Download delivery with signed URL and cap (D-602, D-606, BR-15)

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as /account/purchases/[entitlementId]
    participant SA as api/files download action
    participant DB as Postgres
    participant R2 as Cloudflare R2

    C->>UI: open downloads
    UI->>DB: entitlements where user_id = C and delivery_type = download and status = active
    UI->>DB: release_files for product_id (versions allowed by update_policy)
    UI-->>C: list of files, downloads_used of download_cap
    C->>SA: download(entitlement_id, release_file_id)
    SA->>SA: session, rate limit
    SA->>DB: verify entitlement belongs to C, status = active, access_ends_at null or future
    SA->>DB: verify release file version allowed by update_policy
    alt downloads_used >= download_cap
        SA-->>C: cap reached, contact support (query)
    else under cap
        SA->>DB: BEGIN, downloads row (entitlement_id, media_id, user_id, ip, user_agent)
        SA->>DB: entitlements.downloads_used + 1, COMMIT
        SA->>R2: presigned GET, 5 minute expiry, object_key of media
        R2-->>SA: signed URL
        SA-->>C: redirect to signed URL
        C->>R2: fetch file
    end
    Note over SA,R2: bucket is private, links are per-buyer and expire, every download is logged
```

---

## 6. License key delivery and reveal (D-603, D-406, MASTER_SPEC §7)

```mermaid
sequenceDiagram
    autonumber
    participant L as license handler
    participant DB as Postgres
    actor A as Admin
    actor C as Customer
    participant N as notifications + email

    L->>DB: entitlements status = active, license_key_enc null
    L->>DB: delivery_tasks kind = provision, note = enter license key
    A->>DB: enter key for this order, license_key_enc = encrypt(key), delivery_tasks done
    A->>N: key issued
    N-->>C: email + in-app notification carrying a link to the dashboard only, key never in the email
    C->>DB: dashboard reveal, decrypt on request, audit_logs read event
    Note over C,DB: SMS is not a release-1 channel. Key is revealed only inside the authenticated dashboard (MASTER_SPEC section 7 License key delivery)
    Note over L,DB: V2: license validation API, automated key generation
```

---

## 7. Service checklist delivery (D-608)

```mermaid
flowchart TD
    G["service onGranted"] --> Seed["service_progress rows seeded from offerings.service_steps<br/>one per step_key, done_at null"]
    Seed --> Pending["entitlements.status = pending<br/>provisioning_state = pending"]
    Pending --> Cust["Customer dashboard: checklist with progress bar"]
    Pending --> Admin["Admin: order detail shows steps"]
    Admin --> Tick["Admin ticks a step<br/>done_at, done_by, note<br/>audit_logs"]
    Tick --> Notify["notification to customer: step done"]
    Tick --> All{"all steps done?"}
    All -->|"no"| Admin
    All -->|"yes"| Done["entitlements.status = active, provisioning_state = done<br/>orders.status = fulfilled"]
    Done --> Final["email: service complete"]
```

---

## 8. Custom delivery (A-601)

```mermaid
flowchart LR
    G["custom onGranted"] --> Pending["entitlements.status = pending<br/>delivery_tasks kind = provision"]
    Pending --> Show["Customer sees offerings.instructions_json rendered from Tiptap"]
    Show --> Admin["Admin fulfils outside the platform"]
    Admin --> Mark["Admin marks delivered, note"]
    Mark --> Active["entitlements.status = active<br/>orders.status = fulfilled"]
```

---

## 9. Revocation: automatic vs delivery task (D-607, D-605)

```mermaid
flowchart TD
    Trigger["Revoke trigger<br/>refund applied · chargeback · admin revoke · account deletion · access_ends_at passed"] --> Handler{"handler onRevoked<br/>by delivery_type"}
    Handler -->|"download"| DlR["Automatic: entitlements.status = revoked or expired<br/>signed links no longer issued, existing links expire within 5 min"]
    Handler -->|"license"| LicR["Automatic in platform: key hidden in dashboard<br/>V2: validation API rejects key"]
    Handler -->|"service"| SvcR["Automatic: checklist frozen, status = revoked"]
    Handler -->|"saas"| SaasR{"provisioning automated?"}
    SaasR -->|"no, release 1"| SaasTask["delivery_tasks kind = revoke_external, status = open<br/>widget: revocation tasks"]
    SaasR -->|"yes, V2"| SaasAuto["ProvisioningAdapter.disable, then status = revoked"]
    Handler -->|"hosted"| HostTask["delivery_tasks kind = revoke_external<br/>admin takes instance offline"]
    Handler -->|"custom"| CustTask["delivery_tasks kind = revoke_external<br/>admin acts per instructions"]
    SaasTask --> AdminDone["Admin closes task, done_at, note"]
    HostTask --> AdminDone
    CustTask --> AdminDone
    AdminDone --> Rev["entitlements.status = revoked, revoked_at, revoke_reason<br/>audit_logs, customer notified"]
    DlR --> Rev
    LicR --> Rev
    SvcR --> Rev
    SaasAuto --> Rev
```

**Legend:** platform-held assets revoke instantly; external accounts create an open `delivery_tasks` row so nothing is silently forgotten (D-607). Status is written `revoked` for refund/chargeback/admin, `expired` for the end of a fixed access period (D-604).

---

## 10. Update policy branches (`entitlements.update_policy`, D-604, D-605)

```mermaid
flowchart TD
    Rel["Admin publishes new product version<br/>product_versions + release_files, changelog public"] --> Each["for each active entitlement of the product"]
    Each --> Pol{"update_policy"}
    Pol -->|"all_free"| AllFree["All versions downloadable forever<br/>notification: new version available"]
    Pol -->|"during_access"| DA{"access_ends_at null or in the future?"}
    DA -->|"yes"| Allowed["New version downloadable<br/>notification sent"]
    DA -->|"no"| Locked["Only versions released before access_ends_at<br/>dashboard shows renew or re-purchase"]
    Pol -->|"major_paid"| Major{"major version bump?"}
    Major -->|"minor or patch"| Allowed
    Major -->|"major"| Upgrade["Not included<br/>dashboard shows upgrade offering, new order"]
    AllFree --> Dl["download handler checks version against policy on every request"]
    Allowed --> Dl
    Locked --> Dl
    Upgrade --> Dl
```

**Legend:** the policy is copied from `offerings.delivery_config.update_policy` onto the entitlement at grant time so later offering edits do not change what an existing buyer already has. The same check gates SaaS and hosted feature updates in V2; in release 1 it only affects downloadable versions.
