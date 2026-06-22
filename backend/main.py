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
        for col in ("email", "phone", "plan_draft", "plan_published", "property_type", "plan_embed_url", "draft_url"):
            if col not in existing:
                c.execute(f"ALTER TABLE clients ADD COLUMN {col} TEXT")
        existing_u = [r[1] for r in c.execute("PRAGMA table_info(users)").fetchall()]
        for col in ("invited_at", "last_login"):
            if col not in existing_u:
                c.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT")
        c.commit()

# ---- auth helpers ----
def _now():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")

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
    u = dict(u)
    if u.get("client_id"):
        with closing(db()) as c:
            cl = c.execute("SELECT status FROM clients WHERE id=?", (u["client_id"],)).fetchone()
        if cl and cl["status"] == "cancelled":
            raise HTTPException(403, "Your plan has ended and portal access is closed.")
    return u

def require_admin(u=Depends(get_user)):
    if u["role"] != "admin":
        raise HTTPException(403, "Admin only")
    return u

# ---- email + notifications ----
def send_email(to, subject, body, reply_to=None, html=None):
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
    if ADMIN_EMAIL and ADMIN_EMAIL not in recipients:
        msg["Bcc"] = ADMIN_EMAIL          # Greg is copied on everything the tool sends
    msg.set_content(body)                 # plain-text fallback
    if html:
        msg.add_alternative(html, subtype="html")
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

