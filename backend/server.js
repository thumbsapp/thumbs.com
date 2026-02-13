const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// ============ SECURITY & MIDDLEWARE ============
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// ============ DATABASE CONNECTION ============
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thumbsapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ============ FILE UPLOAD CONFIG ============
// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg)'));
  }
});

// ============ SCHEMAS ============
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true, trim: true },
  avatar: { type: String, default: '' },
  country: { type: String, default: 'US', uppercase: true, maxlength: 2 },
  bio: { type: String, default: '', maxlength: 500 },
  
  // Reputation system
  reputation: { type: Number, default: 4.5, min: 0, max: 5 },
  totalReputation: { type: Number, default: 4.5 },
  reviewCount: { type: Number, default: 1 },
  isVerified: { type: Boolean, default: false },
  
  // Stats
  chartsCreated: { type: Number, default: 0 },
  chartsWon: { type: Number, default: 0 },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Financial
  balance: { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
  totalSupported: { type: Number, default: 0, min: 0 },
  
  // Achievements & Status
  achievements: [{
    id: String,
    name: String,
    description: String,
    earnedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['online', 'offline', 'in-game', 'away'], default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  deviceToken: { type: String }, // For push notifications
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Chart/Challenge Schema
const ChartSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  game: { type: String, required: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  
  // Financial
  entryFee: { type: Number, required: true, min: 0, default: 10 },
  prize: { type: Number, default: 0, min: 0 },
  prizePool: { type: Number, default: 0, min: 0 },
  prizeItem: {
    name: String,
    type: { type: String, enum: ['nft', 'badge', 'title', 'physical'] },
    value: Number,
    image: String
  },
  
  // Status
  status: { type: String, enum: ['open', 'in-progress', 'completed', 'cancelled'], default: 'open' },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    score: { type: Number, default: 0 },
    moves: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'active', 'completed', 'withdrawn'], default: 'pending' }
  }],
  maxParticipants: { type: Number, default: 2, min: 2, max: 8 },
  minParticipants: { type: Number, default: 2 },
  timeLimit: { type: Number, default: 5, min: 1, max: 60 }, // minutes
  startsAt: { type: Date, default: () => Date.now() + 5 * 60000 },
  endsAt: { type: Date },
  
  // Engagement
  shoutouts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shoutout' }],
  donations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Donation' }],
  totalShoutouts: { type: Number, default: 0 },
  totalDonations: { type: Number, default: 0, min: 0 },
  views: { type: Number, default: 0 },
  uniqueViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Metadata
  tags: [{ type: String, trim: true, lowercase: true }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Shoutout Schema
const ShoutoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chart: { type: mongoose.Schema.Types.ObjectId, ref: 'Chart', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, default: '', maxlength: 280 },
  amount: { type: Number, default: 0, min: 0 },
  reputationBoost: { type: Number, default: 0.05 },
  createdAt: { type: Date, default: Date.now }
});

// Donation Schema
const DonationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chart: { type: mongoose.Schema.Types.ObjectId, ref: 'Chart', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  message: { type: String, default: '', maxlength: 280 },
  status: { type: String, enum: ['pending', 'completed', 'refunded', 'failed'], default: 'pending' },
  transactionId: { type: String, unique: true, sparse: true },
  paymentMethod: { type: String, enum: ['balance', 'credit', 'crypto'], default: 'balance' },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Arena Schema (Live matches)
const ArenaSchema = new mongoose.Schema({
  chart: { type: mongoose.Schema.Types.ObjectId, ref: 'Chart', required: true },
  players: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: { type: Number, default: 0 },
    moves: { type: Number, default: 0 },
    status: { type: String, enum: ['waiting', 'playing', 'finished', 'disconnected'], default: 'waiting' },
    joinedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['waiting', 'live', 'paused', 'finished'], default: 'waiting' },
  currentRound: { type: Number, default: 1 },
  totalRounds: { type: Number, default: 3 },
  spectators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now }
  }],
  chat: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true },
    type: { type: String, enum: ['user', 'system', 'advisor'], default: 'user' },
    createdAt: { type: Date, default: Date.now }
  }],
  gameState: { type: Object }, // Store game-specific state
  startedAt: { type: Date },
  endedAt: { type: Date },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['deposit', 'withdrawal', 'entry_fee', 'prize', 'donation', 'shoutout', 'refund', 'bonus'],
    required: true 
  },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true },
  reference: { type: String }, // Reference ID (chart, donation, etc.)
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  metadata: { type: Object },
  createdAt: { type: Date, default: Date.now }
});

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { 
    type: String, 
    enum: ['shoutout', 'donation', 'chart_joined', 'chart_completed', 'arena_invite', 
           'follow', 'achievement', 'system', 'match_start', 'prize_won'],
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Object },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Message Schema (DMs)
const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model('User', UserSchema);
const Chart = mongoose.model('Chart', ChartSchema);
const Shoutout = mongoose.model('Shoutout', ShoutoutSchema);
const Donation = mongoose.model('Donation', DonationSchema);
const Arena = mongoose.model('Arena', ArenaSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const Message = mongoose.model('Message', MessageSchema);

// ============ JWT MIDDLEWARE ============
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'NO_TOKEN'
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'thumbsapp-secret-key', (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(403).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    req.user = decoded;
    next();
  });
};

