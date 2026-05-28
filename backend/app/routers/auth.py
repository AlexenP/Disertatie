from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Role, User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str


class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str
    confirm_password: str


class LoginResponse(BaseModel):
    email: str
    full_name: str
    role: str
    role_name: str
    token: str


DEMO_USERS = {
    "admin@geoestate.ro": {
        "password": "admin123",
        "full_name": "Administrator GeoEstate",
        "role": "admin",
        "role_name": "Administrator",
    },
    "agent@geoestate.ro": {
        "password": "agent123",
        "full_name": "Agent Imobiliar",
        "role": "agent",
        "role_name": "Agent imobiliar",
    },
    "manager@geoestate.ro": {
        "password": "manager123",
        "full_name": "Manager Portofoliu",
        "role": "manager",
        "role_name": "Manager portofoliu",
    },
    "developer@geoestate.ro": {
        "password": "developer123",
        "full_name": "Dezvoltator Imobiliar",
        "role": "developer",
        "role_name": "Dezvoltator imobiliar",
    },
}


def normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    db_user = db.query(User).filter(User.email == email).first()

    if not db_user or db_user.password_hash != payload.password:
        raise HTTPException(
            status_code=401,
            detail="Email sau parola incorecta."
        )

    if email in DEMO_USERS:
        token = f"demo-token-{db_user.role}"
    elif db_user.role == "admin":
        token = f"demo-token-admin-{db_user.id}"
    else:
        token = f"demo-token-user-{db_user.id}"

    return {
        "email": email,
        "full_name": db_user.full_name,
        "role": db_user.role,
        "role_name": db_user.role_name,
        "token": token,
    }


@router.post("/register", response_model=LoginResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    full_name = payload.full_name.strip()

    if not full_name:
        raise HTTPException(status_code=400, detail="Numele complet este obligatoriu.")

    if not email:
        raise HTTPException(status_code=400, detail="Emailul este obligatoriu.")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Exista deja un cont cu acest email.")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie sa aiba minimum 6 caractere.")

    admin_role = db.query(Role).filter(Role.name == "admin").first()

    if not admin_role:
        admin_role = Role(name="admin")
        db.add(admin_role)
        db.flush()

    user = User(
        full_name=full_name,
        email=email,
        password_hash=payload.password,
        role="admin",
        role_name="Administrator",
        role_id=admin_role.id,
        admin_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "email": email,
        "full_name": full_name,
        "role": "admin",
        "role_name": "Administrator",
        "token": f"demo-token-admin-{user.id}",
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="Emailul nu exista.")

    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Parolele nu coincid.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie sa aiba minimum 6 caractere.")

    user.password_hash = payload.new_password
    db.commit()

    return {"message": "Parola a fost resetata cu succes."}


@router.get("/me", response_model=LoginResponse)
def me(token: str):
    for email, user in DEMO_USERS.items():
        expected_token = f"demo-token-{user['role']}"

        if token == expected_token:
            return {
                "email": email,
                "full_name": user["full_name"],
                "role": user["role"],
                "role_name": user["role_name"],
                "token": token,
            }

    raise HTTPException(
        status_code=401,
        detail="Sesiune invalida. Autentifica-te din nou."
    )
