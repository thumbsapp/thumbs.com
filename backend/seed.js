const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Define schemas (simplified for seeding)
const UserSchema = new mongoose.Schema({
  username: String, email: String, password: String, displayName: String,
  avatar: String, country: String, reputation: Number, reviewCount: Number,
  isVerified: Boolean, chartsCreated: Number, chartsWon: Number,
  balance: Number, totalEarned: Number, totalSupported: Number,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  achievements: Array, status: String, createdAt: Date
});

const ChartSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: String, description: String, game: String, difficulty: String,
  entryFee: Number, prize: Number, prizePool: Number, prizeItem: Object,
  status: String, participants: Array, maxParticipants: Number,
  timeLimit: Number, startsAt: Date, endsAt: Date, shoutouts: Array,
  donations: Array, totalShoutouts: Number, totalDonations: Number,
  views: Number, tags: Array, winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: Date
});

const ShoutoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  chart: { type: mongoose.Schema.Types.ObjectId, ref: 'Chart' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: String, amount: Number, createdAt: Date
});

const DonationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  chart: { type: mongoose.Schema.Types.ObjectId, ref: 'Chart' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number, message: String, status: String,
  transactionId: String, completedAt: Date, createdAt: Date
});

const ArenaSchema = new mongoose.Schema({
  chart: { type: mongoose.Schema.Types.ObjectId, ref: 'Chart' },
  players: Array, status: String, currentRound: Number,
  totalRounds: Number, spectators: Array, chat: Array,
  startedAt: Date, endedAt: Date, winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: Date
});

const User = mongoose.model('User', UserSchema);
const Chart = mongoose.model('Chart', ChartSchema);
const Shoutout = mongoose.model('Shoutout', ShoutoutSchema);
const Donation = mongoose.model('Donation', DonationSchema);
const Arena = mongoose.model('Arena', ArenaSchema);

