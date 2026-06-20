"""
Misane Properties — Client Portal API (FastAPI + SQLite)
M1 foundation: JWT auth, User + Client models, admin client management.
Later milestones add: intake, photo uploads, preview/approval, Stripe billing.
"""
import os, sqlite3, datetime, json, secrets
from contextlib import closing
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError

# ---- config ----
SECRET_KEY = os.environ.get("MISANE_SECRET", "change-me-in-.env")
ALGO = "HS256"
TOKEN_MINUTES = 480
DB_PATH = os.environ.get("MISANE_DB", os.path.join(os.path.dirname(__file__), "misane.db"))
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Misane Portal API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("MISANE_ORIGINS", "https://app.misaneproperties.com").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

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
            domain TEXT,                          -- their dedicated site, e.g. 3545uniformst.com
            scenario TEXT DEFAULT 'fsbo',         -- 'fsbo' | 'realtor'
            status TEXT DEFAULT 'intake',         -- intake|building|preview|approved|live|maintenance|cancelled
            intake_json TEXT,                     -- answers from the intake form
            commission_pct TEXT,                  -- owner-set buyer-agent %
            stripe_customer TEXT,
            stripe_subscription TEXT,
            plan_started TEXT,                    -- date the $500 was paid (sub anchor)
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

# ---- schemas ----
class LoginIn(BaseModel):
    email: EmailStr
    password: str
class ClientIn(BaseModel):
    name: str
    property_address: str | None = None
    domain: str | None = None
    scenario: str = "fsbo"

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
        out["client"] = dict(cl) if cl else None
    return out

@app.get("/api/clients")
def list_clients(_=Depends(require_admin)):
    with closing(db()) as c:
        rows = c.execute("SELECT * FROM clients ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]

@app.post("/api/clients")
def create_client(body: ClientIn, _=Depends(require_admin)):
    with closing(db()) as c:
        cur = c.execute("INSERT INTO clients(name,property_address,domain,scenario) VALUES(?,?,?,?)",
                        (body.name, body.property_address, body.domain, body.scenario))
        c.commit()
        cid = cur.lastrowid
    return {"id": cid}

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
    return {"email": email, "temp_password": temp}  # TODO M3: email this automatically
