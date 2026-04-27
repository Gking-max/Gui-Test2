// ============================================================================
// gameService.js — Data / Logic Layer (the Subject in Observer Pattern)
// ============================================================================
//
// LAYER RULES — read this before writing a single line of code.
//
//   1. This file MUST NOT import anything from a DOM API. No `document`,
//      no `window.document`, no `querySelector`. If you find yourself
//      reaching for the DOM, you are in the wrong layer.
//
//   2. The outside world sees this service only through:
//        - the method calls it makes (start, flipCard, restart, ...)
//        - the events it emits via the injected event bus
//      Nothing else. Do not expose the internal state object.
//
//   3. State is mutated only inside this file. The UI layer reads state
//      from the event payloads, never by reaching in.
//
// ============================================================================
// EVENT CONTRACT (these are the names — use exactly these strings)
// ----------------------------------------------------------------------------
//
//   'game:started'           payload: { cards, totalPairs }
//     emitted when a new game begins. `cards` is the full shuffled array
//     with every card face-down. UI renders the board from this.
//
//   'game:cardFlipped'       payload: { cardId, symbol }
//     emitted when the player successfully flips a face-down card.
//     UI adds the .is-flipped class and shows the symbol.
//
//   'game:matchFound'        payload: { firstId, secondId, matchedCount }
//     emitted when the two currently flipped cards match. UI marks both
//     as .is-matched.
//
//   'game:matchFailed'       payload: { firstId, secondId }
//     emitted when the two flipped cards do not match. UI should schedule
//     removal of .is-flipped after a short delay (~900ms) so the player
//     can see the second card before it flips back.
//
//   'game:moveCountChanged'  payload: { moves }
//     emitted whenever the move count changes. A "move" is one completed
//     pair attempt (two cards flipped).
//
//   'game:timerTick'         payload: { elapsedSeconds }
//     emitted once per second while status === 'playing'.
//
//   'game:won'               payload: { moves, elapsedSeconds }
//     emitted when every pair has been matched.
//
// ============================================================================
// STATE SHAPE (this is the exact shape you will maintain)
// ----------------------------------------------------------------------------
//
//   {
//     status:          'idle' | 'playing' | 'won',
//     cards:           Array<Card>,
//     firstPickId:     number | null,   // id of the first card of the pair
//     secondPickId:    number | null,   // id of the second card of the pair
//     moves:           number,
//     elapsedSeconds:  number,
//     matchedCount:    number,          // number of MATCHED CARDS (not pairs)
//     isLocked:        boolean,         // true between a failed match and
//                                       // the flip-back (prevents clicks)
//     timerId:         number | null,   // setInterval id, null when stopped
//   }
//
//   Card = {
//     id:         number,    // 0..(cards.length - 1)
//     symbol:     string,    // emoji string
//     isFlipped:  boolean,
//     isMatched:  boolean,
//   }
//
// ============================================================================

// The 18 Belizean-themed symbols. Each one will appear on exactly two cards.
// ============================================================================
// gameService.js — Data / Logic Layer (the Subject in Observer Pattern)
// ============================================================================

const SYMBOLS = [
  '🦜', '🐆', '🌊', '🏝️', '🐢', '🥥',
  '🌴', '🥭', '🦈', '🐬', '🦩', '🐠',
  '☀️', '⛰️', '🌺', '🦎', '🦀', '🛶',
];

const TOTAL_PAIRS = SYMBOLS.length;
const TOTAL_CARDS = TOTAL_PAIRS * 2;
const FLIP_BACK_DELAY_MS = 900;
const TIMER_INTERVAL_MS = 1000;

