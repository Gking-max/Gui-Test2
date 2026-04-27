// ============================================================================
// ui.js — View Layer (the Observer in Observer Pattern)
// ============================================================================
//
// LAYER RULES
//
//   1. This file is the ONLY place allowed to touch the DOM.
//
//   2. This file MUST NOT contain any game logic. No match checking, no
//      move counting, no timer state. If you need to know something about
//      the game, either the service emits it in an event payload, or
//      you are doing it wrong.
//
//   3. Communicate with the service only by calling its public methods
//      (gameService.start, gameService.flipCard, gameService.restart).
//      Never read or mutate service state directly.
//
// ============================================================================
// EVENT SUBSCRIPTIONS YOU WILL WIRE UP
//
//   'game:started'           → renderBoard(cards), resetHud(totalPairs), hideWinOverlay()
//   'game:cardFlipped'       → flipCardFaceUp(cardId)
//   'game:matchFound'        → markCardsMatched(firstId, secondId), updateMatchedCount(matchedCount)
//   'game:matchFailed'       → after FLIP_BACK_DELAY_MS, flipCardsFaceDown(firstId, secondId)
//                               (use the same 900ms the service uses; a constant is defined below)
//   'game:moveCountChanged'  → updateMoves(moves)
//   'game:timerTick'         → updateTimer(elapsedSeconds)
//   'game:won'               → showWinOverlay(moves, elapsedSeconds)
//
// ============================================================================

// ============================================================================
// ui.js — View Layer (the Observer in Observer Pattern)
// ============================================================================

const FLIP_BACK_DELAY_MS = 900;
const TOTAL_PAIRS = 18;

