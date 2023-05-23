const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const fetch = require('node-fetch');

const app = express();
const apiKey = '5Cdb2b8gGLpPKHrAbcyd6u23cuIUMQV4';
const db = new sqlite3.Database(':memory:'); // You can specify a file path for a persistent database

app.use(bodyParser.json());

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, currency_pair TEXT NOT NULL, desired_rate REAL NOT NULL, triggered INTEGER DEFAULT 0)');
});

app.get('/alerts', (req, res) => {
  db.all('SELECT * FROM alerts', (err, rows) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    } else {
      res.json({ alerts: rows });
    }
  });
});

app.post('/alerts', (req, res) => {
  const { currency_pair, desired_rate } = req.body;
  db.run('INSERT INTO alerts (currency_pair, desired_rate) VALUES (?, ?)', [currency_pair, desired_rate], function(err) {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    } else {
      res.json({ message: `Alert ${this.lastID} created successfully` });
    }
  });
});

app.get('/alerts/:alert_id', (req, res) => {
  const { alert_id } = req.params;
  db.get('SELECT * FROM alerts WHERE id = ?', [alert_id], (err, row) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    } else if (row) {
      res.json({ alert: row });
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  });
});

app.delete('/alerts/:alert_id', (req, res) => {
  const { alert_id } = req.params;
  db.run('DELETE FROM alerts WHERE id = ?', [alert_id], function(err) {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    } else if (this.changes > 0) {
      res.json({ message: `Alert ${alert_id} deleted successfully` });
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  });
});

app.post('/exchange-rates', async (req, res) => {
  try {
    const url = 'https://api.apilayer.com/exchangerates_data/latest';
    const symbols = req.body.symbols;
    const base = req.body.base;

    const requestOptions = {
      method: 'GET',
      headers: { 'apikey': apiKey }
    };

    const response = await fetch(`${url}?symbols=${symbols}&base=${base}`, requestOptions);
    const result = await response.json();

    if (result.success && result.rates && result.rates[symbols]) {
      const rate = result.rates[symbols];
      
      db.all('SELECT * FROM alerts WHERE currency_pair = ? AND triggered = 0', symbols, function(err, rows) {
        if (err) {
          console.error(err);
          res.sendStatus(500);
        } else {
          rows.forEach(row => {
            if (rate < row.desired_rate) {
              db.run('UPDATE alerts SET triggered = 1 WHERE id = ?', row.id, function(err) {
                if (err) {
                  console.error(err);
                  res.sendStatus(500);
                }
              });
            }
          });
          res.json({ message: 'Price updated successfully' });
        }
      });
    } else {
      res.status(500).send('Unable to retrieve exchange rate');
    }
  } catch (error) {
    console.log('error', error);
    res.status(500).send('An error occurred');
  }
});




app.listen(3000, () => {
  console.log('Server started on port 3000');
});
