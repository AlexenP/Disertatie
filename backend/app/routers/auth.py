from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
def login(payload: LoginRequest):
    email = normalize_email(payload.email)
    user = DEMO_USERS.get(email)

    if not user or user["password"] != payload.password:
        raise HTTPException(
            status_code=401,
            detail="Email sau parola incorecta."
        )

    return {
        "email": email,
        "full_name": user["full_name"],
        "role": user["role"],
        "role_name": user["role_name"],
        "token": f"demo-token-{user['role']}",
    }


@router.post("/register", response_model=LoginResponse)
def register(payload: RegisterRequest):
    email = normalize_email(payload.email)
    full_name = payload.full_name.strip()

    if not full_name:
        raise HTTPException(status_code=400, detail="Numele complet este obligatoriu.")

    if not email:
        raise HTTPException(status_code=400, detail="Emailul este obligatoriu.")

    if email in DEMO_USERS:
        raise HTTPException(status_code=400, detail="Exista deja un cont cu acest email.")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie sa aiba minimum 6 caractere.")

    DEMO_USERS[email] = {
        "password": payload.password,
        "full_name": full_name,
        "role": "admin",
        "role_name": "Administrator",
    }

    return {
        "email": email,
        "full_name": full_name,
        "role": "admin",
        "role_name": "Administrator",
        "token": "demo-token-admin",
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    email = normalize_email(payload.email)
    user = DEMO_USERS.get(email)

    if not user:
        raise HTTPException(status_code=404, detail="Emailul nu exista.")

    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Parolele nu coincid.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie sa aiba minimum 6 caractere.")

    user["password"] = payload.new_password

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