export function createUI(eventBus, gameService, rootEl) {
  const els = {
    board:       null,
    moves:       null,
    timer:       null,
    matched:     null,
    restart:     null,
    playAgain:   null,
    winOverlay:  null,
    winMoves:    null,
    winTime:     null,
  };

  const subscriptions = [];

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function buildCardElement(card) {
    // Create button container
    const button = document.createElement('button');
    button.className = 'card';
    button.type = 'button';
    button.setAttribute('data-card-id', card.id);
    
    // Create inner structure
    const cardInner = document.createElement('div');
    cardInner.className = 'card-inner';
    
    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';
    
    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    
    const symbolSpan = document.createElement('span');
    symbolSpan.textContent = card.symbol;
    
    // Assemble
    cardFront.appendChild(symbolSpan);
    cardInner.appendChild(cardBack);
    cardInner.appendChild(cardFront);
    button.appendChild(cardInner);
    
    return button;
  }

  function renderBoard(cards) {
    const fragment = document.createDocumentFragment();
    
    cards.forEach(card => {
      const cardElement = buildCardElement(card);
      fragment.appendChild(cardElement);
    });
    
    els.board.replaceChildren(fragment);
  }

  function resetHud(totalPairs) {
    updateMoves(0);
    updateTimer(0);
    els.matched.textContent = `0 / ${totalPairs}`;
  }

  function updateMoves(moves) {
    els.moves.textContent = String(moves);
  }

  function updateTimer(elapsedSeconds) {
    els.timer.textContent = formatTime(elapsedSeconds);
  }

  function updateMatchedCount(matchedCardCount) {
    const pairs = matchedCardCount / 2;
    els.matched.textContent = `${pairs} / ${TOTAL_PAIRS}`;
  }

  function flipCardFaceUp(cardId) {
    const cardElement = els.board.querySelector(`[data-card-id="${cardId}"]`);
    if (cardElement) {
      cardElement.classList.add('is-flipped');
    }
  }

  function markCardsMatched(firstId, secondId) {
    const firstCard = els.board.querySelector(`[data-card-id="${firstId}"]`);
    const secondCard = els.board.querySelector(`[data-card-id="${secondId}"]`);
    
    if (firstCard) {
      firstCard.classList.add('is-matched');
    }
    if (secondCard) {
      secondCard.classList.add('is-matched');
    }
  }

  function flipCardsFaceDown(firstId, secondId) {
    const firstCard = els.board.querySelector(`[data-card-id="${firstId}"]`);
    const secondCard = els.board.querySelector(`[data-card-id="${secondId}"]`);
    
    if (firstCard) {
      firstCard.classList.remove('is-flipped');
    }
    if (secondCard) {
      secondCard.classList.remove('is-flipped');
    }
  }

  function showWinOverlay(moves, elapsedSeconds) {
    els.winMoves.textContent = moves;
    els.winTime.textContent = formatTime(elapsedSeconds);
    els.winOverlay.classList.add('is-visible');
    els.winOverlay.setAttribute('aria-hidden', 'false');
  }

  function hideWinOverlay() {
    els.winOverlay.classList.remove('is-visible');
    els.winOverlay.setAttribute('aria-hidden', 'true');
  }

  function onBoardClick(domEvent) {
    const cardElement = domEvent.target.closest('.card');
    if (!cardElement) return;
    
    const cardId = Number(cardElement.getAttribute('data-card-id'));
    gameService.flipCard(cardId);
  }

  function onRestartClick() {
    gameService.restart();
  }

  function subscribe(eventName, handler) {
    eventBus.on(eventName, handler);
    subscriptions.push({ event: eventName, handler });
  }

  function wireSubscriptions() {
    // Game started
    subscribe('game:started', ({ cards, totalPairs }) => {
      renderBoard(cards);
      resetHud(totalPairs);
      hideWinOverlay();
    });
    
    // Card flipped
    subscribe('game:cardFlipped', ({ cardId }) => {
      flipCardFaceUp(cardId);
    });
    
    // Match found
    subscribe('game:matchFound', ({ firstId, secondId, matchedCount }) => {
      markCardsMatched(firstId, secondId);
      updateMatchedCount(matchedCount);
    });
    
    // Match failed - schedule flip back
    subscribe('game:matchFailed', ({ firstId, secondId }) => {
      setTimeout(() => {
        flipCardsFaceDown(firstId, secondId);
      }, FLIP_BACK_DELAY_MS);
    });
    
    // Move count changed
    subscribe('game:moveCountChanged', ({ moves }) => {
      updateMoves(moves);
    });
    
    // Timer tick
    subscribe('game:timerTick', ({ elapsedSeconds }) => {
      updateTimer(elapsedSeconds);
    });
    
    // Game won
    subscribe('game:won', ({ moves, elapsedSeconds }) => {
      showWinOverlay(moves, elapsedSeconds);
    });
  }

  function mount() {
    // Resolve DOM refs
    els.board      = rootEl.querySelector('[data-role="board"]');
    els.moves      = rootEl.querySelector('[data-role="moves"]');
    els.timer      = rootEl.querySelector('[data-role="timer"]');
    els.matched    = rootEl.querySelector('[data-role="matched"]');
    els.restart    = rootEl.querySelector('[data-role="restart"]');
    els.playAgain  = rootEl.querySelector('[data-role="play-again"]');
    els.winOverlay = rootEl.querySelector('[data-role="win-overlay"]');
    els.winMoves   = rootEl.querySelector('[data-role="win-moves"]');
    els.winTime    = rootEl.querySelector('[data-role="win-time"]');

    // Attach DOM listeners
    els.board.addEventListener('click', onBoardClick);
    els.restart.addEventListener('click', onRestartClick);
    els.playAgain.addEventListener('click', onRestartClick);

    // Subscribe to service events
    wireSubscriptions();
  }

  function unmount() {
    // Detach DOM listeners
    els.board.removeEventListener('click', onBoardClick);
    els.restart.removeEventListener('click', onRestartClick);
    els.playAgain.removeEventListener('click', onRestartClick);

    // Detach all bus subscriptions
    subscriptions.forEach(({ event, handler }) => eventBus.off(event, handler));
    subscriptions.length = 0;
  }

  return Object.freeze({ mount, unmount });
}