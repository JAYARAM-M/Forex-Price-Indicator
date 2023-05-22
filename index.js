const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

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



app.post('/exchange-rate', (req, res) => {
    const { currency_pair } = req.body; // Extract the currency_pair value from the request body
    const requestOptions = {
      method: 'GET',
      url: 'https://api.apilayer.com/exchangerates_data/latest?symbols=inr&base=USD',
     
      headers: {
        'apikey': apiKey,
      },
    };
  
    axios(requestOptions)
      .then(response => {
        const price = response.data?.quotes?.USDINR;
  
        if (price === undefined) {
          res.status(404).json({ message: 'Currency pair not found' });
          return;
        }
  
        db.run('UPDATE alerts SET triggered = 1 WHERE currency_pair = ? AND triggered = 0 AND ? >= desired_rate', [currency_pair, price], function(err) {
          if (err) {
            console.error(err);
            res.sendStatus(500);
          } else {
            res.json({ message: 'Price updated successfully' });
          }
        });
      })
      .catch(error => {
        console.error(error);
        res.sendStatus(500);
      });
  });
  


app.listen(3000, () => {
  console.log('Server started on port 3000');
});
