from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Role, User
from app.security import require_roles

router = APIRouter(prefix="/users", tags=["users"])

HELPER_ROLES = {"agent", "manager", "developer"}
ROLE_LABELS = {
    "agent": "Agent imobiliar",
    "manager": "Manager portofoliu",
    "developer": "Dezvoltator imobiliar",
}


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: str


def normalize_email(email: str) -> str:
    return email.strip().lower()


def serialize_user(user: User):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "role_name": user.role_name,
        "admin_id": user.admin_id,
        "created_at": user.created_at,
    }


def get_or_create_role(db: Session, role_name: str) -> Role:
    role = db.query(Role).filter(Role.name == role_name).first()

    if role:
        return role

    role = Role(name=role_name)
    db.add(role)
    db.flush()
    return role


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(("admin",))),
):
    users = (
        db.query(User)
        .filter(User.admin_id == current_user["id"], User.role.in_(HELPER_ROLES))
        .order_by(User.id.asc())
        .all()
    )

    return [serialize_user(user) for user in users]


@router.post("")
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(("admin",))),
):
    full_name = payload.full_name.strip()
    email = normalize_email(payload.email)
    role_name = payload.role.strip().lower()

    if not full_name:
        raise HTTPException(status_code=400, detail="Numele complet este obligatoriu.")

    if not email:
        raise HTTPException(status_code=400, detail="Emailul este obligatoriu.")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie sa aiba minimum 6 caractere.")

    if role_name not in HELPER_ROLES:
        raise HTTPException(status_code=400, detail="Rolul poate fi doar agent, manager sau developer.")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Exista deja un cont cu acest email.")

    role = get_or_create_role(db, role_name)
    user = User(
        full_name=full_name,
        email=email,
        password_hash=payload.password,
        role=role_name,
        role_name=ROLE_LABELS[role_name],
        role_id=role.id,
        admin_id=current_user["id"],
        created_at=datetime.utcnow(),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return serialize_user(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(("admin",))),
):
    user = (
        db.query(User)
        .filter(User.id == user_id, User.admin_id == current_user["id"], User.role.in_(HELPER_ROLES))
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Utilizatorul nu exista in portofoliul tau.")

    db.delete(user)
    db.commit()

    return {"message": "Utilizator sters"}
