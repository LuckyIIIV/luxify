const Database = require("better-sqlite3");
const db = new Database("data.db");

db.prepare("CREATE TABLE IF NOT EXISTS whitelist (userId TEXT PRIMARY KEY)").run();

module.exports = {
  addUser(userId) {
    db.prepare("INSERT OR IGNORE INTO whitelist (userId) VALUES (?)").run(userId);
  },
  removeUser(userId) {
    db.prepare("DELETE FROM whitelist WHERE userId = ?").run(userId);
  },
  getUsers() {
    return db.prepare("SELECT userId FROM whitelist").all().map(r => r.userId);
  }
};
