import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject, Subscription, interval } from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  takeUntil,
} from "rxjs/operators";
import { environment } from "../../environments/environment";
import {
  ChatHistory,
  ChatMessage,
  ConversationMetadata,
  MessageSender,
} from "../models/chat.interface";
import { v4 as uuidv4 } from "uuid";

@Injectable({
  providedIn: "root",
})
export class ChatStorageService {
  private readonly CHAT_HISTORY_KEY = environment.storage.chatHistory;
  private readonly USER_SETTINGS_KEY = environment.storage.userSettings;

  private readonly MAX_HISTORY_ITEMS = environment.app.maxHistoryItems;

  private readonly AUTO_SAVE_INTERVAL = 30000;

  private activeConversationId: string | null = null;

  private conversationsSubject = new BehaviorSubject<ConversationMetadata[]>(
    []
  );
  private currentConversationSubject = new BehaviorSubject<ChatHistory | null>(
    null
  );
  private storageErrorSubject = new BehaviorSubject<string | null>(null);

  public conversations$ = this.conversationsSubject.asObservable();
  public currentConversation$ = this.currentConversationSubject.asObservable();
  public storageError$ = this.storageErrorSubject.asObservable();

  private autoSaveSubscription: Subscription | null = null;
  private destroy$ = new Subject<void>();
  private saveSubject = new Subject<ChatHistory>();

  constructor() {
    this.initialize();

    this.setupAutoSave();

    this.setupDebouncedSave();
  }

  private initialize(): void {
    try {
      const conversations = this.loadAllConversationsMetadata();
      this.conversationsSubject.next(conversations);

      if (conversations.length === 0) {
        this.createNewConversation();
      } else {
        const mostRecent = conversations.sort(
          (a, b) => b.updatedAt - a.updatedAt
        )[0];
        this.loadConversation(mostRecent.id);
      }

      if (!environment.production && environment.debug?.enabled) {
        console.log(
          "Chat Storage Service initialized with",
          conversations.length,
          "conversations"
        );
      }
    } catch (error) {
      this.handleStorageError("Failed to initialize chat storage", error);
    }
  }

  private setupAutoSave(): void {
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }

