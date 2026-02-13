// ThumbsApp API Client
// Complete integration with backend

const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : 'https://api.thumbsapp.io/api';

const WS_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:5000/ws'
  : 'wss://api.thumbsapp.io/ws';

class ThumbsAppAPI {
  constructor() {
    this.token = localStorage.getItem('thumbsapp_token');
    this.user = null;
    this.ws = null;
    this.wsCallbacks = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // ============ AUTHENTICATION ============
  setToken(token) {
    this.token = token;
    localStorage.setItem('thumbsapp_token', token);
  }

  clearToken() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('thumbsapp_token');
  }

  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async handleResponse(response) {
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401 || response.status === 403) {
        if (data.code === 'TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN') {
          this.clearToken();
          window.location.href = '/login.html';
        }
      }
      
      const error = new Error(data.error || 'Request failed');
      error.code = data.code;
      error.status = response.status;
      throw error;
    }
    
    return data;
  }

  // ============ WEBSOCKET ============
  connectWebSocket(callbacks = {}) {
    if (!this.token) {
      console.error('❌ No token available for WebSocket auth');
      return null;
    }

    this.wsCallbacks = callbacks;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Authenticate
        this.ws.send(JSON.stringify({
          type: 'auth',
          token: this.token
        }));
        
        if (this.wsCallbacks.onOpen) {
          this.wsCallbacks.onOpen();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        if (this.wsCallbacks.onError) {
          this.wsCallbacks.onError(error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        
        if (this.wsCallbacks.onClose) {
          this.wsCallbacks.onClose();
        }
        
        // Attempt reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          
          setTimeout(() => {
            if (this.token) {
              this.connectWebSocket(this.wsCallbacks);
            }
          }, delay);
        }
      };

      return this.ws;
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      return null;
    }
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'auth_success':
        console.log('✅ WebSocket authenticated');
        if (this.wsCallbacks.onAuth) {
          this.wsCallbacks.onAuth(message.userId);
        }
        break;
        
      case 'auth_error':
        console.error('❌ WebSocket auth error:', message.error);
        break;
        
      case 'notification':
        if (this.wsCallbacks.onNotification) {
          this.wsCallbacks.onNotification(message.notification);
        }
        break;
        
      case 'arena_state':
        if (this.wsCallbacks.onArenaState) {
          this.wsCallbacks.onArenaState(message.arena);
        }
        break;
        
      case 'arena_chat':
        if (this.wsCallbacks.onArenaChat) {
          this.wsCallbacks.onArenaChat(message.chat, message.arenaId);
        }
        break;
        
      case 'score_update':
        if (this.wsCallbacks.onScoreUpdate) {
          this.wsCallbacks.onScoreUpdate(message.playerId, message.score, message.moves, message.arenaId);
        }
        break;
        
      case 'spectator_joined':
        if (this.wsCallbacks.onSpectatorJoined) {
          this.wsCallbacks.onSpectatorJoined(message.user, message.arenaId);
        }
        break;
        
      case 'spectator_left':
        if (this.wsCallbacks.onSpectatorLeft) {
          this.wsCallbacks.onSpectatorLeft(message.userId, message.arenaId);
        }
        break;
        
      case 'arena_completed':
        if (this.wsCallbacks.onArenaCompleted) {
          this.wsCallbacks.onArenaCompleted(message.arenaId, message.winnerId, message.prize);
        }
        break;
        
      case 'user_status':
        if (this.wsCallbacks.onUserStatus) {
          this.wsCallbacks.onUserStatus(message.userId, message.status);
        }
        break;
        
      case 'pong':
        // Heartbeat response
        break;
        
      case 'error':
        console.error('❌ WebSocket error:', message.error);
        if (this.wsCallbacks.onError) {
          this.wsCallbacks.onError(message.error);
        }
        break;
        
      default:
        console.log('📨 WebSocket message:', message);
    }
  }

  // WebSocket actions
  joinArena(arenaId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'join_arena',
        arenaId
      }));
      return true;
    }
    return false;
  }

  sendArenaChat(arenaId, message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'arena_chat',
        arenaId,
        message: message.substring(0, 280)
      }));
      return true;
    }
    return false;
  }

  updateScore(arenaId, playerId, score, moves) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'update_score',
        arenaId,
        playerId,
        score,
        moves
      }));
      return true;
    }
    return false;
  }

  leaveArena(arenaId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'leave_arena',
        arenaId
      }));
      return true;
    }
    return false;
  }

  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
      return true;
    }
    return false;
  }

  // ============ AUTH API ============
  async register(userData) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(userData)
    });
    
    const data = await this.handleResponse(response);
    if (data.token) {
      this.setToken(data.token);
      this.user = data.user;
    }
    return data;
  }

  async login(credentials) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(credentials)
    });
    
    const data = await this.handleResponse(response);
    if (data.token) {
      this.setToken(data.token);
      this.user = data.user;
    }
    return data;
  }

  async logout() {
    if (this.token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getHeaders()
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    this.clearToken();
    if (this.ws) {
      this.ws.close();
    }
  }

  async getCurrentUser() {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: this.getHeaders()
    });
    
    const data = await this.handleResponse(response);
    this.user = data;
    return data;
  }

  // ============ USERS API ============
  async getUserProfile(userId) {
    const response = await fetch(`${API_URL}/users/${userId}`, {
      headers: this.getHeaders(false)
    });
    return this.handleResponse(response);
  }

  async updateProfile(formData) {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });
    
    const data = await this.handleResponse(response);
    if (this.user && data._id === this.user.id) {
      this.user = { ...this.user, ...data };
    }
    return data;
  }

  async followUser(userId) {
    const response = await fetch(`${API_URL}/users/${userId}/follow`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  async unfollowUser(userId) {
    const response = await fetch(`${API_URL}/users/${userId}/follow`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // ============ CHARTS API ============
  async createChart(chartData) {
    const response = await fetch(`${API_URL}/charts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(chartData)
    });
    return this.handleResponse(response);
  }

  async getFeed(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/charts/feed?${queryString}`, {
      headers: this.getHeaders(false)
    });
    return this.handleResponse(response);
  }

  async getChart(chartId) {
    const response = await fetch(`${API_URL}/charts/${chartId}`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  async joinChart(chartId) {
    const response = await fetch(`${API_URL}/charts/${chartId}/join`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // ============ SHOUTOUTS API ============
  async createShoutout(data) {
    const response = await fetch(`${API_URL}/shoutouts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  async getChartShoutouts(chartId) {
    const response = await fetch(`${API_URL}/shoutouts/chart/${chartId}`, {
      headers: this.getHeaders(false)
    });
    return this.handleResponse(response);
  }

  // ============ DONATIONS API ============
  async createDonation(data) {
    const response = await fetch(`${API_URL}/donations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  async getUserDonations(userId, page = 1) {
    const response = await fetch(`${API_URL}/donations/user/${userId}?page=${page}`, {
      headers: this.getHeaders(false)
    });
    return this.handleResponse(response);
  }

  // ============ ARENAS API ============
  async getLiveArenas() {
    const response = await fetch(`${API_URL}/arenas/live`, {
      headers: this.getHeaders(false)
    });
    return this.handleResponse(response);
  }

  async getArena(arenaId) {
    const response = await fetch(`${API_URL}/arenas/${arenaId}`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  async completeArena(arenaId, winnerId) {
    const response = await fetch(`${API_URL}/arenas/${arenaId}/complete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ winnerId })
    });
    return this.handleResponse(response);
  }

  // ============ NOTIFICATIONS API ============
  async getNotifications(page = 1) {
    const response = await fetch(`${API_URL}/notifications?page=${page}`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  async markNotificationRead(notificationId) {
    const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  async markAllNotificationsRead() {
    const response = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // ============ TRANSACTIONS API ============
  async getTransactions(page = 1, type = null) {
    let url = `${API_URL}/transactions?page=${page}`;
    if (type) url += `&type=${type}`;
    
    const response = await fetch(url, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  async deposit(amount) {
    const response = await fetch(`${API_URL}/transactions/deposit`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ amount })
    });
    
    const data = await this.handleResponse(response);
    if (this.user) {
      this.user.balance = data.balance;
    }
    return data;
  }

  // ============ LEADERBOARD API ============
  async getLeaderboard(type = 'reputation', limit = 10, timeframe = 'all') {
    const response = await fetch(
      `${API_URL}/leaderboard?type=${type}&limit=${limit}&timeframe=${timeframe}`,
      { headers: this.getHeaders(false) }
    );
    return this.handleResponse(response);
  }

  // ============ SEARCH API ============
  async search(query, type = 'all') {
    if (!query || query.length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }
    
    const response = await fetch(
      `${API_URL}/search?q=${encodeURIComponent(query)}&type=${type}`,
      { headers: this.getHeaders(false) }
    );
    return this.handleResponse(response);
  }

  // ============ STATS API ============
  async getStats() {
    const response = await fetch(`${API_URL}/stats`, {
      headers: this.getHeaders(false)
    });
    return this.handleResponse(response);
  }

  // ============ UTILITIES ============
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getAvatarUrl(seed) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  }

  getCountryFlagUrl(countryCode) {
    return `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`;
  }
}

// Create global instance
window.thumbsAPI = new ThumbsAppAPI();

// Auto-login if token exists
(async () => {
  if (window.thumbsAPI.token) {
    try {
      await window.thumbsAPI.getCurrentUser();
      console.log('✅ Auto-login successful');
    } catch (error) {
      console.error('❌ Auto-login failed:', error);
      window.thumbsAPI.clearToken();
    }
  }
})();
