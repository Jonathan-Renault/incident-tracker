// server.js
import express from 'express';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'incident.db');

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY,
    last_incident TEXT NOT NULL
  )
`);

const app = express();
app.use(express.json());

app.get('/api/status', (req, res) => {
  const row = db.prepare('SELECT last_incident FROM incidents WHERE id = 1').get();
  res.json({ last_incident: row?.last_incident ?? null });
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
}

export default app;
