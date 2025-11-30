/**
 * Socket.IO mock utilities for testing
 */
/* global jest */

/**
 * Creates a mock Socket.IO socket object
 * @param {Object} options - Configuration options
 * @param {Object} options.user - User data to attach to socket.data
 * @returns {Object} Mock socket object with jest functions
 */
export function createMockSocket(options = {}) {
  const { user = { id: 1, username: "testuser", email: "test@test.com" } } =
    options;

  const eventHandlers = new Map();

  const mockSocket = {
    id: "mock-socket-id",
    data: { user },
    // Store event handlers for later triggering
    on: jest.fn((event, handler) => {
      eventHandlers.set(event, handler);
    }),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
    emit: jest.fn(),
    // Helper to trigger registered event handlers
    _trigger: async (event, ...args) => {
      const handler = eventHandlers.get(event);
      if (handler) {
        return await handler(...args);
      }
    },
    _getHandler: (event) => eventHandlers.get(event),
    _handlers: eventHandlers,
  };

  return mockSocket;
}

/**
 * Creates a mock Socket.IO server (io) object
 * @returns {Object} Mock io object with jest functions
 */
export function createMockIo() {
  const mockEmit = jest.fn();

  const mockIo = {
    to: jest.fn(() => ({
      emit: mockEmit,
    })),
    emit: jest.fn(),
    socketsLeave: jest.fn(),
    _mockEmit: mockEmit,
  };

  return mockIo;
}

/**
 * Creates a mock callback function for socket acknowledgements
 * @returns {jest.Mock} Mock callback function
 */
export function createMockCallback() {
  return jest.fn();
}

/**
 * Helper to reset all mocks between tests
 * @param {Object} io - Mock io object
 * @param {Object} socket - Mock socket object
 */
export function resetMocks(io, socket) {
  jest.clearAllMocks();
  if (socket._handlers) {
    socket._handlers.clear();
  }
}