// ============ WEBSOCKET SERVER ============
const connectedClients = new Map(); // userId -> { ws, arenas }

wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection');
  
  ws.isAlive = true;
  ws.arenas = new Set();
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'auth':
          try {
            const decoded = jwt.verify(message.token, process.env.JWT_SECRET || 'thumbsapp-secret-key');
            ws.userId = decoded.id;
            ws.user = decoded;
            
            // Store connection
            connectedClients.set(decoded.id, {
              ws,
              userId: decoded.id,
              arenas: new Set(),
              connectedAt: Date.now()
            });
            
            // Update user status
            await User.findByIdAndUpdate(decoded.id, { 
              status: 'online', 
              lastSeen: Date.now() 
            });
            
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              userId: decoded.id,
              timestamp: Date.now()
            }));
            
            // Broadcast user online status
            broadcastToAll({
              type: 'user_status',
              userId: decoded.id,
              status: 'online'
            }, decoded.id);
            
          } catch (err) {
            ws.send(JSON.stringify({ 
              type: 'auth_error', 
              error: 'Invalid token',
              timestamp: Date.now()
            }));
          }
          break;
          
        case 'join_arena':
          const { arenaId } = message;
          
          if (!ws.userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
            break;
          }
          
          ws.arenas.add(arenaId);
          
          // Add to arena spectators
          await Arena.findByIdAndUpdate(arenaId, {
            $addToSet: { spectators: { user: ws.userId, joinedAt: Date.now() } }
          });
          
          // Get user info
          const user = await User.findById(ws.userId).select('username displayName avatar');
          
          // Broadcast to arena
          broadcastToArena(arenaId, {
            type: 'spectator_joined',
            userId: ws.userId,
            user,
            arenaId,
            timestamp: Date.now()
          }, ws.userId);
          
          // Send current arena state
          const arenaState = await Arena.findById(arenaId)
            .populate('players.user', 'username displayName avatar reputation')
            .populate('spectators.user', 'username displayName avatar');
          
          ws.send(JSON.stringify({
            type: 'arena_state',
            arena: arenaState,
            timestamp: Date.now()
          }));
          break;
          
        case 'arena_chat':
          const { arenaId: chatArenaId, message: chatMessage } = message;
          
          if (!ws.userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
            break;
          }
          
          const arena = await Arena.findById(chatArenaId);
          if (arena) {
            const chatEntry = {
              user: ws.userId,
              message: chatMessage.substring(0, 280),
              type: 'user',
              createdAt: new Date()
            };
            
            arena.chat.push(chatEntry);
            arena.updatedAt = Date.now();
            await arena.save();
            
            // Populate user info
            const chatUser = await User.findById(ws.userId).select('username displayName avatar');
            
            broadcastToArena(chatArenaId, {
              type: 'arena_chat',
              arenaId: chatArenaId,
              chat: { ...chatEntry, user: chatUser },
              timestamp: Date.now()
            });
          }
          break;
          
        case 'update_score':
          const { arenaId: scoreArenaId, playerId, score, moves } = message;
          
          if (!ws.userId) break;
          
          // Verify user is a player in this arena
          const scoreArena = await Arena.findOne({
            _id: scoreArenaId,
            'players.user': ws.userId
          });
          
          if (scoreArena) {
            const update = { 'players.$.score': score };
            if (moves !== undefined) update['players.$.moves'] = moves;
            
            await Arena.updateOne(
              { _id: scoreArenaId, 'players.user': playerId },
              { $set: update, $set: { updatedAt: Date.now() } }
            );
            
            broadcastToArena(scoreArenaId, {
              type: 'score_update',
              arenaId: scoreArenaId,
              playerId,
              score,
              moves,
              timestamp: Date.now()
            });
            
            // Check for win condition
            const updatedArena = await Arena.findById(scoreArenaId).populate('chart');
            const winScore = updatedArena.chart?.winScore || 100;
            
            if (score >= winScore) {
              // Auto-complete arena
              await completeArena(scoreArenaId, playerId);
            }
          }
          break;
          
        case 'leave_arena':
          if (ws.userId && ws.arenas.size > 0) {
            for (const arenaId of ws.arenas) {
              await Arena.findByIdAndUpdate(arenaId, {
                $pull: { spectators: { user: ws.userId } }
              });
              
              broadcastToArena(arenaId, {
                type: 'spectator_left',
                userId: ws.userId,
                arenaId,
                timestamp: Date.now()
              });
            }
            ws.arenas.clear();
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Failed to process message',
        timestamp: Date.now()
      }));
    }
  });
  
  ws.on('close', async () => {
    console.log('🔌 WebSocket disconnected');
    
    if (ws.userId) {
      // Remove from connected clients
      connectedClients.delete(ws.userId);
      
      // Update user status
      await User.findByIdAndUpdate(ws.userId, {
        status: 'offline',
        lastSeen: Date.now()
      });
      
      // Broadcast offline status
      broadcastToAll({
        type: 'user_status',
        userId: ws.userId,
        status: 'offline',
        timestamp: Date.now()
      }, ws.userId);
      
      // Remove from all arenas
      if (ws.arenas.size > 0) {
        for (const arenaId of ws.arenas) {
          await Arena.findByIdAndUpdate(arenaId, {
            $pull: { spectators: { user: ws.userId } }
          });
          
          broadcastToArena(arenaId, {
            type: 'spectator_left',
            userId: ws.userId,
            arenaId,
            timestamp: Date.now()
          });
        }
      }
    }
  });
});

