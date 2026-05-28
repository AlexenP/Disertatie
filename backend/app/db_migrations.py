from sqlalchemy import text


def _column_exists(connection, table_name: str, column_name: str) -> bool:
    columns = connection.execute(text(f"PRAGMA table_info({table_name})")).mappings().all()
    return any(column["name"] == column_name for column in columns)


def ensure_portfolio_schema(engine):
    with engine.begin() as connection:
        if not _column_exists(connection, "users", "role"):
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR"))
        if not _column_exists(connection, "users", "role_name"):
            connection.execute(text("ALTER TABLE users ADD COLUMN role_name VARCHAR"))
        if not _column_exists(connection, "users", "admin_id"):
            connection.execute(text("ALTER TABLE users ADD COLUMN admin_id INTEGER"))
        if not _column_exists(connection, "users", "created_at"):
            connection.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))
        if not _column_exists(connection, "properties", "owner_admin_id"):
            connection.execute(text("ALTER TABLE properties ADD COLUMN owner_admin_id INTEGER"))

        for role_name in ("admin", "agent", "manager", "developer"):
            exists = connection.execute(
                text("SELECT id FROM roles WHERE name = :name LIMIT 1"),
                {"name": role_name},
            ).scalar()

            if exists is None:
                connection.execute(text("INSERT INTO roles (name) VALUES (:name)"), {"name": role_name})

        connection.execute(text("UPDATE users SET role = 'admin' WHERE role IS NULL OR role = ''"))
        connection.execute(text("UPDATE users SET role_name = 'Administrator' WHERE role_name IS NULL OR role_name = ''"))
        connection.execute(text("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))

        demo_users = [
            ("admin@geoestate.ro", "Administrator GeoEstate", "admin123", "admin", "Administrator", None),
            ("agent@geoestate.ro", "Agent Imobiliar", "agent123", "agent", "Agent imobiliar", "admin"),
            ("manager@geoestate.ro", "Manager Portofoliu", "manager123", "manager", "Manager portofoliu", "admin"),
            (
                "developer@geoestate.ro",
                "Dezvoltator Imobiliar",
                "developer123",
                "developer",
                "Dezvoltator imobiliar",
                "admin",
            ),
        ]

        for email, full_name, password, role, role_name, _admin_marker in demo_users:
            role_id = connection.execute(
                text("SELECT id FROM roles WHERE name = :role LIMIT 1"),
                {"role": role},
            ).scalar()
            exists = connection.execute(
                text("SELECT id FROM users WHERE email = :email LIMIT 1"),
                {"email": email},
            ).scalar()

            if exists is None:
                connection.execute(
                    text(
                        """
                        INSERT INTO users (full_name, email, password_hash, role, role_name, role_id, created_at)
                        VALUES (:full_name, :email, :password_hash, :role, :role_name, :role_id, CURRENT_TIMESTAMP)
                        """
                    ),
                    {
                        "full_name": full_name,
                        "email": email,
                        "password_hash": password,
                        "role": role,
                        "role_name": role_name,
                        "role_id": role_id,
                    },
                )
            else:
                connection.execute(
                    text(
                        """
                        UPDATE users
                        SET full_name = :full_name,
                            password_hash = :password_hash,
                            role = :role,
                            role_name = :role_name,
                            role_id = :role_id
                        WHERE email = :email
                        """
                    ),
                    {
                        "full_name": full_name,
                        "email": email,
                        "password_hash": password,
                        "role": role,
                        "role_name": role_name,
                        "role_id": role_id,
                    },
                )

        admin_id = connection.execute(
            text("SELECT id FROM users WHERE email = 'admin@geoestate.ro' LIMIT 1")
        ).scalar()

        if admin_id is not None:
            connection.execute(
                text("UPDATE users SET admin_id = NULL WHERE id = :admin_id"),
                {"admin_id": admin_id},
            )
            connection.execute(
                text(
                    """
                    UPDATE users
                    SET admin_id = :admin_id
                    WHERE email IN ('agent@geoestate.ro', 'manager@geoestate.ro', 'developer@geoestate.ro')
                    """
                ),
                {"admin_id": admin_id},
            )
            connection.execute(
                text("UPDATE users SET admin_id = :admin_id WHERE role != 'admin' AND admin_id IS NULL"),
                {"admin_id": admin_id},
            )
            connection.execute(
                text("UPDATE properties SET owner_admin_id = :admin_id WHERE owner_admin_id IS NULL"),
                {"admin_id": admin_id},
            )
