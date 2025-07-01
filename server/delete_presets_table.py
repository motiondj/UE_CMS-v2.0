import sqlite3

DB_PATH = 'uecms.db'

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

try:
    cursor.execute('DROP TABLE IF EXISTS presets;')
    conn.commit()
    print('presets 테이블이 성공적으로 삭제되었습니다.')
except Exception as e:
    print('에러 발생:', e)
finally:
    conn.close() 