// Heartbeat to keep connections alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// Helper: Broadcast to all clients in an arena
async function broadcastToArena(arenaId, message, excludeUserId = null) {
  const arena = await Arena.findById(arenaId).populate('spectators.user');
  
  if (!arena) return;
  
  const messageStr = JSON.stringify(message);
  
  arena.spectators.forEach(({ user }) => {
    if (user && user._id.toString() !== excludeUserId) {
      const client = connectedClients.get(user._id.toString());
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  });
  
  // Also send to players
  arena.players.forEach(({ user }) => {
    if (user && user._id.toString() !== excludeUserId) {
      const client = connectedClients.get(user._id.toString());
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  });
}

// Helper: Broadcast to all connected clients
function broadcastToAll(message, excludeUserId = null) {
  const messageStr = JSON.stringify(message);
  
  connectedClients.forEach((client, userId) => {
    if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// Helper: Complete arena and distribute prizes
async function completeArena(arenaId, winnerId) {
  try {
    const arena = await Arena.findById(arenaId).populate('chart');
    if (!arena || arena.status === 'finished') return;
    
    arena.status = 'finished';
    arena.endedAt = new Date();
    arena.winner = winnerId;
    await arena.save();
    
    // Update chart
    const chart = await Chart.findById(arena.chart._id);
    chart.status = 'completed';
    chart.winner = winnerId;
    chart.endsAt = new Date();
    await chart.save();
    
    // Calculate prize
    const totalPrize = chart.entryFee * chart.participants.length;
    
    // Award winner
    const winner = await User.findById(winnerId);
    winner.balance += totalPrize;
    winner.totalEarned += totalPrize;
    winner.chartsWon += 1;
    await winner.save();
    
    // Record transaction
    const transaction = new Transaction({
      user: winnerId,
      type: 'prize',
      amount: totalPrize,
      balance: winner.balance,
      reference: chart._id,
      description: `Winner prize for: ${chart.title}`,
      status: 'completed'
    });
    await transaction.save();
    
    // Notify participants
    for (const participant of arena.players) {
      if (participant.user.toString() !== winnerId) {
        const notification = new Notification({
          user: participant.user,
          type: 'chart_completed',
          title: '🏆 Chart Completed',
          message: `${chart.title} has ended. ${winner.displayName} won ${totalPrize} THB!`,
          data: { chartId: chart._id, winnerId, prize: totalPrize }
        });
        await notification.save();
        
        // Send real-time notification
        const client = connectedClients.get(participant.user.toString());
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'notification',
            notification
          }));
        }
      }
    }
    
    // Broadcast arena completion
    broadcastToArena(arenaId, {
      type: 'arena_completed',
      arenaId,
      winnerId,
      prize: totalPrize,
      timestamp: Date.now()
    });
    
    return { winner, prize: totalPrize };
  } catch (error) {
    console.error('Error completing arena:', error);
    throw error;
  }
}

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    connections: connectedClients.size
  });
});

