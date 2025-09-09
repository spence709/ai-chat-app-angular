export const environment = {
  production: false,

  // Development mode flags
  debug: {
    enabled: true,
    showApiRequests: true,
    showApiResponses: true,
    showPerformanceMetrics: true,
    mockResponses: false, // Set to true to use mock data instead of real API calls
    slowNetworkSimulation: false, // Simulates slow network for testing loading states
  },

  // Logging configuration
  logging: {
    level: "debug", // 'debug', 'info', 'warn', 'error'
    toConsole: true,
    toFile: false,
    includeTimestamp: true,
    logApiCalls: true,
    logStateChanges: true,
    logErrors: true,
    logPerformance: true,
  },

  // OpenAI API Configuration
  openai: {
    apiUrl: "https://api.openai.com",
    apiVersion: "v1",
    model: "gpt-3.5-turbo",
    apiKey: "", // Set this in your local environment or .env file

    // Development-friendly parameters
    defaultParams: {
      temperature: 0.7,
      max_tokens: 1024, // Reduced for faster responses during development
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    },

    // Endpoints
    endpoints: {
      completions: "/completions",
      chat: "/chat/completions",
      models: "/models",
    },

    // Shorter timeout for development
    timeout: 30000,

    // More aggressive retry for development
    retry: {
      attempts: 2,
      delay: 500,
    },
  },

  // Local storage keys
  storage: {
    chatHistory: "ai_chat_history_dev",
    userSettings: "ai_user_settings_dev",
  },

  // Application settings
  app: {
    name: "AI Chat App (Development)",
    version: "1.0.0-dev",
    maxHistoryItems: 100, // Increased for development testing
    enableDevTools: true,
    showDebugPanel: true,
  },
};