def _esc(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def _email_shell(heading, body_html, button=None):
    """Branded HTML email — paper bg, white card, logo header, navy footer, optional brass button."""
    logo = "https://misaneproperties.com/assets/logo-horizontal.png"
    btn = ""
    if button:
        btn = (f'<p style="margin:24px 0 4px"><a href="{button[1]}" style="display:inline-block;background:#0B1A48;'
               f'color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:bold;'
               f'font-size:15px;padding:13px 28px;border-radius:6px">{button[0]}</a></p>')
    return (
        '<!DOCTYPE html><html><body style="margin:0;background:#FAF8F3">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F3;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center" style="padding:28px 14px">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #E0D9CC;border-radius:14px;overflow:hidden">'
        '<tr><td style="padding:20px 28px;border-bottom:1px solid #E0D9CC"><img src="' + logo + '" alt="Misane Properties" height="32" style="display:block;height:32px"></td></tr>'
        '<tr><td style="padding:28px 28px 30px;color:#43474E;font-size:15px;line-height:1.6">'
        '<h1 style="font-family:Georgia,serif;color:#14224F;font-size:23px;font-weight:normal;margin:0 0 16px">' + heading + '</h1>'
        + body_html + btn +
        '</td></tr>'
        '<tr><td style="background:#0B1A48;padding:16px 28px"><span style="color:#9fa9c6;font-size:12px;font-family:Arial,Helvetica,sans-serif">&copy; Misane Properties LLC &nbsp;&middot;&nbsp; <a href="https://misaneproperties.com" style="color:#D8A24E;text-decoration:none">misaneproperties.com</a></span></td></tr>'
        '</table></td></tr></table></body></html>'
    )

def _send_invite(email, temp, prop=None):
    login = os.environ.get("MISANE_APP_URL", "https://app.misaneproperties.com") + "/login"
    for_line = f" for {prop}" if prop else ""
    body = (
        f"Welcome to Misane Properties — your marketing portal{for_line} is ready.\n\n"
        "This is your home base for getting your property sold. Once you sign in you can:\n"
        "  -  See your full marketing plan — where to list, ready-to-post copy, and your downloadable brochures\n"
        "  -  Add or update photos and video anytime\n"
        "  -  Request changes to your site\n"
        "  -  Manage your account and billing\n\n"
        "Here's how to get in:\n"
        f"  Link:                 {login}\n"
        f"  Email:                {email}\n"
        f"  Temporary password:   {temp}\n\n"
        "For your security, you'll be asked to set your own password the first time you sign in.\n\n"
        "Questions? Just reply to this email, or reach us at greg@misaneproperties.com.\n\n"
        "We're glad you're here.\n— Misane Properties"
    )
    creds = ('<table role="presentation" cellpadding="0" cellspacing="0" style="background:#F0EBE0;border-radius:8px">'
             '<tr><td style="padding:14px 18px;font-size:14px;color:#14224F;line-height:1.9">'
             f'<b>Email:</b> {_esc(email)}<br><b>Temporary password:</b> {_esc(temp)}</td></tr></table>')
    body_html = (
        f'<p style="margin:0 0 12px">Your marketing portal{_esc(for_line)} is ready — your home base for getting your property sold.</p>'
        '<p style="margin:0 0 8px">Once you sign in you can:</p>'
        '<ul style="margin:0 0 14px;padding-left:20px">'
        '<li>See your full marketing plan — where to list, ready-to-post copy, and downloadable brochures</li>'
        '<li>Add or update photos and video anytime</li>'
        '<li>Request changes to your site</li>'
        '<li>Manage your account and billing</li></ul>'
        + creds +
        '<p style="margin:16px 0 0;font-size:13px;color:#5C6068">For your security, you&rsquo;ll set your own password the first time you sign in. Questions? Just reply to this email.</p>'
    )
    html = _email_shell("Welcome to Misane Properties", body_html, button=("Sign in to your portal", login))
    send_email(email, "Welcome to your Misane Properties portal", body, html=html)

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
    draft_url: str | None = None          # staging URL of the draft site, for stage-2 review
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
    if u["client_id"]:
        with closing(db()) as c:
            cl = c.execute("SELECT status FROM clients WHERE id=?", (u["client_id"],)).fetchone()
        if cl and cl["status"] == "cancelled":
            raise HTTPException(403, "Your plan has ended and portal access is closed.")
    with closing(db()) as c:
        c.execute("UPDATE users SET last_login=? WHERE id=?", (_now(), u["id"])); c.commit()
    return {"token": make_token(u["id"], u["role"]), "role": u["role"], "must_change_pw": bool(u["must_change_pw"])}

@app.get("/api/auth/me")
def me(u=Depends(get_user)):
    out = {"id": u["id"], "email": u["email"], "role": u["role"], "client_id": u["client_id"], "must_change_pw": bool(u.get("must_change_pw"))}
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
        body_html = (f'<p style="margin:0 0 12px">Good news — your marketing plan for <b>{_esc(r["name"])}</b> has been updated and is ready to view.</p>'
                     '<p style="margin:0">Open your portal to see your plan and what to do next.</p>')
        html = _email_shell("Your marketing plan is ready", body_html, button=("View your plan", login))
        background.add_task(send_email, recipients, "Your marketing plan is ready to view", body, html=html)
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
def invite_client(cid: int, email: EmailStr, background: BackgroundTasks, _=Depends(require_admin)):
    """Create a client login, auto-email the credentials, and return them as a fallback."""
    temp = secrets.token_urlsafe(8)
    with closing(db()) as c:
        cl = c.execute("SELECT name, property_address FROM clients WHERE id=?", (cid,)).fetchone()
        if not cl:
            raise HTTPException(404, "Client not found")
        try:
            c.execute("INSERT INTO users(email,password_hash,role,client_id,must_change_pw,invited_at) VALUES(?,?,?,?,1,?)",
                      (email.lower(), pwd.hash(temp), "client", cid, _now()))
            c.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(400, "A login with that email already exists")
    background.add_task(_send_invite, str(email), temp, cl["property_address"] or cl["name"])
    return {"email": email, "temp_password": temp, "emailed": True,
            "login_url": os.environ.get("MISANE_APP_URL", "https://app.misaneproperties.com") + "/login"}

@app.get("/api/clients/{cid}/users")
def list_client_users(cid: int, _=Depends(require_admin)):
    with closing(db()) as c:
        rows = c.execute(
            "SELECT id, email, must_change_pw, invited_at, last_login FROM users WHERE client_id=? ORDER BY created_at",
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

@app.post("/api/clients/{cid}/users/{uid}/resend")
def resend_invite(cid: int, uid: int, background: BackgroundTasks, _=Depends(require_admin)):
    """Reset a login to a fresh temp password and re-send the branded welcome email."""
    temp = secrets.token_urlsafe(8)
    with closing(db()) as c:
        u = c.execute("SELECT email FROM users WHERE id=? AND client_id=?", (uid, cid)).fetchone()
        if not u:
            raise HTTPException(404, "Login not found for this client")
        cl = c.execute("SELECT name, property_address FROM clients WHERE id=?", (cid,)).fetchone()
        c.execute("UPDATE users SET password_hash=?, must_change_pw=1, invited_at=? WHERE id=?", (pwd.hash(temp), _now(), uid))
        c.commit()
    background.add_task(_send_invite, u["email"], temp, (cl["property_address"] or cl["name"]) if cl else None)
    return {"ok": True, "email": u["email"], "temp_password": temp, "emailed": True}

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

class CommissionIn(BaseModel):
    commission_pct: str

@app.post("/api/portal/commission")
def set_commission(body: CommissionIn, background: BackgroundTasks, u=Depends(get_user)):
    """The owner sets/updates their own buyer-agent commission from their portal."""
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    with closing(db()) as c:
        cl = c.execute("SELECT name FROM clients WHERE id=?", (cid,)).fetchone()
        c.execute("UPDATE clients SET commission_pct=? WHERE id=?", (body.commission_pct, cid))
        c.commit()
    if ADMIN_EMAIL:
        background.add_task(send_email, ADMIN_EMAIL,
            f"Commission updated — {cl['name'] if cl else cid}",
            f"{u['email']} set the buyer-agent commission to {body.commission_pct}. "
            f"Update their agent brochure / plan to match.", u["email"])
    return {"ok": True, "commission_pct": body.commission_pct}

# ---- Account tab: client manages their own profile, password, people, images ----
class ProfileIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    property_address: str | None = None

@app.post("/api/portal/profile")
def portal_profile(body: ProfileIn, u=Depends(get_user)):
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        with closing(db()) as c:
            cols = ",".join(f"{k}=?" for k in fields)
            c.execute(f"UPDATE clients SET {cols} WHERE id=?", (*fields.values(), cid)); c.commit()
    return {"ok": True}

class PasswordIn(BaseModel):
    new_password: str

@app.post("/api/portal/password")
def portal_password(body: PasswordIn, u=Depends(get_user)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Use at least 8 characters.")
    with closing(db()) as c:
        c.execute("UPDATE users SET password_hash=?, must_change_pw=0 WHERE id=?",
                  (pwd.hash(body.new_password), u["id"])); c.commit()
    return {"ok": True}

@app.get("/api/portal/people")
def portal_people(u=Depends(get_user)):
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    with closing(db()) as c:
        rows = c.execute("SELECT id, email, must_change_pw, invited_at, last_login FROM users WHERE client_id=? ORDER BY created_at", (cid,)).fetchall()
    return [dict(r) for r in rows]

class PersonIn(BaseModel):
    email: EmailStr

@app.post("/api/portal/people")
def portal_add_person(body: PersonIn, background: BackgroundTasks, u=Depends(get_user)):
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    temp = secrets.token_urlsafe(8)
    with closing(db()) as c:
        cl = c.execute("SELECT name, property_address FROM clients WHERE id=?", (cid,)).fetchone()
        try:
            c.execute("INSERT INTO users(email,password_hash,role,client_id,must_change_pw,invited_at) VALUES(?,?,?,?,1,?)",
                      (body.email.lower(), pwd.hash(temp), "client", cid, _now())); c.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(400, "A login with that email already exists")
    background.add_task(_send_invite, str(body.email), temp, (cl["property_address"] or cl["name"]) if cl else None)
    return {"email": body.email, "temp_password": temp, "emailed": True}

@app.post("/api/portal/people/{uid}/delete")
def portal_remove_person(uid: int, u=Depends(get_user)):
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    if uid == u["id"]:
        raise HTTPException(400, "You can’t remove your own login.")
    with closing(db()) as c:
        r = c.execute("SELECT id FROM users WHERE id=? AND client_id=?", (uid, cid)).fetchone()
        if not r:
            raise HTTPException(404, "Not found")
        c.execute("DELETE FROM users WHERE id=?", (uid,)); c.commit()
    return {"ok": True}

@app.get("/api/portal/images")
def portal_images(u=Depends(get_user)):
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    d = os.path.join(UPLOAD_DIR, str(cid)); out = []
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                out.append({"name": fn, "url": f"/uploads/{cid}/{fn}"})
    return out

class FlagIn(BaseModel):
    url: str

@app.post("/api/portal/images/flag")
def portal_flag_image(body: FlagIn, background: BackgroundTasks, u=Depends(get_user)):
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    with closing(db()) as c:
        c.execute("INSERT INTO submissions(client_id,author_email,kind,message,files_json) VALUES(?,?,?,?,?)",
                  (cid, u["email"], "image-removal", body.url, json.dumps([body.url])))
        cl = c.execute("SELECT name FROM clients WHERE id=?", (cid,)).fetchone(); c.commit()
    if ADMIN_EMAIL:
        background.add_task(send_email, ADMIN_EMAIL, f"Image flagged for removal — {cl['name'] if cl else cid}",
                            f"{u['email']} flagged this image for removal:\n{body.url}", u["email"])
    return {"ok": True}

@app.get("/api/clients/{cid}/images")
def admin_client_images(cid: int, _=Depends(require_admin)):
    """Admin/preview: list a client's photo library by id."""
    d = os.path.join(UPLOAD_DIR, str(cid)); out = []
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                out.append({"name": fn, "url": f"/uploads/{cid}/{fn}"})
    return out

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
    det = ('<table role="presentation" cellpadding="0" cellspacing="0" style="background:#F0EBE0;border-radius:8px">'
           '<tr><td style="padding:14px 18px;font-size:14px;color:#14224F;line-height:1.9">'
           f'<b>Name:</b> {_esc(body.name)}<br><b>Email:</b> <a href="mailto:{_esc(body.email)}" style="color:#B7843C">{_esc(body.email)}</a>'
           f'<br><b>Phone:</b> {_esc(body.phone) or "&mdash;"}</td></tr></table>')
    body_html = (f'<p style="margin:0 0 12px">You have a new inquiry from your property site <b>{_esc(dom)}</b>.</p>'
                 + det +
                 '<p style="margin:16px 0 4px"><b>Message</b></p>'
                 f'<p style="margin:0;white-space:pre-wrap">{_esc(body.message)}</p>'
                 '<p style="margin:16px 0 0;font-size:13px;color:#5C6068">Reply directly to this email to reach them.</p>')
    html = _email_shell(f"New inquiry on {dom}", body_html)
    background.add_task(send_email, recipients, f"New inquiry on {dom} — {body.name}", text, body.email, html=html)
    return {"ok": True}

@app.get("/api/public/commission")
def public_commission(domain: str = ""):
    """Live buyer-agent commission for a property, so its plan/brochure can self-update."""
    dom = (domain or "").lower().strip().replace("www.", "")
    pct = ""
    if dom:
        with closing(db()) as c:
            r = c.execute("SELECT commission_pct FROM clients WHERE replace(lower(domain),'www.','')=?", (dom,)).fetchone()
        if r and r["commission_pct"]:
            pct = r["commission_pct"]
    return {"commission_pct": pct or "2.5%"}

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
        if pr.unit_amount == 5900 and pr.recurring and pr.recurring.interval == "month":
            _price_cache["m"] = pr.id; return pr.id
    pr = stripe.Price.create(product=prod.id, unit_amount=5900, currency="usd", recurring={"interval": "month"})
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
        line_items=[{"price_data": {"currency": "usd", "unit_amount": 9900,
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
    first_name: str = Form(""),
    last_name: str = Form(""),
    email: str = Form(...),
    phone: str = Form(""),
    owner_address: str = Form(""),
    owner_city: str = Form(""),
    owner_state: str = Form(""),
    owner_zip: str = Form(""),
    same_as_property: str = Form("yes"),
    prop_address: str = Form(""),
    prop_city: str = Form(""),
    prop_state: str = Form(""),
    prop_zip: str = Form(""),
    property_type: str = Form(""),
    property_subtype: str = Form(""),
    listed_with_agent: str = Form(""),
    listing_ref: str = Form(""),
    price: str = Form(""),
    beds: str = Form(""),
    baths: str = Form(""),
    sqft: str = Form(""),
    lot: str = Form(""),
    year_built: str = Form(""),
    description: str = Form(""),
    accept_terms: str = Form(""),
    files: list[UploadFile] = File(default=[]),
):
    """Public funnel: prospect submits property + photos, then pays the $100 deposit."""
    if accept_terms.lower() not in ("yes", "true", "1"):
        raise HTTPException(400, "Please accept the Terms to continue.")
    name = (first_name.strip() + " " + last_name.strip()).strip() or email
    same = same_as_property.lower() in ("yes", "true", "1")
    pa, pc, ps, pz = (owner_address, owner_city, owner_state, owner_zip) if same else (prop_address, prop_city, prop_state, prop_zip)
    property_address = ", ".join([p for p in [pa.strip(), pc.strip(), (ps + " " + pz).strip()] if p])
    intake = {"property_type": property_type, "property_subtype": property_subtype,
              "listed_with_agent": listed_with_agent, "listing_ref": listing_ref,
              "first_name": first_name, "last_name": last_name,
              "owner_address": {"address": owner_address, "city": owner_city, "state": owner_state, "zip": owner_zip},
              "same_as_property": same,
              "property_address": {"address": pa, "city": pc, "state": ps, "zip": pz},
              "details": {"price": price, "beds": beds, "baths": baths, "sqft": sqft, "lot": lot, "year_built": year_built},
              "description": description}
    scenario = "realtor" if listed_with_agent.lower() in ("yes", "true", "1") else "fsbo"
    with closing(db()) as c:
        cur = c.execute(
            "INSERT INTO clients(name,property_address,email,phone,scenario,status,property_type,intake_json) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (name, property_address, email, phone, scenario, "intake", property_type, json.dumps(intake)))
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
        det = "" if listed_with_agent.lower() in ("yes", "true", "1") else \
            f"Price: {price or 'n/a'} · Beds {beds or '-'} · Baths {baths or '-'} · SqFt {sqft or '-'} · Lot {lot or '-'} · Year {year_built or '-'}\n"
        body = (f"New signup from {name} <{email}> ({phone or 'no phone'}).\n"
                f"Type: {property_type} {property_subtype}\n"
                f"Listed with agent: {listed_with_agent or 'no'}" + (f" — {listing_ref}" if listing_ref else "") + "\n"
                f"Property: {property_address or 'n/a'}\n" + det +
                f"\nWhy they love it:\n{description or '(none)'}\n\n"
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
        line_items=[{"price_data": {"currency": "usd", "unit_amount": 49900,
                     "product_data": {"name": "Misane Properties — Build approval (first 3 months)"}}, "quantity": 1}],
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

@app.get("/api/portal/billing")
def portal_billing(u=Depends(get_user)):
    """What the client sees on their Billing tab: status, next charge date, card on file."""
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    cl = _client_or_404(cid)
    out = {"status": cl.get("status"), "plan_started": cl.get("plan_started"),
           "has_subscription": bool(cl.get("stripe_subscription")),
           "amount": "$59.00 / month", "next_billing_date": None, "card_last4": None}
    if cl.get("stripe_subscription") and stripe.api_key:
        try:
            sub = stripe.Subscription.retrieve(cl["stripe_subscription"], expand=["default_payment_method"])
            out["next_billing_date"] = sub.get("current_period_end")
            out["sub_status"] = sub.get("status")
            pm = sub.get("default_payment_method")
            if pm and pm.get("card"):
                out["card_last4"] = pm["card"]["last4"]
        except Exception as e:
            print("[billing retrieve error]", e)
    return out

@app.post("/api/portal/billing-portal")
def portal_billing_portal(u=Depends(get_user)):
    """Open Stripe's secure customer portal — update card, view invoices, cancel."""
    cid = u.get("client_id")
    if not cid:
        raise HTTPException(403, "No client attached to this login")
    cl = _client_or_404(cid)
    if not cl.get("stripe_customer") or not stripe.api_key:
        raise HTTPException(400, "No billing account yet")
    s = stripe.billing_portal.Session.create(customer=cl["stripe_customer"], return_url=f"{APP_URL}/portal")
    return {"url": s.url}

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
                trial_end=now + 90 * 24 * 3600,        # $59/mo starts after the 3-month period
                cancel_at=now + 365 * 24 * 3600,        # cap at 12 months total
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