// ============ AUTH ROUTES ============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName, country } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (!/^\w+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] 
    });
    
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      displayName: displayName || username,
      country: country || 'US',
      reputation: 4.5,
      totalReputation: 4.5,
      reviewCount: 1,
      balance: 100 // Welcome bonus
    });
    
    await user.save();
    
    // Create welcome transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'bonus',
      amount: 100,
      balance: 100,
      description: 'Welcome bonus',
      status: 'completed'
    });
    await transaction.save();
    
    // Create token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || 'thumbsapp-secret-key',
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        country: user.country,
        reputation: user.reputation,
        isVerified: user.isVerified,
        balance: user.balance,
        chartsCreated: user.chartsCreated,
        chartsWon: user.chartsWon
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update status
    user.status = 'online';
    user.lastSeen = Date.now();
    await user.save();
    
    // Create token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || 'thumbsapp-secret-key',
      { expiresIn: '30d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        country: user.country,
        reputation: user.reputation,
        isVerified: user.isVerified,
        chartsCreated: user.chartsCreated,
        chartsWon: user.chartsWon,
        followers: user.followers.length,
        following: user.following.length,
        balance: user.balance,
        totalEarned: user.totalEarned,
        totalSupported: user.totalSupported,
        achievements: user.achievements
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('followers', 'username displayName avatar reputation isVerified')
      .populate('following', 'username displayName avatar reputation isVerified');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      status: 'offline',
      lastSeen: Date.now()
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ============ USER ROUTES ============
app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -email')
      .populate('followers', 'username displayName avatar reputation isVerified')
      .populate('following', 'username displayName avatar reputation isVerified')
      .populate('achievements');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user stats
    const chartsCreated = await Chart.countDocuments({ creator: user._id });
    const chartsWon = await Chart.countDocuments({ winner: user._id });
    const activeCharts = await Chart.countDocuments({ 
      creator: user._id, 
      status: { $in: ['open', 'in-progress'] } 
    });
    
    const totalDonations = await Donation.aggregate([
      { $match: { recipient: user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const recentAchievements = user.achievements.slice(-5);
    
    res.json({
      ...user.toObject(),
      stats: {
        chartsCreated,
        chartsWon,
        activeCharts,
        winRate: chartsCreated > 0 ? (chartsWon / chartsCreated * 100).toFixed(1) : 0,
        totalSupported: totalDonations[0]?.total || 0,
        totalEarned: user.totalEarned,
        followerCount: user.followers.length,
        followingCount: user.following.length
      },
      recentAchievements
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.put('/api/users/profile', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { displayName, bio, country } = req.body;
    const updateData = { updatedAt: Date.now() };
    
    if (displayName) updateData.displayName = displayName.trim();
    if (bio !== undefined) updateData.bio = bio.trim().substring(0, 500);
    if (country) updateData.country = country.toUpperCase().substring(0, 2);
    if (req.file) {
      // Delete old avatar if exists
      const oldUser = await User.findById(req.user.id);
      if (oldUser.avatar) {
        const oldPath = oldUser.avatar.replace('/uploads/', 'uploads/');
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      updateData.avatar = `/uploads/${req.file.filename}`;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    const userToFollow = await User.findById(req.params.userId);
    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already following
    if (userToFollow.followers.includes(req.user.id)) {
      return res.status(400).json({ error: 'Already following this user' });
    }
    
    // Add follower
    await User.findByIdAndUpdate(req.params.userId, {
      $addToSet: { followers: req.user.id }
    });
    
    // Add to following
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { following: req.params.userId }
    });
    
    // Get current user info for notification
    const currentUser = await User.findById(req.user.id).select('username displayName');
    
    // Create notification
    const notification = new Notification({
      user: req.params.userId,
      type: 'follow',
      title: '👋 New Follower',
      message: `${currentUser.displayName} started following you`,
      data: { followerId: req.user.id, followerName: currentUser.displayName }
    });
    await notification.save();
    
    // Send real-time notification
    const client = connectedClients.get(req.params.userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'notification',
        notification
      }));
    }
    
    res.json({ 
      success: true,
      followerCount: userToFollow.followers.length + 1
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

app.delete('/api/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { followers: req.user.id }
    });
    
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { following: req.params.userId }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// ============ CHART ROUTES ============
app.post('/api/charts', authenticateToken, async (req, res) => {
  try {
    const {
      title, description, game, difficulty,
      entryFee, prize, prizeItem, maxParticipants,
      timeLimit, tags, minParticipants
    } = req.body;
    
    // Validation
    if (!title || !game) {
      return res.status(400).json({ error: 'Title and game are required' });
    }
    
    if (entryFee < 0) {
      return res.status(400).json({ error: 'Entry fee cannot be negative' });
    }
    
    if (maxParticipants < 2 || maxParticipants > 8) {
      return res.status(400).json({ error: 'Max participants must be between 2 and 8' });
    }
    
    // Check balance
    const user = await User.findById(req.user.id);
    if (user.balance < entryFee) {
      return res.status(400).json({ error: 'Insufficient balance to create chart' });
    }
    
    // Deduct entry fee
    user.balance -= entryFee;
    await user.save();
    
    // Record transaction
    const transaction = new Transaction({
      user: req.user.id,
      type: 'entry_fee',
      amount: -entryFee,
      balance: user.balance,
      reference: 'chart_creation',
      description: `Created chart: ${title}`,
      status: 'completed'
    });
    await transaction.save();
    
    const chart = new Chart({
      creator: req.user.id,
      title: title.trim(),
      description: description?.trim() || '',
      game,
      difficulty: difficulty || 'intermediate',
      entryFee,
      prize: prize || entryFee * 2,
      prizePool: entryFee * 2,
      prizeItem,
      maxParticipants: maxParticipants || 2,
      minParticipants: minParticipants || 2,
      timeLimit: timeLimit || 5,
      tags: tags || [],
      startsAt: new Date(Date.now() + 5 * 60000), // Start in 5 minutes
      participants: [{
        user: req.user.id,
        joinedAt: new Date(),
        status: 'active'
      }]
    });
    
    await chart.save();
    
    // Update user stats
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { chartsCreated: 1 }
    });
    
    res.status(201).json(chart);
  } catch (error) {
    console.error('Create chart error:', error);
    res.status(500).json({ error: 'Failed to create chart' });
  }
});

app.get('/api/charts/feed', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'open', 
      difficulty,
      game,
      sort = 'latest'
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (status) query.status = status;
    if (difficulty) query.difficulty = difficulty;
    if (game) query.game = game;
    
    // Filter out expired charts
    if (status === 'open') {
      query.startsAt = { $gte: new Date() };
    }
    
    let sortOption = { createdAt: -1 };
    if (sort === 'popular') {
      sortOption = { views: -1 };
    } else if (sort === 'prize') {
      sortOption = { prizePool: -1 };
    } else if (sort === 'entry') {
      sortOption = { entryFee: 1 };
    }
    
    const charts = await Chart.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('creator', 'username displayName avatar country reputation isVerified')
      .populate('participants.user', 'username displayName avatar');
    
    const total = await Chart.countDocuments(query);
    
    // Get participant counts
    const chartIds = charts.map(c => c._id);
    const participantCounts = await Chart.aggregate([
      { $match: { _id: { $in: chartIds } } },
      { $project: { _id: 1, participantCount: { $size: '$participants' } } }
    ]);
    
    const chartsWithCounts = charts.map(chart => {
      const countData = participantCounts.find(p => p._id.toString() === chart._id.toString());
      return {
        ...chart.toObject(),
        participantCount: countData?.participantCount || 1,
        spotsLeft: chart.maxParticipants - (countData?.participantCount || 1)
      };
    });
    
    res.json({
      charts: chartsWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to fetch charts' });
  }
});

app.get('/api/charts/:chartId', async (req, res) => {
  try {
    const chart = await Chart.findById(req.params.chartId)
      .populate('creator', 'username displayName avatar country reputation isVerified')
      .populate('participants.user', 'username displayName avatar reputation')
      .populate('shoutouts')
      .populate('donations')
      .populate('winner', 'username displayName avatar');
    
    if (!chart) {
      return res.status(404).json({ error: 'Chart not found' });
    }
    
    // Increment views
    chart.views += 1;
    await chart.save();
    
    // Track unique viewer if authenticated
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'thumbsapp-secret-key');
        if (!chart.uniqueViewers.includes(decoded.id)) {
          chart.uniqueViewers.push(decoded.id);
          await chart.save();
        }
      } catch (e) {
        // Ignore token errors for view tracking
      }
    }
    
    res.json(chart);
  } catch (error) {
    console.error('Get chart error:', error);
    res.status(500).json({ error: 'Failed to fetch chart' });
  }
});

app.post('/api/charts/:chartId/join', authenticateToken, async (req, res) => {
  try {
    const chart = await Chart.findById(req.params.chartId);
    
    if (!chart) {
      return res.status(404).json({ error: 'Chart not found' });
    }
    
    if (chart.status !== 'open') {
      return res.status(400).json({ error: 'Chart is not open' });
    }
    
    if (chart.participants.length >= chart.maxParticipants) {
      return res.status(400).json({ error: 'Chart is full' });
    }
    
    if (chart.participants.some(p => p.user.toString() === req.user.id)) {
      return res.status(400).json({ error: 'Already joined this chart' });
    }
    
    if (new Date() > chart.startsAt) {
      return res.status(400).json({ error: 'Chart has already started' });
    }
    
    // Check balance
    const user = await User.findById(req.user.id);
    if (user.balance < chart.entryFee) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct entry fee
    user.balance -= chart.entryFee;
    await user.save();
    
    // Record transaction
    const transaction = new Transaction({
      user: req.user.id,
      type: 'entry_fee',
      amount: -chart.entryFee,
      balance: user.balance,
      reference: chart._id,
      description: `Entry fee for: ${chart.title}`,
      status: 'completed'
    });
    await transaction.save();
    
    // Add to prize pool
    chart.prizePool += chart.entryFee;
    
    // Add participant
    chart.participants.push({
      user: req.user.id,
      joinedAt: new Date(),
      status: 'pending'
    });
    
    await chart.save();
    
    // If max participants reached, start the chart
    if (chart.participants.length >= chart.maxParticipants) {
      chart.status = 'in-progress';
      await chart.save();
      
      // Create arena
      const arena = new Arena({
        chart: chart._id,
        players: chart.participants.map(p => ({
          user: p.user,
          score: 0,
          moves: 0,
          status: 'playing',
          joinedAt: new Date()
        })),
        status: 'live',
        startedAt: new Date()
      });
      await arena.save();
      
      // Notify all participants
      for (const participant of chart.participants) {
        const notification = new Notification({
          user: participant.user,
          type: 'match_start',
          title: '🎮 Match Started!',
          message: `Your chart "${chart.title}" has started. Join the arena now!`,
          data: { chartId: chart._id, arenaId: arena._id }
        });
        await notification.save();
        
        // Send real-time notification
        const client = connectedClients.get(participant.user.toString());
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'notification',
            notification
          }));
        }
      }
    }
    
    // Create notification for creator
    const creator = await User.findById(chart.creator);
    const joiner = await User.findById(req.user.id);
    
    const notification = new Notification({
      user: chart.creator,
      type: 'chart_joined',
      title: '👥 New Participant',
      message: `${joiner.displayName} joined your chart "${chart.title}"`,
      data: { chartId: chart._id, userId: req.user.id }
    });
    await notification.save();
    
    // Send real-time notification
    const creatorClient = connectedClients.get(chart.creator.toString());
    if (creatorClient && creatorClient.ws.readyState === WebSocket.OPEN) {
      creatorClient.ws.send(JSON.stringify({
        type: 'notification',
        notification
      }));
    }
    
    res.json({
      ...chart.toObject(),
      participantCount: chart.participants.length,
      spotsLeft: chart.maxParticipants - chart.participants.length
    });
  } catch (error) {
    console.error('Join chart error:', error);
    res.status(500).json({ error: 'Failed to join chart' });
  }
});

