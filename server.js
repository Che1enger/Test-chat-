require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 5000;
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://yasprimorki:tg4QMgex0i9fWhC2@cluster0.f4fu5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

let db;

// Connect to MongoDB
MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  .then((client) => {
    console.log('Connected to MongoDB');
    db = client.db();
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1); // Exit the process if DB connection fails
  });

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await db.collection('users').findOne({ username });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      console.error('Error in authentication:', err);
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.collection('users').findOne({ _id: id });
    done(null, user);
  } catch (err) {
    console.error('Error during deserialization:', err);
    done(err);
  }
});

// Routes
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({ username, password: hashedPassword });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/login', passport.authenticate('local'), (req, res) => {
  res.json({ message: 'Logged in successfully', user: req.user.username });
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// WebSocket handling
const onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log('A user connected');

  let currentUser = null;

  socket.on('user joined', (username) => {
    currentUser = username;
    onlineUsers.add(username);
    socket.broadcast.emit('user joined', username);
    io.emit('user status', Array.from(onlineUsers));

    // Send message history to the newly connected client
    db.collection('messages')
      .find()
      .sort({ _id: -1 })
      .limit(50)
      .toArray()
      .then((messages) => {
        socket.emit('message history', messages.reverse());
      })
      .catch((err) => {
        console.error('Error retrieving message history:', err);
        socket.emit('error', 'Could not load message history.');
      });
  });

  socket.on('chat message', (msg) => {
    const message = {
      user: msg.user,
      content: msg.content,
      timestamp: new Date()
    };

    // Save message to database
    db.collection('messages').insertOne(message)
      .then(() => {
        io.emit('chat message', message);
      })
      .catch((err) => {
        console.error('Error saving message:', err);
        socket.emit('error', 'Message could not be saved.');
      });
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('typing', username);
  });

  socket.on('stop typing', (username) => {
    socket.broadcast.emit('stop typing', username);
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      onlineUsers.delete(currentUser);
      io.emit('user left', currentUser);
      io.emit('user status', Array.from(onlineUsers));
    }
    console.log('User disconnected');
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
