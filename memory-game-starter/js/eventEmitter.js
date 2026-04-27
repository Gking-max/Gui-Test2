// ============================================================================
// eventEmitter.js — Pub/Sub factory (Observer Pattern core)
// ============================================================================
//
// WHAT THIS IS
//   A reusable event bus. The game service uses this to notify the UI layer
//   about state changes without ever touching the DOM. The UI layer uses
//   this to subscribe to events it cares about.
//
// OBSERVER PATTERN — why this matters
//   The service (subject) does not know who is listening. The UI (observer)
//   does not know how the service computes state. They communicate only
//   through named events and payloads. This is the contract you must respect.
//
// REQUIREMENTS
//   - No classes. Factory function + closure only.
//   - No `this`.
//   - Multiple listeners per event name must be supported.
//   - `off` must remove only the specific listener passed in, not all
//     listeners for that event.
//   - `emit` must call every listener for the event with the given payload.
//   - If `emit` is called for an event that has no listeners, it should
//     silently do nothing (no errors).
//   - Listener errors must not prevent other listeners from running.
//
// PUBLIC API (do not change these signatures)
//   const bus = createEventEmitter();
//   bus.on(eventName, listenerFn);     // subscribe
//   bus.off(eventName, listenerFn);    // unsubscribe
//   bus.emit(eventName, payload);      // notify all subscribers
//
// HINT
//   The internal store is a plain object whose keys are event names and
//   whose values are arrays of listener functions. The object lives in
//   closure — never expose it.
// ============================================================================

// ============================================================================
// eventEmitter.js — Pub/Sub factory (Observer Pattern core)
// ============================================================================

export function createEventEmitter() {
  // Private listeners store in closure
  const listeners = {};

  function on(eventName, listener) {
    // Validate listener is a function
    if (typeof listener !== 'function') {
      throw new TypeError(`Listener for event "${eventName}" must be a function`);
    }
    
    // Create array for event if it doesn't exist
    if (!listeners[eventName]) {
      listeners[eventName] = [];
    }
    
    // Push the listener
    listeners[eventName].push(listener);
  }

  function off(eventName, listener) {
    // If no listeners for this event, return quietly
    if (!listeners[eventName]) {
      return;
    }
    
    // Filter out the matching listener (create new array to avoid mutation issues)
    listeners[eventName] = listeners[eventName].filter(
      existingListener => existingListener !== listener
    );
    
    // Clean up empty arrays
    if (listeners[eventName].length === 0) {
      delete listeners[eventName];
    }
  }

  function emit(eventName, payload) {
    // If no listeners, return silently
    if (!listeners[eventName]) {
      return;
    }
    
    // Call each listener with payload, catching errors
    listeners[eventName].forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error in listener for event "${eventName}":`, error);
      }
    });
  }

  return Object.freeze({ on, off, emit });
}