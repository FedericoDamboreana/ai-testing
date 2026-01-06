import sqlite3
from app.core import config

def migrate():
    db_path = "test.db" 
    # extract path from config if possible, but for local it's likely test.db or ./test.db
    if "test.db" in config.settings.DATABASE_URL:
        db_path = "test.db"
    
    print(f"Migrating database at {db_path}...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Create User Table
    try:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR NOT NULL UNIQUE,
            full_name VARCHAR,
            hashed_password VARCHAR NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_user_email ON user (email);")
        print("Created user table.")
    except Exception as e:
        print(f"Error creating user table: {e}")

    # 2. Create ProjectMembership Table
    try:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS projectmembership (
            project_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role VARCHAR NOT NULL,
            PRIMARY KEY (project_id, user_id),
            FOREIGN KEY(project_id) REFERENCES project(id),
            FOREIGN KEY(user_id) REFERENCES user(id)
        );
        """)
        print("Created projectmembership table.")
    except Exception as e:
        print(f"Error creating projectmembership table: {e}")

    # 3. Add owner_id to Project
    try:
        # Check if column exists first
        cursor.execute("PRAGMA table_info(project)")
        columns = [info[1] for info in cursor.fetchall()]
        if "owner_id" not in columns:
            cursor.execute("ALTER TABLE project ADD COLUMN owner_id INTEGER REFERENCES user(id);")
            print("Added owner_id to project table.")
        else:
            print("owner_id column already exists.")
    except Exception as e:
        print(f"Error altering project table: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
