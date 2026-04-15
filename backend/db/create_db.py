import sqlite3

from app_config import CLOTHING_DB_PATH

def create_clothing_db():
    conn = sqlite3.connect(str(CLOTHING_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clothing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        image_path TEXT,
        color TEXT,
        minor_color TEXT,
        season TEXT,
        occasion TEXT,
        fit TEXT,
        sleeve_length TEXT,
        bottom_style TEXT
    )
    """)
    
    conn.commit()
    conn.close()