// ThumbsApp Main Application
// Connects the UI to the backend API

class ThumbsApp {
  constructor() {
    this.api = window.thumbsAPI;
    this.initialized = false;
    this.currentPage = 'home';
    this.currentChart = null;
    this.currentArena = null;
  }

  async init() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing ThumbsApp...');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Check authentication
    await this.checkAuth();
    
    // Load initial data
    await this.loadInitialData();
    
    // Setup WebSocket if authenticated
    if (this.api.token) {
      this.setupWebSocket();
    }
    
    this.initialized = true;
    console.log('✅ ThumbsApp initialized');
  }

  setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Logo home
    const logoHome = document.getElementById('logo-home');
    if (logoHome) {
      logoHome.addEventListener('click', () => this.navigateTo('home'));
    }

    // Notification bell
    const notifBell = document.getElementById('notif-bell');
    if (notifBell) {
      notifBell.addEventListener('click', () => this.openNotifications());
    }

    // Profile button
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => this.navigateTo('profile'));
    }

    // Create chart button
    const createBtn = document.querySelector('button:has(svg:contains("Create"))');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.openCreateChartModal());
    }

    // Quick join button
    const quickJoinBtn = document.querySelector('.quick-join-btn');
    if (quickJoinBtn) {
      quickJoinBtn.addEventListener('click', () => this.quickJoinMatch());
    }

    // Donation modal buttons
    const cancelDonation = document.getElementById('cancelDonation');
    if (cancelDonation) {
      cancelDonation.addEventListener('click', () => this.closeDonationModal());
    }

    const confirmDonation = document.getElementById('confirmDonation');
    if (confirmDonation) {
      confirmDonation.addEventListener('click', () => this.processDonation());
    }

    // Shoutout buttons
    this.setupShoutoutButtons();
    
    // Donate buttons
    this.setupDonateButtons();
    
    // Arena cards
    this.setupArenaCards();
  }

  async checkAuth() {
    const authRequired = !['/login.html', '/register.html'].includes(window.location.pathname);
    
    if (this.api.token) {
      try {
        await this.api.getCurrentUser();
        this.updateUIForAuth(true);
        
        // Redirect from login/register if already authenticated
        if (window.location.pathname.includes('login') || window.location.pathname.includes('register')) {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        this.api.clearToken();
        
        if (authRequired) {
          window.location.href = '/login.html';
        }
      }
    } else {
      if (authRequired && !window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
        window.location.href = '/login.html';
      }
    }
  }

  updateUIForAuth(isAuthenticated) {
    const authElements = document.querySelectorAll('.auth-required');
    const guestElements = document.querySelectorAll('.guest-only');
    
    authElements.forEach(el => {
      el.style.display = isAuthenticated ? '' : 'none';
    });
    
    guestElements.forEach(el => {
      el.style.display = isAuthenticated ? 'none' : '';
    });
    
    if (isAuthenticated && this.api.user) {
      this.updateUserProfileUI();
    }
  }

  updateUserProfileUI() {
    const user = this.api.user;
    if (!user) return;
    
    // Update avatar
    const avatarElements = document.querySelectorAll('.user-avatar');
    avatarElements.forEach(el => {
      if (user.avatar) {
        el.innerHTML = `<img src="${user.avatar}" alt="${user.displayName}" class="w-full h-full object-cover">`;
      } else {
        const initials = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
        el.innerHTML = `<span class="font-bold">${initials}</span>`;
      }
    });
    
    // Update display name
    const nameElements = document.querySelectorAll('.user-display-name');
    nameElements.forEach(el => {
      el.textContent = user.displayName;
    });
    
    // Update username
    const usernameElements = document.querySelectorAll('.user-username');
    usernameElements.forEach(el => {
      el.textContent = `@${user.username}`;
    });
    
    // Update stats
    const chartsCreatedEl = document.querySelector('.user-charts-created');
    if (chartsCreatedEl) chartsCreatedEl.textContent = user.chartsCreated || 0;
    
    const followersEl = document.querySelector('.user-followers');
    if (followersEl) followersEl.textContent = this.api.formatNumber(user.followers || 0);
    
    const followingEl = document.querySelector('.user-following');
    if (followingEl) followingEl.textContent = this.api.formatNumber(user.following || 0);
    
    const balanceEl = document.querySelector('.user-balance');
    if (balanceEl) balanceEl.textContent = this.api.formatCurrency(user.balance || 0);
    
    // Update reputation
    const reputationEl = document.querySelector('.user-reputation');
    if (reputationEl) reputationEl.textContent = user.reputation?.toFixed(2) || '4.50';
    
    // Update verification badge
    const verifiedBadges = document.querySelectorAll('.verification-badge');
    verifiedBadges.forEach(badge => {
      badge.style.display = user.isVerified ? 'flex' : 'none';
    });
  }

  async loadInitialData() {
    try {
      // Load feed
      await this.loadFeed();
      
      // Load live arenas
      await this.loadLiveArenas();
      
      // Load notifications if authenticated
      if (this.api.token) {
        await this.loadNotifications();
      }
      
      // Load leaderboard
      await this.loadLeaderboard();
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  async loadFeed() {
    const feedContainer = document.querySelector('.charts-feed');
    if (!feedContainer) return;
    
    try {
      const data = await this.api.getFeed({ page: 1, limit: 10 });
      this.renderFeed(data.charts);
    } catch (error) {
      console.error('Failed to load feed:', error);
      feedContainer.innerHTML = '<div class="text-center py-8 text-muted-foreground">Failed to load charts. Please try again.</div>';
    }
  }

  renderFeed(charts) {
    const feedContainer = document.querySelector('.charts-feed');
    if (!feedContainer) return;
    
    if (!charts || charts.length === 0) {
      feedContainer.innerHTML = `
        <div class="glass-card p-8 text-center">
          <svg class="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 class="text-xl font-semibold mb-2">No open charts</h3>
          <p class="text-muted-foreground mb-4">Be the first to create a challenge!</p>
          <button class="px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold" onclick="app.openCreateChartModal()">
            Create Chart
          </button>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    charts.forEach(chart => {
      const timeLeft = this.getTimeLeft(chart.startsAt);
      const spotsLeft = chart.maxParticipants - (chart.participants?.length || 1);
      
      html += `
        <div class="glass-card p-6 hover:shadow-xl transition-all chart-card" data-chart-id="${chart._id}">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="relative">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                  ${chart.creator?.displayName?.charAt(0) || 'U'}
                </div>
                ${chart.creator?.status === 'online' ? '<span class="avatar-status online"></span>' : ''}
                ${chart.creator?.isVerified ? '<span class="absolute -bottom-1 -right-1 verification-badge"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>' : ''}
              </div>
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="font-semibold">${chart.creator?.displayName || 'Unknown'}</h4>
                  <span class="country-flag">
                    <img src="${this.api.getCountryFlagUrl(chart.creator?.country || 'US')}" width="16" height="12" class="rounded-sm">
                    <span>${chart.creator?.country || 'US'}</span>
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="reputation-badge">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                    ${chart.creator?.reputation?.toFixed(2) || '4.50'}
                  </span>
                </div>
              </div>
            </div>
            <span class="difficulty-badge ${chart.difficulty} px-3 py-1 rounded-full text-xs font-semibold">
              ${chart.difficulty?.charAt(0).toUpperCase() + chart.difficulty?.slice(1) || 'Intermediate'}
            </span>
          </div>
          
          <h3 class="font-display font-bold text-xl mb-2">${chart.title}</h3>
          <p class="text-sm text-muted-foreground mb-3 line-clamp-2">${chart.description || 'No description'}</p>
          
          <div class="flex items-center gap-4 mb-3 text-sm flex-wrap">
            <span class="flex items-center gap-1 text-muted-foreground">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              ${chart.game || 'Game'}
            </span>
            <span class="flex items-center gap-1 text-success font-semibold">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              ${this.api.formatCurrency(chart.entryFee)}
            </span>
            <span class="flex items-center gap-1 text-primary">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
              </svg>
              Prize: ${this.api.formatCurrency(chart.prizePool || chart.prize || chart.entryFee * 2)}
            </span>
            <span class="flex items-center gap-1 text-muted-foreground">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              ${chart.timeLimit} min
            </span>
          </div>
          
          ${chart.prizeItem ? `
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm mb-3">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
              </svg>
              <span class="font-medium">Gift:</span> ${chart.prizeItem.name}
            </div>
          ` : ''}
          
          <div class="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <span class="font-medium text-sm">Locked Entry</span>
            </div>
            <span class="font-semibold text-primary">${this.api.formatCurrency(chart.entryFee)}</span>
          </div>
          
          <div class="flex items-center gap-6 mb-4 text-sm">
            <span class="flex items-center gap-1 text-primary shoutout-count" data-chart-id="${chart._id}">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.58C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
              </svg>
              <span class="shoutout-value">${this.api.formatNumber(chart.totalShoutouts || 0)}</span> Shoutouts
            </span>
            <span class="flex items-center gap-1 text-muted-foreground">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              ${chart.participants?.length || 1}/${chart.maxParticipants}
            </span>
            <span class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
              <span class="donation-amount">${this.api.formatNumber(chart.totalDonations || 0)}</span> THB
            </span>
          </div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">
                ⏰ Starts ${timeLeft}
              </span>
              <span class="text-xs ${spotsLeft > 0 ? 'text-success' : 'text-destructive'}">
                ${spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft > 1 ? 's' : ''} left` : 'Full'}
              </span>
            </div>
            <button class="px-6 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/30 join-chart-btn" data-chart-id="${chart._id}">
              Join Now
            </button>
          </div>
        </div>
      `;
    });
    
    feedContainer.innerHTML = html;
    
    // Add event listeners to join buttons
    document.querySelectorAll('.join-chart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chartId = btn.dataset.chartId;
        this.joinChart(chartId);
      });
    });
    
    // Add click listeners to chart cards
    document.querySelectorAll('.chart-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          const chartId = card.dataset.chartId;
          this.viewChart(chartId);
        }
      });
    });
  }

  async loadLiveArenas() {
    const arenaContainer = document.querySelector('.live-arenas');
    if (!arenaContainer) return;
    
    try {
      const arenas = await this.api.getLiveArenas();
      this.renderLiveArenas(arenas);
    } catch (error) {
      console.error('Failed to load live arenas:', error);
    }
  }

  renderLiveArenas(arenas) {
    const arenaContainer = document.querySelector('.live-arenas');
    if (!arenaContainer) return;
    
    if (!arenas || arenas.length === 0) {
      arenaContainer.innerHTML = `
        <div class="glass-card p-6 text-center">
          <p class="text-muted-foreground">No live arenas at the moment</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    arenas.forEach(arena => {
      const player1 = arena.players?.[0];
      const player2 = arena.players?.[1];
      const spectatorCount = arena.spectators?.length || 0;
      
      html += `
        <div class="arena-card glass-card p-4 cursor-pointer hover:-translate-x-1 transition" data-arena-id="${arena._id}">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center -space-x-2">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs">
                ${player1?.user?.displayName?.charAt(0) || 'P1'}
              </div>
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white text-xs">
                ${player2?.user?.displayName?.charAt(0) || 'P2'}
              </div>
            </div>
            <span class="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
              LIVE
            </span>
          </div>
          
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="text-sm font-medium">${player1?.user?.displayName || 'Player 1'}</p>
              <p class="text-xs text-muted-foreground">${player1?.score || 0} pts</p>
            </div>
            <span class="text-lg font-bold text-primary mx-2">VS</span>
            <div class="text-right">
              <p class="text-sm font-medium">${player2?.user?.displayName || 'Player 2'}</p>
              <p class="text-xs text-muted-foreground">${player2?.score || 0} pts</p>
            </div>
          </div>
          
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div class="flex gap-3 text-xs">
              <span class="flex items-center gap-1 text-muted-foreground">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                ${this.api.formatNumber(spectatorCount)}
              </span>
              <span class="flex items-center gap-1 text-warning">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                ${arena.chart?.game || 'Game'}
              </span>
            </div>
            <button class="glass-card px-3 py-1 text-xs rounded-full watch-arena-btn" data-arena-id="${arena._id}">
              Watch
            </button>
          </div>
        </div>
      `;
    });
    
    arenaContainer.innerHTML = html;
    
    // Add event listeners
    document.querySelectorAll('.arena-card, .watch-arena-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const arenaId = el.dataset.arenaId || el.closest('.arena-card')?.dataset.arenaId;
        if (arenaId) {
          this.viewArena(arenaId);
        }
      });
    });
  }

  async loadNotifications() {
    if (!this.api.token) return;
    
    try {
      const data = await this.api.getNotifications(1);
      this.updateNotificationBadge(data.unreadCount);
      
      // Store notifications
      window.notifications = data.notifications;
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  updateNotificationBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  async loadLeaderboard() {
    const leaderboardContainer = document.querySelector('.leaderboard');
    if (!leaderboardContainer) return;
    
    try {
      const leaders = await this.api.getLeaderboard('reputation', 5);
      this.renderLeaderboard(leaders);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  }

  renderLeaderboard(leaders) {
    const leaderboardContainer = document.querySelector('.leaderboard');
    if (!leaderboardContainer) return;
    
    if (!leaders || leaders.length === 0) {
      leaderboardContainer.innerHTML = '<p class="text-muted-foreground text-sm">No data available</p>';
      return;
    }
    
    let html = '';
    
    leaders.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      
      html += `
        <div class="flex items-center gap-3 py-2">
          <span class="w-6 text-sm font-semibold ${index < 3 ? 'text-primary' : 'text-muted-foreground'}">${medal}</span>
          <div class="relative">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs">
              ${user.displayName?.charAt(0) || 'U'}
            </div>
            ${user.isVerified ? '<span class="absolute -bottom-1 -right-1 verification-badge w-3 h-3 text-[8px]">✓</span>' : ''}
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium">${user.displayName}</p>
            <p class="text-xs text-muted-foreground">@${user.username}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold">${user.reputation?.toFixed(2) || '4.50'}</p>
            <p class="text-xs text-muted-foreground">⭐ ${this.api.formatNumber(user.reviewCount || 0)}</p>
          </div>
        </div>
      `;
    });
    
    leaderboardContainer.innerHTML = html;
  }

  setupWebSocket() {
    this.api.connectWebSocket({
      onOpen: () => {
        console.log('✅ WebSocket connected');
      },
      onNotification: (notification) => {
        this.handleNewNotification(notification);
      },
      onArenaState: (arena) => {
        this.handleArenaState(arena);
      },
      onArenaChat: (chat, arenaId) => {
        this.handleArenaChat(chat, arenaId);
      },
      onScoreUpdate: (playerId, score, moves, arenaId) => {
        this.handleScoreUpdate(playerId, score, moves, arenaId);
      },
      onSpectatorJoined: (user, arenaId) => {
        this.handleSpectatorJoined(user, arenaId);
      },
      onSpectatorLeft: (userId, arenaId) => {
        this.handleSpectatorLeft(userId, arenaId);
      },
      onArenaCompleted: (arenaId, winnerId, prize) => {
        this.handleArenaCompleted(arenaId, winnerId, prize);
      },
      onUserStatus: (userId, status) => {
        this.handleUserStatus(userId, status);
      }
    });
  }

  handleNewNotification(notification) {
    // Show toast notification
    this.showToast(notification.title, notification.message, notification.type);
    
    // Update badge count
    const badge = document.getElementById('notif-badge');
    if (badge) {
      const currentCount = parseInt(badge.textContent) || 0;
      badge.textContent = currentCount + 1;
      badge.classList.remove('hidden');
    }
    
    // Play sound if enabled
    this.playNotificationSound();
  }

  showToast(title, message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed top-20 right-4 z-50 glass-card p-4 max-w-sm animate-slide-left border-l-4 ${
      type === 'donation' ? 'border-success' : 
      type === 'shoutout' ? 'border-primary' : 
      type === 'follow' ? 'border-accent' : 
      'border-warning'
    }`;
    
    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          ${type === 'donation' ? '💰' : type === 'shoutout' ? '📢' : type === 'follow' ? '👋' : '🔔'}
        </div>
        <div class="flex-1">
          <h4 class="font-semibold text-sm mb-1">${title}</h4>
          <p class="text-xs text-muted-foreground">${message}</p>
        </div>
        <button class="text-muted-foreground hover:text-foreground" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }

  playNotificationSound() {
    // Only play if user has interacted with the page
    if (localStorage.getItem('thumbsapp_sound_enabled') !== 'false') {
      const audio = new Audio('https://actions.google.com/sounds/v1/alerts/gentle_notification.ogg');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore autoplay errors
    }
  }

  // ============ ACTIONS ============
  toggleTheme() {
    const body = document.getElementById('app-body');
    const isDark = body.classList.contains('dark');
    
    if (isDark) {
      body.classList.remove('dark');
      localStorage.setItem('thumbsapp-theme', 'light');
    } else {
      body.classList.add('dark');
      localStorage.setItem('thumbsapp-theme', 'dark');
    }
  }

  navigateTo(page) {
    switch (page) {
      case 'home':
        window.location.href = '/';
        break;
      case 'profile':
        if (this.api.user) {
          window.location.href = `/profile.html?id=${this.api.user.id}`;
        }
        break;
      case 'explore':
        window.location.href = '/explore.html';
        break;
      case 'arena':
        window.location.href = '/arena.html';
        break;
    }
  }

  openNotifications() {
    // Navigate to notifications page or open modal
    window.location.href = '/notifications.html';
  }

  async openCreateChartModal() {
    if (!this.api.token) {
      window.location.href = '/login.html';
      return;
    }
    
    // Check balance
    if (this.api.user.balance < 10) {
      this.showToast('Insufficient Balance', 'You need at least 10 THB to create a chart', 'warning');
      return;
    }
    
    // Create modal HTML
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';
    modal.id = 'create-chart-modal';
    
    modal.innerHTML = `
      <div class="glass-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-display font-bold text-2xl gradient-text">Create New Chart</h3>
          <button class="p-2 rounded-full hover:bg-muted transition-colors" onclick="document.getElementById('create-chart-modal').remove()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Title</label>
            <input type="text" id="chart-title" class="w-full px-4 py-2 rounded-xl border border-border bg-background" placeholder="e.g., Speed Chess Championship" maxlength="100" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Game</label>
            <select id="chart-game" class="w-full px-4 py-2 rounded-xl border border-border bg-background" required>
              <option value="">Select a game</option>
              <option value="Speed Chess">Speed Chess</option>
              <option value="Memory Matrix">Memory Matrix</option>
              <option value="Sketch Arena">Sketch Arena</option>
              <option value="Trivia">Trivia</option>
              <option value="Word Battle">Word Battle</option>
              <option value="Math Duel">Math Duel</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea id="chart-description" rows="3" class="w-full px-4 py-2 rounded-xl border border-border bg-background resize-none" placeholder="Describe your challenge..." maxlength="500"></textarea>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Difficulty</label>
              <select id="chart-difficulty" class="w-full px-4 py-2 rounded-xl border border-border bg-background">
                <option value="beginner">Beginner</option>
                <option value="intermediate" selected>Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-2">Max Players</label>
              <select id="chart-max-players" class="w-full px-4 py-2 rounded-xl border border-border bg-background">
                <option value="2">2 Players</option>
                <option value="4">4 Players</option>
                <option value="6">6 Players</option>
                <option value="8">8 Players</option>
              </select>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Entry Fee (THB)</label>
              <input type="number" id="chart-entry-fee" class="w-full px-4 py-2 rounded-xl border border-border bg-background" value="10" min="10" max="1000" step="10" required>
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-2">Time Limit (min)</label>
              <select id="chart-time-limit" class="w-full px-4 py-2 rounded-xl border border-border bg-background">
                <option value="2">2 minutes</option>
                <option value="3">3 minutes</option>
                <option value="5" selected>5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
              </select>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Tags (comma separated)</label>
            <input type="text" id="chart-tags" class="w-full px-4 py-2 rounded-xl border border-border bg-background" placeholder="e.g., chess, competitive, blitz">
          </div>
          
          <div class="bg-primary/10 rounded-xl p-4">
            <div class="flex items-center gap-3 mb-2">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="font-medium">Summary</span>
            </div>
            <div class="text-sm space-y-1 text-muted-foreground">
              <p>• Entry fee will be deducted from your balance</p>
              <p>• Prize pool starts at <span class="font-semibold text-primary">2x entry fee</span></p>
              <p>• Chart will start automatically when full or after 5 minutes</p>
              <p>• Your current balance: <span class="font-semibold">${this.api.formatCurrency(this.api.user?.balance || 0)}</span></p>
            </div>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button class="flex-1 border border-border px-4 py-3 rounded-xl font-medium" onclick="document.getElementById('create-chart-modal').remove()">
              Cancel
            </button>
            <button id="submit-chart-btn" class="flex-1 bg-gradient-to-r from-primary to-accent text-white px-4 py-3 rounded-xl font-semibold shadow-lg">
              Create Chart • ${this.api.formatCurrency(10)}
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Update entry fee display
    const entryFeeInput = document.getElementById('chart-entry-fee');
    const submitBtn = document.getElementById('submit-chart-btn');
    
    entryFeeInput.addEventListener('input', () => {
      const fee = parseInt(entryFeeInput.value) || 10;
      submitBtn.textContent = `Create Chart • ${this.api.formatCurrency(fee)}`;
    });
    
    // Handle submit
    submitBtn.addEventListener('click', async () => {
      await this.createChart();
    });
  }

  async createChart() {
    const title = document.getElementById('chart-title').value;
    const game = document.getElementById('chart-game').value;
    const description = document.getElementById('chart-description').value;
    const difficulty = document.getElementById('chart-difficulty').value;
    const maxParticipants = parseInt(document.getElementById('chart-max-players').value);
    const entryFee = parseInt(document.getElementById('chart-entry-fee').value);
    const timeLimit = parseInt(document.getElementById('chart-time-limit').value);
    const tagsInput = document.getElementById('chart-tags').value;
    
    // Validation
    if (!title || !game) {
      this.showToast('Validation Error', 'Title and game are required', 'error');
      return;
    }
    
    if (title.length < 3) {
      this.showToast('Validation Error', 'Title must be at least 3 characters', 'error');
      return;
    }
    
    if (entryFee < 10) {
      this.showToast('Validation Error', 'Minimum entry fee is 10 THB', 'error');
      return;
    }
    
    if (entryFee > this.api.user.balance) {
      this.showToast('Insufficient Balance', `You need ${this.api.formatCurrency(entryFee)} to create this chart`, 'error');
      return;
    }
    
    const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    
    const chartData = {
      title,
      game,
      description,
      difficulty,
      maxParticipants,
      entryFee,
      timeLimit,
      tags
    };
    
    try {
      const chart = await this.api.createChart(chartData);
      
      // Close modal
      document.getElementById('create-chart-modal').remove();
      
      // Show success message
      this.showToast('Chart Created! 🎉', 'Your challenge is now live', 'success');
      
      // Refresh feed
      await this.loadFeed();
      
      // Navigate to chart
      setTimeout(() => {
        this.viewChart(chart._id);
      }, 1000);
    } catch (error) {
      this.showToast('Failed to create chart', error.message, 'error');
    }
  }

  async joinChart(chartId) {
    if (!this.api.token) {
      window.location.href = '/login.html';
      return;
    }
    
    try {
      const chart = await this.api.getChart(chartId);
      
      // Check if already joined
      if (chart.participants.some(p => p.user._id === this.api.user.id)) {
        this.showToast('Already Joined', 'You are already a participant in this chart', 'info');
        return;
      }
      
      // Check balance
      if (this.api.user.balance < chart.entryFee) {
        this.showToast('Insufficient Balance', `You need ${this.api.formatCurrency(chart.entryFee)} to join`, 'error');
        return;
      }
      
      // Confirm join
      const confirmed = confirm(`Join ${chart.title} for ${this.api.formatCurrency(chart.entryFee)}?`);
      if (!confirmed) return;
      
      const result = await this.api.joinChart(chartId);
      
      this.showToast('Joined Successfully!', `You've joined ${chart.title}`, 'success');
      
      // Refresh feed
      await this.loadFeed();
      
      // If chart is now in-progress, navigate to arena
      if (result.status === 'in-progress') {
        // Find arena for this chart
        const arenas = await this.api.getLiveArenas();
        const arena = arenas.find(a => a.chart._id === chartId);
        if (arena) {
          setTimeout(() => {
            this.viewArena(arena._id);
          }, 1000);
        }
      }
    } catch (error) {
      this.showToast('Failed to join chart', error.message, 'error');
    }
  }

  async viewChart(chartId) {
    window.location.href = `/chart.html?id=${chartId}`;
  }

  async viewArena(arenaId) {
    window.location.href = `/arena.html?id=${arenaId}`;
  }

  quickJoinMatch() {
    if (!this.api.token) {
      window.location.href = '/login.html';
      return;
    }
    
    // Find an open chart with available spots
    this.api.getFeed({ status: 'open', limit: 20 })
      .then(data => {
        const availableCharts = data.charts.filter(c => 
          c.participants.length < c.maxParticipants && 
          c.creator._id !== this.api.user.id
        );
        
        if (availableCharts.length > 0) {
          // Join random chart
          const randomChart = availableCharts[Math.floor(Math.random() * availableCharts.length)];
          this.joinChart(randomChart._id);
        } else {
          this.showToast('No Available Matches', 'No open charts found. Create one!', 'info');
        }
      })
      .catch(error => {
        this.showToast('Failed to find match', error.message, 'error');
      });
  }

  setupShoutoutButtons() {
    document.querySelectorAll('[id^="shoutout-btn-"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!this.api.token) {
          window.location.href = '/login.html';
          return;
        }
        
        const chartId = btn.id.replace('shoutout-btn-', '');
        await this.toggleShoutout(chartId);
      });
    });
  }

  async toggleShoutout(chartId) {
    try {
      const chart = await this.api.getChart(chartId);
      const recipientId = chart.creator._id;
      
      // Check if user already shouted out
      const shoutouts = await this.api.getChartShoutouts(chartId);
      const existingShoutout = shoutouts.find(s => s.user._id === this.api.user.id);
      
      if (existingShoutout) {
        this.showToast('Already Shouted Out', 'You already gave a shoutout for this chart', 'info');
        return;
      }
      
      // Create shoutout
      await this.api.createShoutout({
        chartId,
        recipientId,
        message: '',
        amount: 0
      });
      
      // Update UI
      const shoutoutVal = document.getElementById(`shoutout-val-${chartId}`);
      const shoutoutNum = document.getElementById(`shoutout-num-${chartId}`);
      const currentCount = parseInt(shoutoutVal?.textContent || chart.totalShoutouts || 0);
      
      if (shoutoutVal) shoutoutVal.textContent = currentCount + 1;
      if (shoutoutNum) shoutoutNum.textContent = currentCount + 1;
      
      btn.classList.add('active');
      
      this.showToast('Shoutout Sent!', 'Thanks for supporting the player', 'shoutout');
    } catch (error) {
      this.showToast('Failed to send shoutout', error.message, 'error');
    }
  }

  setupDonateButtons() {
    document.querySelectorAll('[id^="donate-btn-"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!this.api.token) {
          window.location.href = '/login.html';
          return;
        }
        
        const chartId = btn.id.replace('donate-btn-', '');
        this.openDonationModal(chartId);
      });
    });
  }

  async openDonationModal(chartId) {
    const chart = await this.api.getChart(chartId);
    this.currentChart = chart;
    
    const modal = document.getElementById('donationModal');
    if (!modal) return;
    
    // Set recipient info
    const recipientNameEl = document.querySelector('.donation-recipient');
    if (recipientNameEl) recipientNameEl.textContent = chart.creator.displayName;
    
    // Reset form
    const customAmount = document.getElementById('custom-amount');
    if (customAmount) customAmount.value = '';
    
    const message = document.getElementById('donation-message');
    if (message) message.value = '';
    
    // Set default amount
    const confirmBtn = document.getElementById('confirmDonation');
    if (confirmBtn) confirmBtn.innerHTML = `Donate 25 THB`;
    
    // Highlight default preset
    document.querySelectorAll('.preset-amount').forEach(b => {
      b.classList.remove('bg-primary/10', 'border-primary');
      if (b.dataset.amount === '25') {
        b.classList.add('bg-primary/10', 'border-primary');
      }
    });
    
    modal.classList.remove('hidden');
  }

  closeDonationModal() {
    const modal = document.getElementById('donationModal');
    if (modal) modal.classList.add('hidden');
    this.currentChart = null;
  }

  async processDonation() {
    if (!this.currentChart) {
      this.closeDonationModal();
      return;
    }
    
    const customAmount = document.getElementById('custom-amount');
    let amount = customAmount?.value ? parseInt(customAmount.value) : null;
    
    if (!amount) {
      const activePreset = document.querySelector('.preset-amount.bg-primary\\/10');
      amount = activePreset ? parseInt(activePreset.dataset.amount) : 25;
    }
    
    if (!amount || amount < 10) {
      this.showToast('Invalid Amount', 'Minimum donation is 10 THB', 'error');
      return;
    }
    
    if (amount > 10000) {
      this.showToast('Invalid Amount', 'Maximum donation is 10,000 THB', 'error');
      return;
    }
    
    if (amount > this.api.user.balance) {
      this.showToast('Insufficient Balance', `You need ${this.api.formatCurrency(amount)} to donate`, 'error');
      return;
    }
    
    const message = document.getElementById('donation-message')?.value || '';
    
    try {
      const donation = await this.api.createDonation({
        chartId: this.currentChart._id,
        recipientId: this.currentChart.creator._id,
        amount,
        message
      });
      
      // Update UI
      const donationAmountSpan = document.getElementById(`donation-amount-${this.currentChart._id}`);
      if (donationAmountSpan) {
        const currentAmount = parseInt(donationAmountSpan.textContent) || 0;
        donationAmountSpan.textContent = currentAmount + amount;
      }
      
      // Update user balance
      if (this.api.user) {
        this.api.user.balance = donation.balance;
        const balanceEl = document.querySelector('.user-balance');
        if (balanceEl) balanceEl.textContent = this.api.formatCurrency(donation.balance);
      }
      
      this.showToast('Donation Sent!', `You donated ${this.api.formatCurrency(amount)} to ${this.currentChart.creator.displayName}`, 'donation');
      
      this.closeDonationModal();
    } catch (error) {
      this.showToast('Donation Failed', error.message, 'error');
    }
  }

  setupArenaCards() {
    document.querySelectorAll('.arena-card').forEach(card => {
      card.addEventListener('click', () => {
        const arenaId = card.dataset.arenaId;
        if (arenaId) {
          this.viewArena(arenaId);
        }
      });
    });
  }

  handleArenaState(arena) {
    this.currentArena = arena;
    // Update UI for arena
    this.updateArenaUI(arena);
  }

  handleArenaChat(chat, arenaId) {
    if (this.currentArena?._id === arenaId) {
      this.addChatMessage(chat);
    }
  }

  handleScoreUpdate(playerId, score, moves, arenaId) {
    if (this.currentArena?._id === arenaId) {
      // Update player score in UI
      const playerScoreEl = document.querySelector(`.player-score[data-player-id="${playerId}"]`);
      if (playerScoreEl) playerScoreEl.textContent = score;
      
      const playerMovesEl = document.querySelector(`.player-moves[data-player-id="${playerId}"]`);
      if (playerMovesEl) playerMovesEl.textContent = moves || 0;
    }
  }

  handleSpectatorJoined(user, arenaId) {
    if (this.currentArena?._id === arenaId) {
      // Update spectator count
      const spectatorCountEl = document.querySelector('.spectator-count');
      if (spectatorCountEl) {
        const currentCount = parseInt(spectatorCountEl.textContent) || 0;
        spectatorCountEl.textContent = currentCount + 1;
      }
      
      // Add system message
      this.addSystemMessage(`${user.displayName} joined the arena`);
    }
  }

  handleSpectatorLeft(userId, arenaId) {
    if (this.currentArena?._id === arenaId) {
      // Update spectator count
      const spectatorCountEl = document.querySelector('.spectator-count');
      if (spectatorCountEl) {
        const currentCount = parseInt(spectatorCountEl.textContent) || 0;
        spectatorCountEl.textContent = Math.max(0, currentCount - 1);
      }
    }
  }

  async handleArenaCompleted(arenaId, winnerId, prize) {
    if (this.currentArena?._id === arenaId) {
      this.showToast('Arena Completed! 🏆', `Winner received ${this.api.formatCurrency(prize)}`, 'success');
      
      // Reload arena after 3 seconds
      setTimeout(() => {
        if (this.currentArena?._id === arenaId) {
          this.loadArena(arenaId);
        }
      }, 3000);
    }
  }

  handleUserStatus(userId, status) {
    // Update user status indicator in UI
    const userStatusEl = document.querySelector(`.user-status[data-user-id="${userId}"]`);
    if (userStatusEl) {
      userStatusEl.className = `avatar-status ${status}`;
    }
  }

  updateArenaUI(arena) {
    // Implement arena UI update
    console.log('Arena updated:', arena);
  }

  addChatMessage(chat) {
    const chatContainer = document.querySelector('.arena-chat-messages');
    if (!chatContainer) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = 'flex items-start gap-2 text-sm';
    
    if (chat.type === 'system') {
      messageEl.innerHTML = `
        <span class="text-muted-foreground text-xs">${new Date(chat.createdAt).toLocaleTimeString()}</span>
        <span class="text-muted-foreground">🔔 ${chat.message}</span>
      `;
    } else if (chat.type === 'advisor') {
      messageEl.innerHTML = `
        <span class="text-muted-foreground text-xs">${new Date(chat.createdAt).toLocaleTimeString()}</span>
        <span class="text-primary">🤖 Advisor:</span>
        <span class="text-foreground">${chat.message}</span>
      `;
    } else {
      messageEl.innerHTML = `
        <span class="text-muted-foreground text-xs">${new Date(chat.createdAt).toLocaleTimeString()}</span>
        <span class="font-medium">${chat.user?.displayName || 'User'}:</span>
        <span class="text-foreground">${chat.message}</span>
      `;
    }
    
    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  addSystemMessage(message) {
    this.addChatMessage({
      type: 'system',
      message,
      createdAt: new Date()
    });
  }

  getTimeLeft(dateString) {
    const startDate = new Date(dateString);
    const now = new Date();
    
    if (now > startDate) return 'Now';
    
    const diffMs = startDate - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Soon';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h`;
  }
}

// Initialize app
const app = new ThumbsApp();
window.app = app;

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
