const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/compliances', require('./routes/compliance'));
app.use('/api/users', require('./routes/user'));
app.use('/api/alertlogs', require('./routes/alertLog'));

app.get('/', (req, res) => res.send('CompliTrack API running'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    require('./utils/scheduler');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('MongoDB error:', err));