export function createGameService(eventBus) {
  if (!eventBus || typeof eventBus.emit !== 'function') {
    throw new TypeError('createGameService requires an event bus.');
  }

  let state = createInitialState();

  function createInitialState() {
    return {
      status:         'idle',
      cards:          [],
      firstPickId:    null,
      secondPickId:   null,
      moves:          0,
      elapsedSeconds: 0,
      matchedCount:   0,
      isLocked:       false,
      timerId:        null,
    };
  }

  // Pure Fisher-Yates shuffle - does NOT mutate input
  function shuffle(arr) {
    const shuffled = [...arr]; // Clone the array
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Build the initial deck with cards
  function buildDeck() {
    // Create pairs: each symbol appears twice
    const pairedSymbols = [...SYMBOLS, ...SYMBOLS];
    // Shuffle the paired symbols
    const shuffledSymbols = shuffle(pairedSymbols);
    // Map to card objects with IDs
    return shuffledSymbols.map((symbol, index) => ({
      id: index,
      symbol: symbol,
      isFlipped: false,
      isMatched: false,
    }));
  }

  function getCardById(id) {
    return state.cards.find(card => card.id === id);
  }

  function startTimer() {
    // Guard against double-start
    if (state.timerId !== null) {
      return;
    }
    
    state.timerId = setInterval(() => {
      if (state.status === 'playing') {
        state.elapsedSeconds++;
        eventBus.emit('game:timerTick', { elapsedSeconds: state.elapsedSeconds });
      }
    }, TIMER_INTERVAL_MS);
  }

  function stopTimer() {
    if (state.timerId !== null) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function start() {
    // Stop any existing timer
    stopTimer();
    
    // Reset state
    state = createInitialState();
    
    // Build new shuffled deck
    state.cards = buildDeck();
    state.status = 'playing';
    
    // Emit game started BEFORE starting timer
    eventBus.emit('game:started', { 
      cards: state.cards, 
      totalPairs: TOTAL_PAIRS 
    });
    
    // Start the timer
    startTimer();
  }

  function flipCard(cardId) {
    // Validation rules - return early if any fail
    if (state.status !== 'playing') return;
    if (state.isLocked) return;
    
    const card = getCardById(cardId);
    if (!card) return;
    if (card.isFlipped) return;
    if (card.isMatched) return;
    if (state.secondPickId !== null) return; // Can't pick a third card
    
    // Flip the card
    card.isFlipped = true;
    eventBus.emit('game:cardFlipped', { cardId: card.id, symbol: card.symbol });
    
    // Determine if this is first or second pick
    if (state.firstPickId === null) {
      // First pick
      state.firstPickId = cardId;
    } else {
      // Second pick
      state.secondPickId = cardId;
      
      // Increment moves and emit
      state.moves++;
      eventBus.emit('game:moveCountChanged', { moves: state.moves });
      
      const firstCard = getCardById(state.firstPickId);
      const secondCard = getCardById(state.secondPickId);
      
      if (firstCard.symbol === secondCard.symbol) {
        // Match found
        firstCard.isMatched = true;
        secondCard.isMatched = true;
        state.matchedCount += 2;
        
        // Clear picks
        state.firstPickId = null;
        state.secondPickId = null;
        
        eventBus.emit('game:matchFound', { 
          firstId: firstCard.id, 
          secondId: secondCard.id, 
          matchedCount: state.matchedCount 
        });
        
        // Check for win
        if (state.matchedCount === TOTAL_CARDS) {
          state.status = 'won';
          stopTimer();
          eventBus.emit('game:won', { 
            moves: state.moves, 
            elapsedSeconds: state.elapsedSeconds 
          });
        }
      } else {
        // No match - lock and schedule flip back
        state.isLocked = true;
        
        eventBus.emit('game:matchFailed', { 
          firstId: firstCard.id, 
          secondId: secondCard.id 
        });
        
        setTimeout(() => {
          // Flip cards back face-down
          const card1 = getCardById(state.firstPickId);
          const card2 = getCardById(state.secondPickId);
          
          if (card1) card1.isFlipped = false;
          if (card2) card2.isFlipped = false;
          
          // Clear picks and unlock
          state.firstPickId = null;
          state.secondPickId = null;
          state.isLocked = false;
        }, FLIP_BACK_DELAY_MS);
      }
    }
  }

  function restart() {
    start();
  }

  function destroy() {
    stopTimer();
  }

  return Object.freeze({ start, flipCard, restart, destroy });
}