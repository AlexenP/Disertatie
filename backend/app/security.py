from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User


security = HTTPBearer(auto_error=False)


DEMO_TOKEN_USERS = {
    "demo-token-admin": {
        "email": "admin@geoestate.ro",
        "full_name": "Administrator GeoEstate",
        "role": "admin",
        "role_name": "Administrator",
        "token": "demo-token-admin",
    },
    "demo-token-agent": {
        "email": "agent@geoestate.ro",
        "full_name": "Agent Imobiliar",
        "role": "agent",
        "role_name": "Agent imobiliar",
        "token": "demo-token-agent",
    },
    "demo-token-manager": {
        "email": "manager@geoestate.ro",
        "full_name": "Manager Portofoliu",
        "role": "manager",
        "role_name": "Manager portofoliu",
        "token": "demo-token-manager",
    },
    "demo-token-developer": {
        "email": "developer@geoestate.ro",
        "full_name": "Dezvoltator Imobiliar",
        "role": "developer",
        "role_name": "Dezvoltator imobiliar",
        "token": "demo-token-developer",
    },
}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Trebuie sa fii autentificat pentru aceasta actiune.",
        )

    token = credentials.credentials.strip()

    if token.startswith("Bearer "):
        token = token.removeprefix("Bearer ").strip()

    token_user = DEMO_TOKEN_USERS.get(token)
    user = None

    if token_user:
        user = db.query(User).filter(User.email == token_user["email"]).first()
    elif token.startswith("demo-token-admin-"):
        user_id = token.removeprefix("demo-token-admin-")

        if user_id.isdigit():
            user = db.query(User).filter(User.id == int(user_id), User.role == "admin").first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Trebuie sa fii autentificat pentru aceasta actiune.",
        )

    portfolio_admin_id = user.id if user.role == "admin" else user.admin_id

    if portfolio_admin_id is None:
        raise HTTPException(
            status_code=403,
            detail="Nu ai permisiunea necesara pentru aceasta actiune.",
        )

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "role_name": user.role_name,
        "admin_id": user.admin_id,
        "portfolio_admin_id": portfolio_admin_id,
        "token": token,
    }


def require_roles(allowed_roles: list[str] | tuple[str, ...]):
    def _dependency(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Nu ai permisiunea necesara pentru aceasta actiune.",
            )

        return current_user

    return _dependency
