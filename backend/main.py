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

@app.post("/api/clients/{cid}/checkout/signup")
def checkout_signup(cid: int, _=Depends(require_admin)):
    _client_or_404(cid)
    s = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"price_data": {"currency": "usd", "unit_amount": 10000,
                     "product_data": {"name": "Misane Properties — Signup deposit"}}, "quantity": 1}],
        success_url=f"{APP_URL}/portal?paid=signup", cancel_url=f"{APP_URL}/portal",
        metadata={"client_id": str(cid), "kind": "signup"},
    )
    return {"url": s.url}

@app.post("/api/clients/{cid}/checkout/approval")
def checkout_approval(cid: int, _=Depends(require_admin)):
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
