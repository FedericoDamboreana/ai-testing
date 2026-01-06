import sqlite3
import sys
import os

def migrate(db_path):
    print(f"Migrating database at {db_path}...")
    
    if not os.path.exists(db_path):
        print(f"Error: Database file {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Create User Table (if not exists)
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
        print("Ensured user table exists.")
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
        print("Ensured projectmembership table exists.")
    except Exception as e:
        print(f"Error creating projectmembership table: {e}")

    # 3. Add owner_id to Project
    try:
        cursor.execute("PRAGMA table_info(project)")
        columns = [info[1] for info in cursor.fetchall()]
        if "owner_id" not in columns:
            cursor.execute("ALTER TABLE project ADD COLUMN owner_id INTEGER REFERENCES user(id);")
            print("Added owner_id to project table.")
        else:
            print("owner_id column already exists in project.")
    except Exception as e:
        print(f"Error altering project table: {e}")

    # 4. Add preferred_model to User
    try:
        cursor.execute("PRAGMA table_info(user)")
        columns = [info[1] for info in cursor.fetchall()]
        if "preferred_model" not in columns:
            cursor.execute("ALTER TABLE user ADD COLUMN preferred_model VARCHAR DEFAULT 'gpt-5';")
            print("Added preferred_model to user table.")
        else:
            print("preferred_model column already exists in user.")
        
        if "profile_picture_url" not in columns:
            cursor.execute("ALTER TABLE user ADD COLUMN profile_picture_url VARCHAR;")
            print("Added profile_picture_url to user table.")
        else:
            print("profile_picture_url column already exists in user.")
    except Exception as e:
        print(f"Error altering user table: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_prod_full.py <path_to_db>")
    else:
        migrate(sys.argv[1])
