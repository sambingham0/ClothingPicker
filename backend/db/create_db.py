import sqlite3

def create_clothing_db():
    conn = sqlite3.connect("clothing.db")
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