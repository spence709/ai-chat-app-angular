export enum MessageSender {
  USER = "user",
  AI = "ai",
  SYSTEM = "system",
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: number;
  isError?: boolean;
  isPending?: boolean;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  processingTime?: number;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  finishReason?: string;
  [key: string]: any;
}

export interface ChatHistory {
  messages: ChatMessage[];
  metadata: ConversationMetadata;
}

export interface ConversationMetadata {
  id: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  totalMessages: number;
  userMessageCount: number;
  aiMessageCount: number;
  totalTokensUsed?: number;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
}

export interface OpenAIRequestBase {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  user?: string;
}

export interface OpenAIChatRequest extends OpenAIRequestBase {
  messages: OpenAIChatMessage[];
  stream?: boolean;
}

export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIChatChoice {
  index: number;
  message: OpenAIChatMessage;
  finish_reason: string;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
  progress?: number;
  cancelable?: boolean;
}

export interface ErrorState {
  hasError: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: any;
  retryable?: boolean;
}

export interface ChatAppState {
  chatHistory: ChatHistory;
  loading: LoadingState;
  error: ErrorState;
  currentInput: string;
  isInputDisabled: boolean;
  selectedConversation?: string;
  availableModels?: string[];
  selectedModel?: string;
  userSettings?: UserSettings;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  fontSize: "small" | "medium" | "large";
  sendOnEnter: boolean;
  showTimestamps: boolean;
  enableSounds: boolean;
  enableNotifications: boolean;
  defaultModel: string;
  maxHistoryLength: number;
  autoSaveInterval: number;
}