// ============ SHOUTOUT ROUTES ============
app.post('/api/shoutouts', authenticateToken, async (req, res) => {
  try {
    const { chartId, recipientId, message, amount = 0 } = req.body;
    
    const chart = await Chart.findById(chartId);
    if (!chart) {
      return res.status(404).json({ error: 'Chart not found' });
    }
    
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    // Create shoutout
    const shoutout = new Shoutout({
      user: req.user.id,
      chart: chartId,
      recipient: recipientId,
      message: message?.trim() || '',
      amount
    });
    
    await shoutout.save();
    
    // Update chart
    chart.shoutouts.push(shoutout._id);
    chart.totalShoutouts += 1;
    await chart.save();
    
    // Update recipient reputation
    const reputationBoost = 0.05;
    const newReputation = ((recipient.reputation * recipient.reviewCount) + 5) / (recipient.reviewCount + 1);
    recipient.reputation = parseFloat(newReputation.toFixed(2));
    recipient.reviewCount += 1;
    await recipient.save();
    
    // Get sender info
    const sender = await User.findById(req.user.id).select('username displayName');
    
    // Create notification
    const notification = new Notification({
      user: recipientId,
      type: 'shoutout',
      title: '📢 New Shoutout!',
      message: `${sender.displayName} gave you a shoutout${message ? ': ' + message : ''}`,
      data: { 
        chartId, 
        shoutoutId: shoutout._id,
        senderId: req.user.id,
        senderName: sender.displayName
      }
    });
    await notification.save();
    
    // Send real-time notification
    const client = connectedClients.get(recipientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'notification',
        notification
      }));
    }
    
    res.status(201).json(shoutout);
  } catch (error) {
    console.error('Create shoutout error:', error);
    res.status(500).json({ error: 'Failed to create shoutout' });
  }
});