const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thumbsapp');
    console.log('📦 Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Chart.deleteMany({}),
      Shoutout.deleteMany({}),
      Donation.deleteMany({}),
      Arena.deleteMany({})
    ]);
    
    console.log('🗑️  Cleared existing data');

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = await User.create([
      {
        username: 'sarah_chen',
        email: 'sarah@thumbsapp.io',
        password: hashedPassword,
        displayName: 'Sarah Chen',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
        country: 'SG',
        reputation: 4.95,
        reviewCount: 128,
        isVerified: true,
        chartsCreated: 45,
        chartsWon: 28,
        balance: 2500,
        totalEarned: 5600,
        totalSupported: 1200,
        status: 'online',
        achievements: [
          { id: 'first_win', name: 'First Victory', description: 'Won first chart', earnedAt: new Date('2024-01-15') },
          { id: 'pro_player', name: 'Pro Player', description: 'Won 25 charts', earnedAt: new Date('2024-06-20') },
          { id: 'top_donor', name: 'Top Supporter', description: 'Donated 1000+ THB', earnedAt: new Date('2024-08-10') }
        ],
        createdAt: new Date('2024-01-01')
      },
      {
        username: 'marcus_rodriguez',
        email: 'marcus@thumbsapp.io',
        password: hashedPassword,
        displayName: 'Marcus Rodriguez',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
        country: 'ES',
        reputation: 4.82,
        reviewCount: 93,
        isVerified: true,
        chartsCreated: 28,
        chartsWon: 15,
        balance: 1800,
        totalEarned: 3400,
        totalSupported: 800,
        status: 'online',
        achievements: [
          { id: 'first_win', name: 'First Victory', description: 'Won first chart', earnedAt: new Date('2024-02-10') },
          { id: 'memory_master', name: 'Memory Master', description: 'Won 10 memory games', earnedAt: new Date('2024-07-05') }
        ],
        createdAt: new Date('2024-02-01')
      },
      {
        username: 'alex_chen',
        email: 'alex@thumbsapp.io',
        password: hashedPassword,
        displayName: 'Alex Chen',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
        country: 'US',
        reputation: 4.92,
        reviewCount: 156,
        isVerified: true,
        chartsCreated: 128,
        chartsWon: 72,
        balance: 4500,
        totalEarned: 8900,
        totalSupported: 2100,
        status: 'online',
        achievements: [
          { id: 'first_win', name: 'First Victory', earnedAt: new Date('2023-12-01') },
          { id: 'legend', name: 'Legend', description: 'Won 50 charts', earnedAt: new Date('2024-05-15') },
          { id: 'creator', name: 'Top Creator', description: 'Created 100 charts', earnedAt: new Date('2024-09-01') },
          { id: 'verified', name: 'Verified', description: 'Achieved verified status', earnedAt: new Date('2024-03-20') }
        ],
        createdAt: new Date('2023-12-01')
      },
      {
        username: 'emma_watson',
        email: 'emma@thumbsapp.io',
        password: hashedPassword,
        displayName: 'Emma Watson',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
        country: 'GB',
        reputation: 4.88,
        reviewCount: 67,
        isVerified: true,
        chartsCreated: 34,
        chartsWon: 19,
        balance: 3200,
        totalEarned: 4100,
        totalSupported: 950,
        status: 'online',
        achievements: [
          { id: 'first_win', name: 'First Victory', earnedAt: new Date('2024-03-10') },
          { id: 'speed_demon', name: 'Speed Demon', description: 'Won 10 blitz games', earnedAt: new Date('2024-08-22') }
        ],
        createdAt: new Date('2024-03-01')
      },
      {
        username: 'james_wilson',
        email: 'james@thumbsapp.io',
        password: hashedPassword,
        displayName: 'James Wilson',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
        country: 'CA',
        reputation: 4.75,
        reviewCount: 42,
        isVerified: false,
        chartsCreated: 12,
        chartsWon: 5,
        balance: 1200,
        totalEarned: 1800,
        totalSupported: 300,
        status: 'offline',
        achievements: [
          { id: 'first_win', name: 'First Victory', earnedAt: new Date('2024-04-05') }
        ],
        createdAt: new Date('2024-04-01')
      }
    ]);

    console.log(`👥 Created ${users.length} users`);

    // Setup follow relationships
    await User.findByIdAndUpdate(users[0]._id, { $addToSet: { followers: users[2]._id, followers: users[4]._id } });
    await User.findByIdAndUpdate(users[1]._id, { $addToSet: { followers: users[0]._id, followers: users[3]._id } });
    await User.findByIdAndUpdate(users[2]._id, { $addToSet: { followers: users[0]._id, followers: users[1]._id, followers: users[3]._id } });
    await User.findByIdAndUpdate(users[3]._id, { $addToSet: { followers: users[1]._id, followers: users[2]._id } });
    
    await User.findByIdAndUpdate(users[0]._id, { $addToSet: { following: users[1]._id, following: users[2]._id } });
    await User.findByIdAndUpdate(users[1]._id, { $addToSet: { following: users[0]._id, following: users[3]._id } });
    await User.findByIdAndUpdate(users[2]._id, { $addToSet: { following: users[0]._id, following: users[1]._id, following: users[4]._id } });
    await User.findByIdAndUpdate(users[3]._id, { $addToSet: { following: users[1]._id, following: users[2]._id } });

    // Create charts
    const charts = await Chart.create([
      {
        creator: users[0]._id,
        title: 'Speed Chess Blitz • 3+0',
        description: 'Quick chess match with 3 minutes per player. No increment. Test your tactical skills in this fast-paced blitz battle!',
        game: 'Speed Chess',
        difficulty: 'advanced',
        entryFee: 25,
        prize: 50,
        prizePool: 50,
        prizeItem: {
          name: 'Legendary Chess NFT',
          type: 'nft',
          value: 30,
          image: 'https://api.dicebear.com/7.x/identicon/svg?seed=chess'
        },
        status: 'open',
        maxParticipants: 2,
        timeLimit: 5,
        totalShoutouts: 234,
        totalDonations: 1560,
        views: 1245,
        tags: ['chess', 'blitz', 'competitive', 'strategy'],
        startsAt: new Date(Date.now() + 15 * 60000), // 15 minutes from now
        participants: [{ user: users[0]._id, joinedAt: new Date(), status: 'active' }],
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        creator: users[1]._id,
        title: 'Pattern Memory • Level 7',
        description: 'Test your memory with complex patterns. Complete level 7 to win. Challenge your cognitive skills!',
        game: 'Memory Matrix',
        difficulty: 'intermediate',
        entryFee: 15,
        prize: 30,
        prizePool: 30,
        status: 'open',
        maxParticipants: 2,
        timeLimit: 3,
        totalShoutouts: 189,
        totalDonations: 890,
        views: 876,
        tags: ['memory', 'puzzle', 'brain', 'cognitive'],
        startsAt: new Date(Date.now() + 25 * 60000),
        participants: [{ user: users[1]._id, joinedAt: new Date(), status: 'active' }],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        creator: users[2]._id,
        title: 'Quick Draw Challenge',
        description: 'Who can draw the fastest? Artistic skills required! Show off your creativity under pressure.',
        game: 'Sketch Arena',
        difficulty: 'beginner',
        entryFee: 10,
        prize: 20,
        prizePool: 40,
        status: 'open',
        maxParticipants: 4,
        timeLimit: 2,
        totalShoutouts: 98,
        totalDonations: 450,
        views: 567,
        tags: ['drawing', 'creative', 'fun', 'art'],
        startsAt: new Date(Date.now() + 45 * 60000),
        participants: [
          { user: users[2]._id, joinedAt: new Date(), status: 'active' },
          { user: users[4]._id, joinedAt: new Date(), status: 'pending' }
        ],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        creator: users[3]._id,
        title: 'Trivia Showdown: Science',
        description: 'Test your science knowledge! Physics, chemistry, biology, and more. 20 questions, highest score wins.',
        game: 'Trivia',
        difficulty: 'intermediate',
        entryFee: 20,
        prize: 40,
        prizePool: 40,
        status: 'open',
        maxParticipants: 4,
        timeLimit: 10,
        totalShoutouts: 67,
        totalDonations: 320,
        views: 432,
        tags: ['trivia', 'science', 'education'],
        startsAt: new Date(Date.now() + 60 * 60000),
        participants: [{ user: users[3]._id, joinedAt: new Date(), status: 'active' }],
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      }
    ]);

    console.log(`🎯 Created ${charts.length} charts`);

    // Create shoutouts
    const shoutouts = await Shoutout.create([
      {
        user: users[2]._id,
        chart: charts[0]._id,
        recipient: users[0]._id,
        message: 'Amazing chess skills! 🔥 That endgame was brilliant.',
        amount: 0,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        user: users[3]._id,
        chart: charts[0]._id,
        recipient: users[0]._id,
        message: 'Best blitz player I\'ve seen! 🏆',
        amount: 0,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        user: users[0]._id,
        chart: charts[1]._id,
        recipient: users[1]._id,
        message: 'Your memory is incredible! How do you do it? 🤯',
        amount: 0,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        user: users[4]._id,
        chart: charts[2]._id,
        recipient: users[2]._id,
        message: 'Love your drawing style! Very creative ✨',
        amount: 0,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      }
    ]);

    console.log(`📢 Created ${shoutouts.length} shoutouts`);

    // Create donations
    const donations = await Donation.create([
      {
        user: users[2]._id,
        chart: charts[0]._id,
        recipient: users[0]._id,
        amount: 50,
        message: 'Supporting your chess journey! Keep crushing it!',
        transactionId: 'DON-' + Date.now() + '-1',
        status: 'completed',
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        user: users[3]._id,
        chart: charts[0]._id,
        recipient: users[0]._id,
        amount: 25,
        message: 'Great content! Love watching your matches',
        transactionId: 'DON-' + Date.now() + '-2',
        status: 'completed',
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        user: users[0]._id,
        chart: charts[1]._id,
        recipient: users[1]._id,
        amount: 15,
        message: 'Keep up the good work! Your memory skills are inspiring',
        transactionId: 'DON-' + Date.now() + '-3',
        status: 'completed',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        user: users[1]._id,
        chart: charts[2]._id,
        recipient: users[2]._id,
        amount: 30,
        message: 'Supporting the Quick Draw challenge! 🎨',
        transactionId: 'DON-' + Date.now() + '-4',
        status: 'completed',
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ]);

    console.log(`💰 Created ${donations.length} donations`);

    // Update chart donation totals
    for (const chart of charts) {
      const chartDonations = donations.filter(d => d.chart.toString() === chart._id.toString());
      chart.totalDonations = chartDonations.reduce((sum, d) => sum + d.amount, 0);
      chart.donations = chartDonations.map(d => d._id);
      await chart.save();
    }

    // Create live arenas
    const arenas = await Arena.create([
      {
        chart: charts[0]._id,
        players: [
          { user: users[0]._id, score: 124, moves: 32, status: 'playing', joinedAt: new Date(Date.now() - 15 * 60000) },
          { user: users[3]._id, score: 118, moves: 28, status: 'playing', joinedAt: new Date(Date.now() - 15 * 60000) }
        ],
        status: 'live',
        currentRound: 2,
        totalRounds: 3,
        spectators: [
          { user: users[2]._id, joinedAt: new Date(Date.now() - 10 * 60000) },
          { user: users[4]._id, joinedAt: new Date(Date.now() - 5 * 60000) }
        ],
        chat: [
          {
            user: users[2]._id,
            message: 'Great match so far! Who do you think will win?',
            type: 'user',
            createdAt: new Date(Date.now() - 8 * 60000)
          },
          {
            user: null,
            message: 'This position favors aggressive play. Sarah has a slight advantage.',
            type: 'advisor',
            createdAt: new Date(Date.now() - 4 * 60000)
          }
        ],
        startedAt: new Date(Date.now() - 15 * 60000),
        createdAt: new Date(Date.now() - 15 * 60000)
      },
      {
        chart: charts[1]._id,
        players: [
          { user: users[1]._id, score: 7, moves: 45, status: 'playing', joinedAt: new Date(Date.now() - 8 * 60000) },
          { user: users[4]._id, score: 5, moves: 38, status: 'playing', joinedAt: new Date(Date.now() - 8 * 60000) }
        ],
        status: 'live',
        currentRound: 1,
        totalRounds: 3,
        spectators: [
          { user: users[0]._id, joinedAt: new Date(Date.now() - 6 * 60000) }
        ],
        chat: [
          {
            user: users[0]._id,
            message: 'This pattern is tough! Level 7 is no joke',
            type: 'user',
            createdAt: new Date(Date.now() - 3 * 60000)
          }
        ],
        startedAt: new Date(Date.now() - 8 * 60000),
        createdAt: new Date(Date.now() - 8 * 60000)
      }
    ]);

    console.log(`🎮 Created ${arenas.length} live arenas`);

    // Update chart status for live arenas
    await Chart.findByIdAndUpdate(charts[0]._id, { status: 'in-progress' });
    await Chart.findByIdAndUpdate(charts[1]._id, { status: 'in-progress' });

    console.log(`
    ┌─────────────────────────────────────────────┐
    │  ✅ Database seeded successfully!           │
    ├─────────────────────────────────────────────┤
    │  Users:        ${users.length}              │
    │  Charts:       ${charts.length}             │
    │  Shoutouts:    ${shoutouts.length}          │
    │  Donations:    ${donations.length}          │
    │  Live Arenas:  ${arenas.length}             │
    └─────────────────────────────────────────────┘
    `);
    
    console.log('\n📝 Test Accounts:');
    console.log('   sarah_chen@thumbsapp.io / password123');
    console.log('   marcus_rodriguez@thumbsapp.io / password123');
    console.log('   alex_chen@thumbsapp.io / password123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();
