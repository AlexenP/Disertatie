from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


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


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    user = DEMO_USERS.get(payload.email)

    if not user or user["password"] != payload.password:
        raise HTTPException(
            status_code=401,
            detail="Email sau parola incorecta."
        )

    return {
        "email": payload.email,
        "full_name": user["full_name"],
        "role": user["role"],
        "role_name": user["role_name"],
        "token": f"demo-token-{user['role']}",
    }


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