app.get('/api/shoutouts/chart/:chartId', async (req, res) => {
  try {
    const shoutouts = await Shoutout.find({ chart: req.params.chartId })
      .populate('user', 'username displayName avatar reputation isVerified')
      .populate('recipient', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json(shoutouts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shoutouts' });
  }
});

// ============ DONATION ROUTES ============
app.post('/api/donations', authenticateToken, async (req, res) => {
  try {
    const { chartId, recipientId, amount, message } = req.body;
    
    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid donation amount' });
    }
    
    if (amount < 10) {
      return res.status(400).json({ error: 'Minimum donation is 10 THB' });
    }
    
    // Check balance
    const user = await User.findById(req.user.id);
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const chart = await Chart.findById(chartId);
    if (!chart) {
      return res.status(404).json({ error: 'Chart not found' });
    }
    
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    // Generate transaction ID
    const transactionId = 'DON-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Create donation
    const donation = new Donation({
      user: req.user.id,
      chart: chartId,
      recipient: recipientId,
      amount,
      message: message?.trim() || '',
      transactionId,
      status: 'completed',
      completedAt: new Date()
    });
    
    await donation.save();
    
    // Update user balance
    user.balance -= amount;
    user.totalSupported += amount;
    await user.save();
    
    // Update recipient balance
    recipient.balance += amount;
    recipient.totalEarned += amount;
    await recipient.save();
    
    // Record transaction for donor
    const donorTransaction = new Transaction({
      user: req.user.id,
      type: 'donation',
      amount: -amount,
      balance: user.balance,
      reference: donation._id,
      description: `Donation to ${recipient.displayName}${message ? ': ' + message.substring(0, 30) : ''}`,
      status: 'completed',
      metadata: { donationId: donation._id, recipientId }
    });
    await donorTransaction.save();
    
    // Record transaction for recipient
    const recipientTransaction = new Transaction({
      user: recipientId,
      type: 'donation',
      amount,
      balance: recipient.balance,
      reference: donation._id,
      description: `Donation from ${user.displayName}`,
      status: 'completed',
      metadata: { donationId: donation._id, donorId: req.user.id }
    });
    await recipientTransaction.save();
    
    // Update chart
    chart.donations.push(donation._id);
    chart.totalDonations = (chart.totalDonations || 0) + amount;
    await chart.save();
    
    // Get donor info
    const donor = await User.findById(req.user.id).select('username displayName avatar');
    
    // Create notification
    const notification = new Notification({
      user: recipientId,
      type: 'donation',
      title: '💰 Received Donation!',
      message: `${donor.displayName} donated ${amount} THB${message ? ': ' + message : ''}`,
      data: { 
        chartId, 
        donationId: donation._id, 
        amount,
        donorId: req.user.id,
        donorName: donor.displayName
      }
    });
    await notification.save();
    
    // Send real-time notification
    const client = connectedClients.get(recipientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'notification',
        notification
      }));
    }
    
    res.status(201).json({
      donation,
      balance: user.balance,
      recipientBalance: recipient.balance
    });
  } catch (error) {
    console.error('Donation error:', error);
    res.status(500).json({ error: 'Failed to process donation' });
  }
});

