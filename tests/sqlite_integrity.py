"""Isolated SQLite integration test for schema/provenance/atomicity, no production data."""
import sqlite3,pathlib
c=sqlite3.connect(':memory:');c.execute('PRAGMA foreign_keys=ON')
for p in sorted(pathlib.Path('drizzle').glob('*.sql')): c.executescript(p.read_text())
try:
 c.execute("INSERT INTO evidence(id,assertion_id,source_id,revision_id,quote,start,end,kind) VALUES('test','missing','s','r','test evidence',0,13,'test')")
 raise AssertionError('Missing provenance accepted')
except sqlite3.IntegrityError: pass
c.execute("INSERT INTO sources(id,provider,external_id,title,domain,created_at,updated_at) VALUES('s','test','one','Synthetic fixture','PROFESSIONAL','2026-01-01','2026-01-01')")
try:
 c.execute("INSERT INTO sources(id,provider,external_id,title,domain,created_at,updated_at) VALUES('s2','test','one','Duplicate','PROFESSIONAL','2026-01-01','2026-01-01')")
 raise AssertionError('Duplicate source accepted')
except sqlite3.IntegrityError: pass
assert not list(c.execute('PRAGMA foreign_key_check'))
plan=list(c.execute("EXPLAIN QUERY PLAN SELECT * FROM assertions WHERE subject='test' ORDER BY valid_from"))
assert any('assertion_subject' in str(r) for r in plan),plan
print('Schema, foreign keys, source identity and graph index checks passed')
