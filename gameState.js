const STARTING_PLAYER_LIVES = 3;
const STARTING_BALL_VELOCITY = 3;

global.GameState = {
  players: [],
  gameActive: false,

  getPlayers: function() { 
    return this.players;
  },
  getPlayerById: function(playerId) {
    return this.players.find(p => p.id === playerId);
  },
  createPlayer: function(player) {
    this.players = this.players.concat([{
      ...player,
      isReady: false,
      isCanvasReady: false,
      lives: STARTING_PLAYER_LIVES
    }]);
  },
  removePlayerById: function(playerId) {
    this.players = this.players.filter(player => player.id !== playerId);
  },
  removeLifeFromPlayer: function (playerId) {
    this.players = this.players.map((player) => {
      if (player.id === playerId) {
        return {
          ...player,
          lives: player.lives - 1
        }
      };
      return player;
    });

    return this.players.find(p => p.id === playerId);
  },
  setPlayerById: function (targetPlayerId, newPlayerProps) {
    this.players = this.players.map(player => {
      if (player.id === targetPlayerId) {
        return Object.assign({}, player, newPlayerProps);
      }

      return player;
    });
  },
  allPlayersReady: function() {
    return this.players.every(player => player.isReady);
  },
  isGameActive: function() {
    return this.gameActive;
  },
  activateGame: function() {
    this.gameActive = true;
    this.ballVecity = STARTING_BALL_VELOCITY;
  },
  resetGame: function() {
    this.gameActive = false;
    this.players = this.players.map(player => ({
      ...player,
      isReady: false,
      isCanvasReady: false,
      lives: STARTING_PLAYER_LIVES
    }))
  },
  setPlayerCanvasReady: function(playerId) {
    this.players = this.players.map(player => {
      if (player.id === playerId) {
        return {
          ...player,
          isCanvasReady: true,
          lives: STARTING_PLAYER_LIVES
        }
      }
      return player;
    });
  },
  allCanvasesReady: function() {
    return this.players.filter(p => p.isReady).every(p => p.isCanvasReady);
  },
  serveBallToRandomPlayer: function(excludeId) {
    const participatingPlayers = this.players.filter(p => p.isReady && p.isCanvasReady && p.lives > 0);
    const nextServeCandidates = excludeId ? participatingPlayers.filter(p => p.id !== excludeId) : participatingPlayers;
    return nextServeCandidates[Math.floor(Math.random() * nextServeCandidates.length)]
  },
  increaseBallVelocity: function(smashed) {
    const currentBallVelocity = this.ballVecity || STARTING_BALL_VELOCITY;
    this.ballVecity = currentBallVelocity * (smashed ? 2 : 1.2);
  },
  resetBallVelocity: function() {
    this.ballVecity = STARTING_BALL_VELOCITY;
  },
  getBallVelocity: function() {
    return this.ballVecity;
  },
  resetVolley: function() {
    this.volleyTalley = [];
  },
  tallyVolley: function(playerId) {
    const playerWhoHit = this.players.find(p => p.id === playerId);

    this.volleyTalley = this.volleyTalley.concat([{
      name: playerWhoHit.name
    }])
  },
  getVolleyTally: function() {
    return this.volleyTalley;
  },
  resetEverything: function() {
    this.players = this.players.map(p => ({
      ...p,
      isReady: false,
      isCanvasReady: false,
      lives: STARTING_PLAYER_LIVES
    })),
    this.gameActive = false;
  }
}