app.get('/api/donations/user/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const donations = await Donation.find({ user: req.params.userId })
      .populate('chart', 'title game difficulty')
      .populate('recipient', 'username displayName avatar reputation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Donation.countDocuments({ user: req.params.userId });
    
    res.json({
      donations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

// ============ ARENA ROUTES ============
app.get('/api/arenas/live', async (req, res) => {
  try {
    const arenas = await Arena.find({ status: 'live' })
      .populate('chart', 'title game difficulty entryFee prize')
      .populate('players.user', 'username displayName avatar reputation')
      .populate('spectators.user', 'username displayName avatar')
      .populate('chat.user', 'username displayName avatar')
      .sort({ startedAt: -1 });
    
    // Add spectator counts
    const arenasWithStats = arenas.map(arena => ({
      ...arena.toObject(),
      spectatorCount: arena.spectators?.length || 0,
      playerCount: arena.players?.length || 0
    }));
    
    res.json(arenasWithStats);
  } catch (error) {
    console.error('Get live arenas error:', error);
    res.status(500).json({ error: 'Failed to fetch live arenas' });
  }
});

app.get('/api/arenas/:arenaId', async (req, res) => {
  try {
    const arena = await Arena.findById(req.params.arenaId)
      .populate('chart')
      .populate('players.user', 'username displayName avatar reputation isVerified')
      .populate('spectators.user', 'username displayName avatar')
      .populate('chat.user', 'username displayName avatar')
      .populate('winner', 'username displayName avatar');
    
    if (!arena) {
      return res.status(404).json({ error: 'Arena not found' });
    }
    
    res.json(arena);
  } catch (error) {
    console.error('Get arena error:', error);
    res.status(500).json({ error: 'Failed to fetch arena' });
  }
});

app.post('/api/arenas/:arenaId/complete', authenticateToken, async (req, res) => {
  try {
    const { winnerId } = req.body;
    
    const result = await completeArena(req.params.arenaId, winnerId);
    
    res.json({ 
      success: true, 
      winner: result.winner,
      prize: result.prize 
    });
  } catch (error) {
    console.error('Complete arena error:', error);
    res.status(500).json({ error: 'Failed to complete arena' });
  }
});

// ============ NOTIFICATION ROUTES ============
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      read: false
    });
    
    const total = await Notification.countDocuments({ user: req.user.id });
    
    res.json({
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.put('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.notificationId, {
      read: true,
      readAt: Date.now()
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true, readAt: Date.now() }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// ============ TRANSACTION ROUTES ============
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = { user: req.user.id };
    if (type) query.type = type;
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Transaction.countDocuments(query);
    
    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (amount > 10000) {
      return res.status(400).json({ error: 'Maximum deposit is 10,000 THB' });
    }
    
    const user = await User.findById(req.user.id);
    user.balance += amount;
    await user.save();
    
    const transaction = new Transaction({
      user: req.user.id,
      type: 'deposit',
      amount,
      balance: user.balance,
      description: `Deposit ${amount} THB`,
      status: 'completed'
    });
    await transaction.save();
    
    res.json({ 
      balance: user.balance, 
      transaction,
      message: `Successfully deposited ${amount} THB`
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

// ============ LEADERBOARD ROUTES ============
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { type = 'reputation', limit = 10, timeframe = 'all' } = req.query;
    
    let matchQuery = {};
    
    // Timeframe filter
    if (timeframe === 'weekly') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      matchQuery.createdAt = { $gte: oneWeekAgo };
    } else if (timeframe === 'monthly') {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      matchQuery.createdAt = { $gte: oneMonthAgo };
    }
    
    let users;
    let sortField;
    
    switch (type) {
      case 'reputation':
        sortField = { reputation: -1, reviewCount: -1 };
        users = await User.find({ reviewCount: { $gt: 0 }, ...matchQuery })
          .select('username displayName avatar country reputation reviewCount isVerified')
          .sort(sortField)
          .limit(parseInt(limit));
        break;
      case 'earnings':
        sortField = { totalEarned: -1 };
        users = await User.find(matchQuery)
          .select('username displayName avatar country totalEarned chartsWon isVerified')
          .sort(sortField)
          .limit(parseInt(limit));
        break;
      case 'support':
        sortField = { totalSupported: -1 };
        users = await User.find(matchQuery)
          .select('username displayName avatar country totalSupported isVerified')
          .sort(sortField)
          .limit(parseInt(limit));
        break;
      case 'charts':
        sortField = { chartsCreated: -1, chartsWon: -1 };
        users = await User.find(matchQuery)
          .select('username displayName avatar country chartsCreated chartsWon isVerified')
          .sort(sortField)
          .limit(parseInt(limit));
        break;
      case 'donations':
        // Aggregate donations per user
        const donationLeaders = await Donation.aggregate([
          { $match: { status: 'completed', ...(timeframe !== 'all' ? { createdAt: matchQuery.createdAt } : {}) } },
          { $group: { _id: '$recipient', totalDonations: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { totalDonations: -1 } },
          { $limit: parseInt(limit) },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $unwind: '$user' },
          { $project: { 
            username: '$user.username', 
            displayName: '$user.displayName', 
            avatar: '$user.avatar', 
            country: '$user.country',
            totalDonations: 1,
            donationCount: 1,
            isVerified: '$user.isVerified'
          } }
        ]);
        return res.json(donationLeaders);
      default:
        users = await User.find(matchQuery)
          .select('username displayName avatar country reputation')
          .sort({ reputation: -1 })
          .limit(parseInt(limit));
    }
    
    // Add ranks
    const usersWithRank = users.map((user, index) => ({
      ...user.toObject(),
      rank: index + 1
    }));
    
    res.json(usersWithRank);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============ SEARCH ROUTES ============
app.get('/api/search', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const searchRegex = new RegExp(q, 'i');
    const results = {};
    
    const searchPromises = [];
    
    if (type === 'all' || type === 'users') {
      searchPromises.push(
        User.find({
          $or: [
            { username: searchRegex },
            { displayName: searchRegex }
          ]
        })
          .select('username displayName avatar country reputation isVerified')
          .limit(5)
          .then(users => { results.users = users; })
      );
    }
    
    if (type === 'all' || type === 'charts') {
      searchPromises.push(
        Chart.find({
          status: 'open',
          $or: [
            { title: searchRegex },
            { description: searchRegex },
            { game: searchRegex },
            { tags: { $in: [searchRegex] } }
          ]
        })
          .populate('creator', 'username displayName avatar')
          .limit(5)
          .then(charts => { results.charts = charts; })
      );
    }
    
    if (type === 'all' || type === 'games') {
      searchPromises.push(
        Chart.distinct('game', { game: searchRegex })
          .limit(10)
          .then(games => { results.games = games; })
      );
    }
    
    await Promise.all(searchPromises);
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// ============ STATS ROUTES ============
app.get('/api/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalCharts,
      activeArenas,
      totalDonations,
      onlineUsers
    ] = await Promise.all([
      User.countDocuments(),
      Chart.countDocuments(),
      Arena.countDocuments({ status: 'live' }),
      Donation.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      User.countDocuments({ status: 'online' })
    ]);
    
    res.json({
      totalUsers,
      totalCharts,
      activeArenas,
      totalDonations: totalDonations[0]?.total || 0,
      onlineUsers,
      activePlayers: onlineUsers * 0.3, // Estimate
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============ ERROR HANDLING ============
// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    code: 'NOT_FOUND'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Max size: 5MB',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Unexpected field',
        code: 'UNEXPECTED_FIELD'
      });
    }
    return res.status(400).json({ 
      error: err.message,
      code: 'UPLOAD_ERROR'
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error',
      details: err.message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      error: 'Invalid ID format',
      code: 'INVALID_ID'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │  🚀 ThumbsApp Server                        │
  │  📡 Port: ${PORT}                           │
  │  🔌 WebSocket: ws://localhost:${PORT}/ws    │
  │  🌍 Environment: ${process.env.NODE_ENV || 'development'} │
  └─────────────────────────────────────────────┘
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