    this.autoSaveSubscription = interval(this.AUTO_SAVE_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => !!this.currentConversationSubject.getValue())
      )
      .subscribe(() => {
        const currentConversation = this.currentConversationSubject.getValue();
        if (currentConversation) {
          this.saveConversation(currentConversation);

          if (!environment.production && environment.debug?.enabled) {
            console.log(
              "Auto-saved conversation:",
              currentConversation.metadata.id
            );
          }
        }
      });
  }

  private setupDebouncedSave(): void {
    this.saveSubject
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(1000),
        distinctUntilChanged((prev, curr) => {
          return JSON.stringify(prev) === JSON.stringify(curr);
        })
      )
      .subscribe((conversation) => {
        this.saveConversation(conversation);
      });
  }

  private loadAllConversationsMetadata(): ConversationMetadata[] {
    try {
      const conversationsJson = localStorage.getItem(
        `${this.CHAT_HISTORY_KEY}_index`
      );

      if (!conversationsJson) {
        return [];
      }

      const conversations = JSON.parse(
        conversationsJson
      ) as ConversationMetadata[];

      if (!Array.isArray(conversations)) {
        throw new Error("Invalid conversations index format");
      }

      return conversations;
    } catch (error) {
      this.handleStorageError("Failed to load conversations index", error);
      return [];
    }
  }

  private saveConversationsIndex(conversations: ConversationMetadata[]): void {
    try {
      localStorage.setItem(
        `${this.CHAT_HISTORY_KEY}_index`,
        JSON.stringify(conversations)
      );
    } catch (error) {
      this.handleStorageError("Failed to save conversations index", error);
    }
  }

  public createNewConversation(title?: string): string {
    try {
      const conversationId = uuidv4();
      const now = Date.now();

      const metadata: ConversationMetadata = {
        id: conversationId,
        title: title || `Conversation ${now}`,
        createdAt: now,
        updatedAt: now,
        totalMessages: 0,
        userMessageCount: 0,
        aiMessageCount: 0,
        totalTokensUsed: 0,
        tags: [],
        isFavorite: false,
        isArchived: false,
      };

      const newConversation: ChatHistory = {
        messages: [],
        metadata,
      };

      this.saveConversation(newConversation);

      const conversations = this.conversationsSubject.getValue();
      conversations.push(metadata);
      this.conversationsSubject.next(conversations);
      this.saveConversationsIndex(conversations);

      this.activeConversationId = conversationId;
      this.currentConversationSubject.next(newConversation);

      return conversationId;
    } catch (error) {
      this.handleStorageError("Failed to create new conversation", error);
      return "";
    }
  }

  public loadConversation(conversationId: string): boolean {
    try {
      const conversationJson = localStorage.getItem(
        `${this.CHAT_HISTORY_KEY}_${conversationId}`
      );

      if (!conversationJson) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const conversation = JSON.parse(conversationJson) as ChatHistory;

      this.validateConversation(conversation);

      this.activeConversationId = conversationId;
      this.currentConversationSubject.next(conversation);

      this.updateConversationTimestamp(conversationId);

      return true;
    } catch (error) {
      this.handleStorageError(
        `Failed to load conversation ${conversationId}`,
        error
      );
      return false;
    }
  }

  public saveConversation(conversation: ChatHistory): void {
    try {
      conversation.metadata.updatedAt = Date.now();

      localStorage.setItem(
        `${this.CHAT_HISTORY_KEY}_${conversation.metadata.id}`,
        JSON.stringify(conversation)
      );

      this.updateConversationInIndex(conversation.metadata);

      this.storageErrorSubject.next(null);
    } catch (error) {
      this.handleStorageError("Failed to save conversation", error);
    }
  }

  private updateConversationTimestamp(conversationId: string): void {
    const conversations = this.conversationsSubject.getValue();
    const index = conversations.findIndex((c) => c.id === conversationId);

    if (index !== -1) {
      conversations[index].updatedAt = Date.now();
      this.conversationsSubject.next(conversations);
      this.saveConversationsIndex(conversations);
    }
  }

  private updateConversationInIndex(metadata: ConversationMetadata): void {
    const conversations = this.conversationsSubject.getValue();
    const index = conversations.findIndex((c) => c.id === metadata.id);

    if (index !== -1) {
      conversations[index] = metadata;
    } else {
      conversations.push(metadata);
    }

    this.conversationsSubject.next(conversations);
    this.saveConversationsIndex(conversations);
  }

  public deleteConversation(conversationId: string): boolean {
    try {
      localStorage.removeItem(`${this.CHAT_HISTORY_KEY}_${conversationId}`);

      const conversations = this.conversationsSubject.getValue();
      const updatedConversations = conversations.filter(
        (c) => c.id !== conversationId
      );
      this.conversationsSubject.next(updatedConversations);
      this.saveConversationsIndex(updatedConversations);

      if (this.activeConversationId === conversationId) {
        if (updatedConversations.length > 0) {
          const mostRecent = updatedConversations.sort(
            (a, b) => b.updatedAt - a.updatedAt
          )[0];
          this.loadConversation(mostRecent.id);
        } else {
          this.createNewConversation();
        }
      }

      return true;
    } catch (error) {
      this.handleStorageError(
        `Failed to delete conversation ${conversationId}`,
        error
      );
      return false;
    }
  }

  public addMessage(message: ChatMessage): void {
    const currentConversation = this.currentConversationSubject.getValue();

    if (!currentConversation) {
      const conversationId = this.createNewConversation();
      this.loadConversation(conversationId);
      this.addMessage(message);
      return;
    }

    currentConversation.messages.push(message);

    currentConversation.metadata.totalMessages++;
    if (message.sender === MessageSender.USER) {
      currentConversation.metadata.userMessageCount++;
    } else if (message.sender === MessageSender.AI) {
      currentConversation.metadata.aiMessageCount++;

      if (message.metadata?.totalTokens) {
        currentConversation.metadata.totalTokensUsed =
          (currentConversation.metadata.totalTokensUsed || 0) +
          message.metadata.totalTokens;
      }
    }

    if (currentConversation.messages.length > this.MAX_HISTORY_ITEMS) {
      currentConversation.messages = currentConversation.messages.slice(
        currentConversation.messages.length - this.MAX_HISTORY_ITEMS
      );
    }

    this.currentConversationSubject.next({ ...currentConversation });

    this.saveSubject.next(currentConversation);
  }

  public clearCurrentConversation(): boolean {
    const currentConversation = this.currentConversationSubject.getValue();

    if (!currentConversation) {
      return false;
    }

    try {
      const clearedConversation: ChatHistory = {
        messages: [],
        metadata: {
          ...currentConversation.metadata,
          totalMessages: 0,
          userMessageCount: 0,
          aiMessageCount: 0,
          totalTokensUsed: 0,
          updatedAt: Date.now(),
        },
      };

      this.currentConversationSubject.next(clearedConversation);

      this.saveConversation(clearedConversation);

      return true;
    } catch (error) {
      this.handleStorageError("Failed to clear conversation", error);
      return false;
    }
  }

  public clearAllConversations(): boolean {
    try {
      const conversations = this.conversationsSubject.getValue();

      for (const conversation of conversations) {
        localStorage.removeItem(`${this.CHAT_HISTORY_KEY}_${conversation.id}`);
      }

      localStorage.removeItem(`${this.CHAT_HISTORY_KEY}_index`);
      this.conversationsSubject.next([]);

      this.createNewConversation();

      return true;
    } catch (error) {
      this.handleStorageError("Failed to clear all conversations", error);
      return false;
    }
  }

  public getCurrentConversation(): ChatHistory | null {
    return this.currentConversationSubject.getValue();
  }

  public getAllConversations(): ConversationMetadata[] {
    return this.conversationsSubject.getValue();
  }

  public getPaginatedMessages(
    page: number = 0,
    pageSize: number = 20
  ): ChatMessage[] {
    const currentConversation = this.currentConversationSubject.getValue();

    if (!currentConversation) {
      return [];
    }

    const start = page * pageSize;
    const end = start + pageSize;

    return currentConversation.messages.slice(start, end);
  }

  public exportConversation(conversationId?: string): string {
    try {
      const id = conversationId || this.activeConversationId;

      if (!id) {
        throw new Error(
          "No conversation ID provided and no active conversation"
        );
      }

      const conversationJson = localStorage.getItem(
        `${this.CHAT_HISTORY_KEY}_${id}`
      );

      if (!conversationJson) {
        throw new Error(`Conversation ${id} not found`);
      }

      return conversationJson;
    } catch (error) {
      this.handleStorageError("Failed to export conversation", error);
      return "";
    }
  }

  public exportAllConversations(): string {
    try {
      const conversations = this.conversationsSubject.getValue();
      const exportData: { [key: string]: ChatHistory } = {};

      for (const metadata of conversations) {
        const conversationJson = localStorage.getItem(
          `${this.CHAT_HISTORY_KEY}_${metadata.id}`
        );

        if (conversationJson) {
          exportData[metadata.id] = JSON.parse(conversationJson);
        }
      }

      return JSON.stringify({
        version: environment.app.version,
        timestamp: Date.now(),
        conversations: exportData,
      });
    } catch (error) {
      this.handleStorageError("Failed to export all conversations", error);
      return "";
    }
  }

  public importConversation(
    json: string,
    replace: boolean = false
  ): string | null {
    try {
      const conversation = JSON.parse(json) as ChatHistory;

      this.validateConversation(conversation);

      const conversations = this.conversationsSubject.getValue();
      const exists = conversations.some(
        (c) => c.id === conversation.metadata.id
      );

      if (exists && !replace) {
        const oldId = conversation.metadata.id;
        const newId = uuidv4();

        conversation.metadata.id = newId;
        conversation.metadata.title = `${
          conversation.metadata.title || "Imported Conversation"
        } (Imported)`;

        if (!environment.production && environment.debug?.enabled) {
          console.log(
            `Changed imported conversation ID from ${oldId} to ${newId}`
          );
        }
      }

      this.saveConversation(conversation);

      this.activeConversationId = conversation.metadata.id;
      this.currentConversationSubject.next(conversation);

      return conversation.metadata.id;
    } catch (error) {
      this.handleStorageError("Failed to import conversation", error);
      return null;
    }
  }

  public importMultipleConversations(
    json: string,
    replace: boolean = false
  ): string[] {
    try {
      const importData = JSON.parse(json);

      if (
        !importData.conversations ||
        typeof importData.conversations !== "object"
      ) {
        throw new Error("Invalid import format");
      }

      const importedIds: string[] = [];

      for (const id in importData.conversations) {
        const conversation = importData.conversations[id];

        this.validateConversation(conversation);

        const importedId = this.importConversation(
          JSON.stringify(conversation),
          replace
        );

        if (importedId) {
          importedIds.push(importedId);
        }
      }

      if (importedIds.length > 0) {
        this.loadConversation(importedIds[0]);
      }

      return importedIds;
    } catch (error) {
      this.handleStorageError("Failed to import multiple conversations", error);
      return [];
    }
  }

  private validateConversation(conversation: ChatHistory): void {
    if (!conversation || !conversation.metadata || !conversation.messages) {
      throw new Error(
        "Invalid conversation format: missing required properties"
      );
    }

    if (
      !conversation.metadata.id ||
      typeof conversation.metadata.createdAt !== "number" ||
      typeof conversation.metadata.updatedAt !== "number"
    ) {
      throw new Error("Invalid conversation metadata");
    }

    if (!Array.isArray(conversation.messages)) {
      throw new Error("Invalid messages format: not an array");
    }

    for (const message of conversation.messages) {
      if (
        !message.id ||
        !message.sender ||
        !message.content ||
        !message.timestamp
      ) {
        throw new Error("Invalid message format: missing required properties");
      }
    }
  }

  private handleStorageError(message: string, error: any): void {
    const errorMessage = `${message}: ${
      error instanceof Error ? error.message : String(error)
    }`;

    this.storageErrorSubject.next(errorMessage);

    if (!environment.production) {
      console.error("Chat Storage Error:", errorMessage, error);
    }
  }

  public isStorageAvailable(): boolean {
    try {
      const test = "test";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  public getStorageUsage(): {
    used: number;
    total: number;
    percentage: number;
  } {
    try {
      let totalSize = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || "";
          totalSize += key.length + value.length;
        }
      }

      const usedKB = Math.round(totalSize / 1024);

      const totalKB = 5120;

      return {
        used: usedKB,
        total: totalKB,
        percentage: Math.round((usedKB / totalKB) * 100),
      };
    } catch (error) {
      console.error("Failed to get storage usage", error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  public updateConversationTitle(
    conversationId: string,
    title: string
  ): boolean {
    try {
      const conversationJson = localStorage.getItem(
        `${this.CHAT_HISTORY_KEY}_${conversationId}`
      );

      if (!conversationJson) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const conversation = JSON.parse(conversationJson) as ChatHistory;

      conversation.metadata.title = title;

      this.saveConversation(conversation);

      if (this.activeConversationId === conversationId) {
        this.currentConversationSubject.next(conversation);
      }

      return true;
    } catch (error) {
      this.handleStorageError(
        `Failed to update conversation title for ${conversationId}`,
        error
      );
      return false;
    }
  }

  public toggleFavorite(conversationId: string): boolean {
    try {
      const conversationJson = localStorage.getItem(
        `${this.CHAT_HISTORY_KEY}_${conversationId}`
      );

      if (!conversationJson) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const conversation = JSON.parse(conversationJson) as ChatHistory;

      conversation.metadata.isFavorite = !conversation.metadata.isFavorite;

      this.saveConversation(conversation);

      if (this.activeConversationId === conversationId) {
        this.currentConversationSubject.next(conversation);
      }

      return conversation.metadata.isFavorite;
    } catch (error) {
      this.handleStorageError(
        `Failed to toggle favorite for ${conversationId}`,
        error
      );
      return false;
    }
  }

  public setArchiveStatus(conversationId: string, archive: boolean): boolean {
    try {
      const conversationJson = localStorage.getItem(
        `${this.CHAT_HISTORY_KEY}_${conversationId}`
      );

      if (!conversationJson) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const conversation = JSON.parse(conversationJson) as ChatHistory;

      conversation.metadata.isArchived = archive;

      this.saveConversation(conversation);

      if (this.activeConversationId === conversationId) {
        this.currentConversationSubject.next(conversation);
      }

      return true;
    } catch (error) {
      this.handleStorageError(
        `Failed to set archive status for ${conversationId}`,
        error
      );
      return false;
    }
  }

  public getFilteredConversations(filter: {
    searchTerm?: string;
    onlyFavorites?: boolean;
    includeArchived?: boolean;
    sortBy?: "updated" | "created" | "title";
    sortDirection?: "asc" | "desc";
  }): ConversationMetadata[] {
    const conversations = this.conversationsSubject.getValue();

    return conversations
      .filter((conversation) => {
        if (
          filter.searchTerm &&
          conversation.title &&
          !conversation.title
            .toLowerCase()
            .includes(filter.searchTerm.toLowerCase())
        ) {
          return false;
        }

        if (filter.onlyFavorites && !conversation.isFavorite) {
          return false;
        }

        if (!filter.includeArchived && conversation.isArchived) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const sortBy = filter.sortBy || "updated";
        const direction = filter.sortDirection === "asc" ? 1 : -1;

        if (sortBy === "updated") {
          return (a.updatedAt - b.updatedAt) * direction;
        } else if (sortBy === "created") {
          return (a.createdAt - b.createdAt) * direction;
        } else if (sortBy === "title") {
          return (a.title || "").localeCompare(b.title || "") * direction;
        }

        return 0;
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }
  }
}
