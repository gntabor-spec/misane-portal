"""
Misane Properties — Client Portal API (FastAPI + SQLite)
M1 foundation: JWT auth, User + Client models, admin client management.
Later milestones add: intake, photo uploads, preview/approval, Stripe billing.
"""
import os, sqlite3, datetime, json, secrets, smtplib, ssl
from contextlib import closing
from email.message import EmailMessage
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError

# ---- config ----
SECRET_KEY = os.environ.get("MISANE_SECRET", "change-me-in-.env")
ALGO = "HS256"
TOKEN_MINUTES = 480
DB_PATH = os.environ.get("MISANE_DB", os.path.join(os.path.dirname(__file__), "misane.db"))
UPLOAD_DIR = os.environ.get("MISANE_UPLOADS", os.path.join(os.path.dirname(__file__), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# SMTP — Greg fills these in .env (domain mailbox, e.g. greg@misaneproperties.com)
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "no-reply@misaneproperties.com")
ADMIN_EMAIL = os.environ.get("MISANE_ADMIN_EMAIL", "")

app = FastAPI(title="Misane Portal API")
# Auth is via Bearer token in the Authorization header (no cookies), so it's safe
# to allow any origin — every property site can post the public contact form
# without per-domain config, and the token still gates the protected routes.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---- db ----
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with closing(db()) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'client',   -- 'admin' | 'client'
            client_id INTEGER,
            must_change_pw INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS clients(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            property_address TEXT,
            email TEXT,
            phone TEXT,
            domain TEXT,                          -- their dedicated site, e.g. 3545uniformst.com
            scenario TEXT DEFAULT 'fsbo',         -- 'fsbo' | 'realtor'
            status TEXT DEFAULT 'intake',         -- intake|building|preview|approved|live|maintenance|cancelled
            intake_json TEXT,                     -- answers from the intake form
            commission_pct TEXT,                  -- owner-set buyer-agent %
            stripe_customer TEXT,
            stripe_subscription TEXT,
            plan_started TEXT,                    -- date the $500 was paid (sub anchor)
            plan_draft TEXT,                      -- marketing plan being edited (admin only)
            plan_published TEXT,                  -- marketing plan the client sees
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS submissions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            author_email TEXT,
            kind TEXT DEFAULT 'update',           -- 'update' | 'feedback'
            message TEXT,
            files_json TEXT,                      -- JSON array of uploaded file URLs
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS leads(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            domain TEXT,
            name TEXT, email TEXT, phone TEXT, message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """)
        # seed an admin from env on first run
        admin_email = os.environ.get("MISANE_ADMIN_EMAIL")
        admin_pw = os.environ.get("MISANE_ADMIN_PASSWORD")
        if admin_email and admin_pw:
            row = c.execute("SELECT id FROM users WHERE email=?", (admin_email,)).fetchone()
            if not row:
                c.execute("INSERT INTO users(email,password_hash,role,must_change_pw) VALUES(?,?,?,0)",
                          (admin_email, pwd.hash(admin_pw), "admin"))
        # migrate existing DBs: add new columns if missing
        existing = [r[1] for r in c.execute("PRAGMA table_info(clients)").fetchall()]
        for col in ("email", "phone", "plan_draft", "plan_published", "property_type", "plan_embed_url"):
            if col not in existing:
                c.execute(f"ALTER TABLE clients ADD COLUMN {col} TEXT")
        c.commit()

# ---- auth helpers ----
def make_token(uid:int, role:str):
    exp = datetime.datetime.utcnow() + datetime.timedelta(minutes=TOKEN_MINUTES)
    return jwt.encode({"sub": str(uid), "role": role, "exp": exp}, SECRET_KEY, algorithm=ALGO)

from fastapi import Header
def get_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGO])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid token")
    with closing(db()) as c:
        u = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not u:
        raise HTTPException(401, "User not found")
    return dict(u)

def require_admin(u=Depends(get_user)):
    if u["role"] != "admin":
        raise HTTPException(403, "Admin only")
    return u

# ---- email + notifications ----
def send_email(to, subject, body, reply_to=None):
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [r for r in dict.fromkeys(recipients) if r]   # dedupe, drop blanks
    if not recipients or not SMTP_HOST:
        print(f"[email skipped] {subject} -> {recipients}")
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = ", ".join(recipients)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    try:
        if SMTP_PORT == 465:
            srv = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20)
        else:
            srv = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
            srv.starttls(context=ssl.create_default_context())
        if SMTP_USER:
            srv.login(SMTP_USER, SMTP_PASS)
        srv.send_message(msg)
        srv.quit()
        return True
    except Exception as e:
        print(f"[email error] {e}")
        return False

def client_contact_emails(cid):
    """Everyone who should hear about this client: all their logins + the client email field."""
    with closing(db()) as c:
        rows = c.execute("SELECT email FROM users WHERE client_id=?", (cid,)).fetchall()
        cl = c.execute("SELECT email FROM clients WHERE id=?", (cid,)).fetchone()
    emails = [r["email"] for r in rows]
    if cl and cl["email"]:
        emails.append(cl["email"])
    return emails

# ---- schemas ----
class LoginIn(BaseModel):
    email: EmailStr
    password: str
class ClientIn(BaseModel):
    name: str
    property_address: str | None = None
    email: str | None = None
    phone: str | None = None
    domain: str | None = None
    scenario: str = "fsbo"
class ClientUpdate(BaseModel):
    name: str | None = None
    property_address: str | None = None
    email: str | None = None
    phone: str | None = None
    domain: str | None = None
    scenario: str | None = None
    commission_pct: str | None = None
    plan_embed_url: str | None = None     # hosted plan page shown in the client's Marketing Plan tab
class StatusIn(BaseModel):
    status: str
class PlanIn(BaseModel):
    intro: str | None = ""
    ch_web: str | None = ""
    ch_specialty: str | None = ""
    ch_social: str | None = ""
    ch_realtor: str | None = ""
    checklist: str | None = ""        # one item per line
    action_items: str | None = ""     # one item per line
    brochure_url: str | None = ""
    cards_url: str | None = ""
    copy_url: str | None = ""
    notes: str | None = ""

ALLOWED_STATUS = ["intake", "building", "preview", "approved", "live", "maintenance", "cancelled"]

# ---- routes ----
@app.on_event("startup")
def _startup(): init_db()

@app.get("/api/health")
def health(): return {"ok": True}

@app.post("/api/auth/login")
def login(body: LoginIn):
    with closing(db()) as c:
        u = c.execute("SELECT * FROM users WHERE email=?", (body.email.lower(),)).fetchone()
    if not u or not pwd.verify(body.password, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {"token": make_token(u["id"], u["role"]), "role": u["role"], "must_change_pw": bool(u["must_change_pw"])}

@app.get("/api/auth/me")
def me(u=Depends(get_user)):
    out = {"id": u["id"], "email": u["email"], "role": u["role"], "client_id": u["client_id"]}
    if u["client_id"]:
        with closing(db()) as c:
            cl = c.execute("SELECT * FROM clients WHERE id=?", (u["client_id"],)).fetchone()
        if cl:
            d = dict(cl); d.pop("plan_draft", None)   # clients never see the unpublished draft
            out["client"] = d
        else:
            out["client"] = None
    return out

@app.get("/api/clients")
def list_clients(_=Depends(require_admin)):
    with closing(db()) as c:
        rows = c.execute("SELECT * FROM clients ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]

@app.get("/api/admin/overview")
def admin_overview(_=Depends(require_admin)):
    """Dashboard data: client counts by status, plus the latest leads and update requests."""
    with closing(db()) as c:
        rows = c.execute("SELECT status, COUNT(*) n FROM clients GROUP BY status").fetchall()
        total = c.execute("SELECT COUNT(*) n FROM clients").fetchone()["n"]
        leads = c.execute("SELECT * FROM leads ORDER BY created_at DESC LIMIT 10").fetchall()
        subs = c.execute(
            "SELECT s.*, cl.name AS client_name FROM submissions s "
            "LEFT JOIN clients cl ON cl.id=s.client_id ORDER BY s.created_at DESC LIMIT 10").fetchall()
    def sub(r):
        d = dict(r)
        try: d["files"] = json.loads(d.get("files_json") or "[]")
        except Exception: d["files"] = []
        return d
    return {"total": total,
            "by_status": {r["status"]: r["n"] for r in rows},
            "recent_leads": [dict(r) for r in leads],
            "recent_updates": [sub(r) for r in subs]}

@app.post("/api/clients")
def create_client(body: ClientIn, _=Depends(require_admin)):
    with closing(db()) as c:
        cur = c.execute(
            "INSERT INTO clients(name,property_address,email,phone,domain,scenario) VALUES(?,?,?,?,?,?)",
            (body.name, body.property_address, body.email, body.phone, body.domain, body.scenario))
        c.commit()
        cid = cur.lastrowid
    return {"id": cid}

@app.get("/api/clients/{cid}")
def get_client_one(cid: int, _=Depends(require_admin)):
    with closing(db()) as c:
        r = c.execute("SELECT * FROM clients WHERE id=?", (cid,)).fetchone()
    if not r:
        raise HTTPException(404, "Client not found")
    return dict(r)

@app.post("/api/clients/{cid}/update")
def update_client(cid: int, body: ClientUpdate, _=Depends(require_admin)):
    fields = body.model_dump(exclude_none=True)
    if not fields:
        return {"ok": True}
    with closing(db()) as c:
        if not c.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone():
            raise HTTPException(404, "Client not found")
        cols = ",".join(f"{k}=?" for k in fields)
        c.execute(f"UPDATE clients SET {cols} WHERE id=?", (*fields.values(), cid))
        c.commit()
    return {"ok": True}

@app.post("/api/clients/{cid}/plan")
def save_plan(cid: int, body: PlanIn, _=Depends(require_admin)):
    """Save the marketing plan DRAFT (admin only; client doesn't see it yet)."""
    with closing(db()) as c:
        if not c.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone():
            raise HTTPException(404, "Client not found")
        c.execute("UPDATE clients SET plan_draft=? WHERE id=?", (json.dumps(body.model_dump()), cid))
        c.commit()
    return {"ok": True}

@app.post("/api/clients/{cid}/plan/publish")
def publish_plan(cid: int, background: BackgroundTasks, _=Depends(require_admin)):
    """Publish the draft → becomes what the client sees, and notify the owner's contacts."""
    with closing(db()) as c:
        r = c.execute("SELECT plan_draft, name FROM clients WHERE id=?", (cid,)).fetchone()
        if not r:
            raise HTTPException(404, "Client not found")
        c.execute("UPDATE clients SET plan_published=? WHERE id=?", (r["plan_draft"], cid))
        c.commit()
    recipients = client_contact_emails(cid)
    if recipients:
        login = os.environ.get("MISANE_APP_URL", "https://app.misaneproperties.com") + "/login"
        body = (f"Good news — your Misane Properties marketing plan for {r['name']} has been "
                f"updated and is ready to view.\n\nLog in to your portal: {login}\n\n— Misane Properties")
        background.add_task(send_email, recipients, "Your marketing plan is ready to view", body)
    return {"ok": True}

@app.post("/api/clients/{cid}/delete")
def delete_client(cid: int, _=Depends(require_admin)):
    """Remove a client and any login tied to it (e.g. a duplicate)."""
    with closing(db()) as c:
        if not c.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone():
            raise HTTPException(404, "Client not found")
        c.execute("DELETE FROM users WHERE client_id=?", (cid,))
        c.execute("DELETE FROM clients WHERE id=?", (cid,))
        c.commit()
    return {"ok": True}

@app.post("/api/clients/{cid}/status")
def set_status(cid: int, body: StatusIn, _=Depends(require_admin)):
    """Admin override — move a client to any stage (waive/skip)."""
    if body.status not in ALLOWED_STATUS:
        raise HTTPException(400, "Invalid status")
    with closing(db()) as c:
        if not c.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone():
            raise HTTPException(404, "Client not found")
        c.execute("UPDATE clients SET status=? WHERE id=?", (body.status, cid))
        c.commit()
    return {"ok": True, "status": body.status}

@app.post("/api/clients/{cid}/invite")
def invite_client(cid: int, email: EmailStr, _=Depends(require_admin)):
    """Create a client login with a temporary password (returned once for Greg to send)."""
    temp = secrets.token_urlsafe(8)
    with closing(db()) as c:
        if not c.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone():
            raise HTTPException(404, "Client not found")
        try:
            c.execute("INSERT INTO users(email,password_hash,role,client_id,must_change_pw) VALUES(?,?,?,?,1)",
                      (email.lower(), pwd.hash(temp), "client", cid))
            c.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(400, "A login with that email already exists")
    return {"email": email, "temp_password": temp,
            "login_url": os.environ.get("MISANE_APP_URL", "https://app.misaneproperties.com") + "/login"}

@app.get("/api/clients/{cid}/users")
def list_client_users(cid: int, _=Depends(require_admin)):
    with closing(db()) as c:
        rows = c.execute(
            "SELECT id, email, must_change_pw, created_at FROM users WHERE client_id=? ORDER BY created_at",
            (cid,)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/clients/{cid}/users/{uid}/delete")
def remove_client_user(cid: int, uid: int, _=Depends(require_admin)):
    """Remove one login from a client (e.g. revoke a family member's access)."""
    with closing(db()) as c:
        u = c.execute("SELECT id FROM users WHERE id=? AND client_id=?", (uid, cid)).fetchone()
        if not u:
            raise HTTPException(404, "Login not found for this client")
        c.execute("DELETE FROM users WHERE id=?", (uid,))
        c.commit()
    return {"ok": True}

# ---- Update tab: owner submits photos/videos + new content / feedback ----
@app.post("/api/portal/submissions")
async def create_submission(
    background: BackgroundTasks,
    message: str = Form(""),
    kind: str = Form("update"),
    files: list[UploadFile] = File(default=[]),
    u=Depends(get_user),
):
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    saved = []
    dest = os.path.join(UPLOAD_DIR, str(cid))
    os.makedirs(dest, exist_ok=True)
    for f in files:
        if not f.filename:
            continue
        safe = "".join(ch for ch in f.filename if ch.isalnum() or ch in "._- ").strip().replace(" ", "_")
        stamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        fname = f"{stamp}_{safe or 'file'}"
        with open(os.path.join(dest, fname), "wb") as out:
            out.write(await f.read())
        saved.append(f"/uploads/{cid}/{fname}")
    with closing(db()) as c:
        c.execute("INSERT INTO submissions(client_id,author_email,kind,message,files_json) VALUES(?,?,?,?,?)",
                  (cid, u["email"], kind, message, json.dumps(saved)))
        cl = c.execute("SELECT name FROM clients WHERE id=?", (cid,)).fetchone()
        c.commit()
    name = cl["name"] if cl else f"client {cid}"
    if ADMIN_EMAIL:
        body = (f"New {kind} from {u['email']} ({name}).\n\nMessage:\n{message or '(none)'}\n\n"
                f"Files ({len(saved)}): " + (", ".join(saved) if saved else "none"))
        background.add_task(send_email, ADMIN_EMAIL, f"Misane portal — new {kind} from {name}", body, u["email"])
    return {"ok": True, "files": saved}

@app.get("/api/clients/{cid}/submissions")
def list_submissions(cid: int, _=Depends(require_admin)):
    with closing(db()) as c:
        rows = c.execute("SELECT * FROM submissions WHERE client_id=? ORDER BY created_at DESC", (cid,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try: d["files"] = json.loads(d.get("files_json") or "[]")
        except Exception: d["files"] = []
        out.append(d)
    return out

# ---- Public contact form on each property site → forwards to the owner's contacts ----
class ContactIn(BaseModel):
    domain: str
    name: str
    email: EmailStr
    phone: str | None = ""
    message: str

@app.post("/api/public/contact")
def public_contact(body: ContactIn, background: BackgroundTasks):
    dom = body.domain.lower().strip().replace("www.", "")
    with closing(db()) as c:
        cl = c.execute("SELECT id FROM clients WHERE replace(lower(domain),'www.','')=?", (dom,)).fetchone()
        cid = cl["id"] if cl else None
        c.execute("INSERT INTO leads(client_id,domain,name,email,phone,message) VALUES(?,?,?,?,?,?)",
                  (cid, dom, body.name, body.email, body.phone, body.message))
        c.commit()
    recipients = client_contact_emails(cid) if cid else []
    if ADMIN_EMAIL:
        recipients.append(ADMIN_EMAIL)        # Greg always gets a copy
    text = (f"New inquiry from your property site {dom}:\n\n"
            f"Name:  {body.name}\nEmail: {body.email}\nPhone: {body.phone or '—'}\n\n"
            f"Message:\n{body.message}\n\nReply directly to this email to reach them.\n— Misane Properties")
    background.add_task(send_email, recipients, f"New inquiry on {dom} — {body.name}", text, body.email)
    return {"ok": True}

# ============================================================
# M4 — Stripe billing
# Model: $100 signup + $500 approval cover months 1-2; then $100/mo
# starting ~2 months after the $500, capped at 12 months (~10 charges).
# ============================================================
import time as _time
import stripe
from fastapi import Request

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
APP_URL = os.environ.get("MISANE_APP_URL", "https://app.misaneproperties.com")
_price_cache = {}

def _client_or_404(cid):
    with closing(db()) as c:
        r = c.execute("SELECT * FROM clients WHERE id=?", (cid,)).fetchone()
    if not r:
        raise HTTPException(404, "Client not found")
    return dict(r)

def _set_client(cid, **fields):
    cols = ",".join(f"{k}=?" for k in fields)
    with closing(db()) as c:
        c.execute(f"UPDATE clients SET {cols} WHERE id=?", (*fields.values(), cid))
        c.commit()

def _monthly_price():
    """Create or reuse a $100/mo recurring price (so Greg needn't make products by hand)."""
    if _price_cache.get("m"):
        return _price_cache["m"]
    prod = None
    for p in stripe.Product.list(limit=100).auto_paging_iter():
        if (p.get("metadata") or {}).get("misane") == "monthly":
            prod = p; break
    if not prod:
        prod = stripe.Product.create(name="Misane Properties — Monthly", metadata={"misane": "monthly"})
    for pr in stripe.Price.list(product=prod.id, active=True, limit=100).auto_paging_iter():
        if pr.unit_amount == 10000 and pr.recurring and pr.recurring.interval == "month":
            _price_cache["m"] = pr.id; return pr.id
    pr = stripe.Price.create(product=prod.id, unit_amount=10000, currency="usd", recurring={"interval": "month"})
    _price_cache["m"] = pr.id
    return pr.id

def _ensure_customer(cl):
    if cl.get("stripe_customer"):
        return cl["stripe_customer"]
    cust = stripe.Customer.create(name=cl["name"], metadata={"client_id": str(cl["id"])})
    _set_client(cl["id"], stripe_customer=cust.id)
    return cust.id

def _signup_session(cid, success_url, cancel_url):
    return stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"price_data": {"currency": "usd", "unit_amount": 10000,
                     "product_data": {"name": "Misane Properties — Signup deposit"}}, "quantity": 1}],
        success_url=success_url, cancel_url=cancel_url,
        metadata={"client_id": str(cid), "kind": "signup"},
    )

@app.post("/api/clients/{cid}/checkout/signup")
def checkout_signup(cid: int, _=Depends(require_admin)):
    _client_or_404(cid)
    s = _signup_session(cid, f"{APP_URL}/portal?paid=signup", f"{APP_URL}/portal")
    return {"url": s.url}

@app.post("/api/public/signup")
async def public_signup(
    background: BackgroundTasks,
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    property_type: str = Form(""),
    property_subtype: str = Form(""),
    listed_with_agent: str = Form(""),
    address: str = Form(""),
    description: str = Form(""),
    files: list[UploadFile] = File(default=[]),
):
    """Public funnel: prospect submits property + photos, then pays the $100 deposit."""
    intake = {"property_type": property_type, "property_subtype": property_subtype,
              "listed_with_agent": listed_with_agent, "address": address, "description": description}
    scenario = "realtor" if listed_with_agent.lower() in ("yes", "true", "1") else "fsbo"
    with closing(db()) as c:
        cur = c.execute(
            "INSERT INTO clients(name,property_address,email,phone,scenario,status,property_type,intake_json) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (name, address, email, phone, scenario, "intake", property_type, json.dumps(intake)))
        c.commit()
        cid = cur.lastrowid
    saved = []
    if files:
        dest = os.path.join(UPLOAD_DIR, str(cid))
        os.makedirs(dest, exist_ok=True)
        for f in files:
            if not f.filename:
                continue
            safe = "".join(ch for ch in f.filename if ch.isalnum() or ch in "._- ").strip().replace(" ", "_")
            stamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
            fname = f"{stamp}_{safe or 'file'}"
            with open(os.path.join(dest, fname), "wb") as out:
                out.write(await f.read())
            saved.append(f"/uploads/{cid}/{fname}")
        with closing(db()) as c:
            c.execute("INSERT INTO submissions(client_id,author_email,kind,message,files_json) VALUES(?,?,?,?,?)",
                      (cid, email, "signup", description, json.dumps(saved)))
            c.commit()
    if ADMIN_EMAIL:
        body = (f"New signup from {name} <{email}> ({phone or 'no phone'}).\n"
                f"Type: {property_type} {property_subtype}  ·  Listed w/ agent: {listed_with_agent or 'n/a'}\n"
                f"Address: {address or 'n/a'}\n\nWhy they love it:\n{description or '(none)'}\n\n"
                f"Photos ({len(saved)}): " + (", ".join(saved) if saved else "none"))
        background.add_task(send_email, ADMIN_EMAIL, f"New Misane signup — {name}", body, email)
    checkout_url = None
    if stripe.api_key:
        try:
            checkout_url = _signup_session(cid, f"{APP_URL}/start/thanks", f"{APP_URL}/start").url
        except Exception as e:
            print("[signup checkout error]", e)
    return {"client_id": cid, "checkout_url": checkout_url}

@app.post("/api/clients/{cid}/checkout/approval")
def checkout_approval(cid: int, u=Depends(get_user)):
    if u["role"] != "admin" and u.get("client_id") != cid:
        raise HTTPException(403, "Forbidden")
    cl = _client_or_404(cid)
    cust = _ensure_customer(cl)
    s = stripe.checkout.Session.create(
        mode="payment", customer=cust,
        line_items=[{"price_data": {"currency": "usd", "unit_amount": 50000,
                     "product_data": {"name": "Misane Properties — Build approval (months 1–2)"}}, "quantity": 1}],
        payment_intent_data={"setup_future_usage": "off_session"},   # save card for the subscription
        success_url=f"{APP_URL}/portal?paid=approval", cancel_url=f"{APP_URL}/portal",
        metadata={"client_id": str(cid), "kind": "approval"},
    )
    return {"url": s.url}

@app.post("/api/clients/{cid}/cancel")
def cancel_subscription(cid: int, u=Depends(get_user)):
    cl = _client_or_404(cid)
    if u["role"] != "admin" and u.get("client_id") != cid:
        raise HTTPException(403, "Forbidden")
    if not cl.get("stripe_subscription"):
        raise HTTPException(400, "No active subscription")
    stripe.Subscription.modify(cl["stripe_subscription"], cancel_at_period_end=True)
    _set_client(cid, status="cancelling")
    return {"ok": True, "message": "Subscription will end at the close of the current period."}

@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid signature")
    typ = event["type"]
    obj = event["data"]["object"]
    if typ == "checkout.session.completed":
        meta = obj.get("metadata") or {}
        cid = int(meta.get("client_id") or 0)
        kind = meta.get("kind")
        if cid and kind == "signup":
            _set_client(cid, status="building")
        elif cid and kind == "approval":
            cust = obj.get("customer")
            pm = None
            if obj.get("payment_intent"):
                pi = stripe.PaymentIntent.retrieve(obj["payment_intent"])
                pm = pi.payment_method
            now = int(_time.time())
            sub = stripe.Subscription.create(
                customer=cust,
                items=[{"price": _monthly_price()}],
                trial_end=now + 60 * 24 * 3600,        # first $100 ~2 months out
                cancel_at=now + 365 * 24 * 3600,        # cap at 12 months
                default_payment_method=pm,
                metadata={"client_id": str(cid)},
            )
            _set_client(cid, stripe_subscription=sub.id, status="live",
                        plan_started=datetime.date.today().isoformat())
    elif typ == "customer.subscription.deleted":
        sid = obj.get("id")
        with closing(db()) as c:
            row = c.execute("SELECT id FROM clients WHERE stripe_subscription=?", (sid,)).fetchone()
        if row:
            _set_client(row["id"], status="cancelled")
    return {"received": True}
