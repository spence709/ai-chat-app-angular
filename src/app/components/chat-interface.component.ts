import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { AiService } from "../services/ai.service";
import { ChatStorageService } from "../services/chat-storage.service";
import {
  ChatMessage,
  MessageSender,
  LoadingState,
  ErrorState,
  ChatHistory,
} from "../models/chat.interface";
import { v4 as uuidv4 } from "uuid";

@Component({
  selector: "app-chat-interface",
  templateUrl: "./chat-interface.component.html",
  styleUrls: ["./chat-interface.component.scss"],
})
export class ChatInterfaceComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild("messageContainer") messageContainer!: ElementRef;
  @ViewChild("messageInput") messageInput!: ElementRef;

  messageForm!: FormGroup;
  messages: ChatMessage[] = [];
  isLoading = false;
  loadingMessage = "";
  hasError = false;
  errorMessage = "";
  isStreaming = false;
  streamedMessage: ChatMessage | null = null;
  private subscriptions: Subscription[] = [];
  MessageSender = MessageSender;
  showSettings = false;
  showTokenInfo = false;
  isMobile = false;
  darkMode = false;
  tokenUsage = 0;
  estimatedCost = 0;
  currentModel = "";
  autoScroll = true;

  constructor(
    private aiService: AiService,
    private chatStorage: ChatStorageService,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.messageForm = this.formBuilder.group({
      message: ["", [Validators.required, Validators.maxLength(4000)]],
    });
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.aiService.loading$.subscribe((loadingState: LoadingState) => {
        this.isLoading = loadingState.isLoading;
        this.loadingMessage = loadingState.loadingMessage || "Processing...";
        if (this.isLoading) {
          this.messageForm.disable();
        } else {
          this.messageForm.enable();
        }
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.push(
      this.aiService.error$.subscribe((errorState: ErrorState) => {
        this.hasError = errorState.hasError;
        this.errorMessage = errorState.errorMessage || "An error occurred";
        if (this.hasError && errorState.errorMessage) {
          this.addSystemMessage(errorState.errorMessage, true);
        }
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.push(
      this.aiService.tokenUsage$.subscribe((tokens: number) => {
        this.tokenUsage = tokens;
        this.estimatedCost = this.aiService.estimateCost();
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.push(
      this.chatStorage.currentConversation$
        .pipe(
          filter((conversation): conversation is ChatHistory => !!conversation)
        )
        .subscribe((conversation: ChatHistory) => {
          this.messages = conversation.messages;
          this.scrollToBottom();
          this.cdr.detectChanges();
        })
    );

    this.subscriptions.push(
      this.chatStorage.storageError$
        .pipe(filter((error): error is string => !!error))
        .subscribe((error: string) => {
          this.addSystemMessage(`Storage error: ${error}`, true);
          this.cdr.detectChanges();
        })
    );

    this.currentModel = this.aiService.getCurrentModel();

    if (!this.chatStorage.isStorageAvailable()) {
      this.addSystemMessage(
        "Local storage is not available. Your chat history will not be saved.",
        true
      );
    }

    this.checkIfMobile();
    this.initializeDarkMode();
    this.addWelcomeMessage();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
    this.focusMessageInput();
    window.addEventListener("resize", this.onResize.bind(this));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    window.removeEventListener("resize", this.onResize.bind(this));
  }

  sendMessage(): void {
    const messageText = this.messageForm.get("message")?.value;
    if (!messageText || messageText.trim() === "") {
      return;
    }
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sender: MessageSender.USER,
      content: messageText,
      timestamp: Date.now(),
    };
    this.chatStorage.addMessage(userMessage);
    this.messageForm.reset();
    this.focusMessageInput();
    this.aiService
      .sendMessage(messageText, this.messages, this.isStreaming)
      .subscribe({
        next: (response: ChatMessage) => {
          if (this.isStreaming) {
            if (!this.streamedMessage) {
              this.streamedMessage = response;
              this.chatStorage.addMessage(this.streamedMessage);
            } else {
              this.streamedMessage = response;
              if (!response.isPending) {
                this.streamedMessage = null;
              }
              const index = this.messages.findIndex(
                (m) => m.id === response.id
              );
              if (index !== -1) {
                this.messages[index] = response;
                this.cdr.detectChanges();
              }
            }
          } else {
            this.chatStorage.addMessage(response);
          }
          this.scrollToBottom();
        },
        error: (error) => {
          console.error("Error sending message:", error);
          this.messageForm.enable();
          this.focusMessageInput();
        },
      });
  }

  addSystemMessage(content: string, isError: boolean = false): void {
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      sender: MessageSender.SYSTEM,
      content,
      timestamp: Date.now(),
      isError,
    };
    this.chatStorage.addMessage(systemMessage);
  }

  addWelcomeMessage(): void {
    if (this.messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: uuidv4(),
        sender: MessageSender.AI,
        content: `Welcome to the AI Chat App! I'm here to help answer your questions and assist with various tasks. Feel free to ask me anything!`,
        timestamp: Date.now(),
      };
      this.chatStorage.addMessage(welcomeMessage);
    }
  }

  clearChat(): void {
    if (
      confirm(
        "Are you sure you want to clear the chat history? This action cannot be undone."
      )
    ) {
      this.chatStorage.clearCurrentConversation();
      this.addSystemMessage("Chat history cleared.");
      this.aiService.reset();
      this.addWelcomeMessage();
    }
  }

  newConversation(): void {
    if (confirm("Start a new conversation? Your current chat will be saved.")) {
      const conversationId = this.chatStorage.createNewConversation();
      this.chatStorage.loadConversation(conversationId);
      this.aiService.reset();
      this.addWelcomeMessage();
    }
  }

  toggleStreaming(): void {
    this.isStreaming = !this.isStreaming;
    this.addSystemMessage(
      `Streaming mode ${this.isStreaming ? "enabled" : "disabled"}.`
    );
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    if (this.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", this.darkMode ? "true" : "false");
    this.addSystemMessage(
      `Dark mode ${this.darkMode ? "enabled" : "disabled"}.`
    );
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  toggleTokenInfo(): void {
    this.showTokenInfo = !this.showTokenInfo;
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }

  isToday(timestamp: number): boolean {
    const today = new Date();
    const messageDate = new Date(timestamp);
    return (
      messageDate.getDate() === today.getDate() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getFullYear() === today.getFullYear()
    );
  }

  scrollToBottom(): void {
    if (!this.autoScroll) return;
    setTimeout(() => {
      if (this.messageContainer) {
        const container = this.messageContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  focusMessageInput(): void {
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    }, 100);
  }

  onResize(): void {
    this.checkIfMobile();
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  initializeDarkMode(): void {
    const savedPreference = localStorage.getItem("darkMode");
    if (savedPreference === "true") {
      this.darkMode = true;
    } else if (savedPreference === "false") {
      this.darkMode = false;
    } else {
      this.darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    if (this.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  onScroll(event: Event): void {
    const container = event.target as HTMLElement;
    const atBottom =
      container.scrollHeight - container.scrollTop <=
      container.clientHeight + 100;
    this.autoScroll = atBottom;
  }

  getMessageClasses(message: ChatMessage): string {
    const baseClasses = "p-4 rounded-message my-2 max-w-3xl";
    if (message.sender === MessageSender.USER) {
      return `${baseClasses} ml-auto bg-user dark:bg-user-dark text-gray-800 dark:text-gray-100`;
    } else if (message.sender === MessageSender.AI) {
      return `${baseClasses} mr-auto bg-ai dark:bg-ai-dark text-gray-800 dark:text-gray-100`;
    } else {
      if (message.isError) {
        return `${baseClasses} mx-auto bg-error-light dark:bg-error-dark text-error dark:text-error-light`;
      } else {
        return `${baseClasses} mx-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 italic text-sm`;
      }
    }
  }

  getMessageContainerClasses(message: ChatMessage): string {
    const baseClasses = "flex w-full";
    if (message.sender === MessageSender.USER) {
      return `${baseClasses} justify-end`;
    } else if (message.sender === MessageSender.AI) {
      return `${baseClasses} justify-start`;
    } else {
      return `${baseClasses} justify-center`;
    }
  }

  isMessageValid(): boolean {
    const messageControl = this.messageForm.get("message");
    return (
      !!messageControl &&
      messageControl.valid === true &&
      typeof messageControl.value === "string" &&
      messageControl.value.trim() !== ""
    );
  }

  trackById(_index: number, item: ChatMessage): string {
    return item.id;
  }

  getRemainingCharacters(): number {
    const messageControl = this.messageForm.get("message");
    const maxLength = 4000;
    if (messageControl?.value) {
      return maxLength - messageControl.value.length;
    }
    return maxLength;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (this.isMessageValid()) {
        this.sendMessage();
      }
    }
  }

  exportConversation(): void {
    const json = this.chatStorage.exportConversation();
    if (json) {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-chat-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.addSystemMessage("Conversation exported successfully.");
    } else {
      this.addSystemMessage("Failed to export conversation.", true);
    }
  }

  importConversation(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const json = e.target?.result as string;
        if (json) {
          const importedId = this.chatStorage.importConversation(json);
          if (importedId) {
            this.chatStorage.loadConversation(importedId);
            this.addSystemMessage("Conversation imported successfully.");
          } else {
            this.addSystemMessage("Failed to import conversation.", true);
          }
        }
      };
      reader.onerror = () => {
        this.addSystemMessage("Error reading file.", true);
      };
      reader.readAsText(file);
      fileInput.value = "";
    }
  }

  getStorageUsage(): { used: number; total: number; percentage: number } {
    return this.chatStorage.getStorageUsage();
  }

  retryLastMessage(): void {
    const lastUserMessage = [...this.messages]
      .reverse()
      .find((m) => m.sender === MessageSender.USER);
    if (lastUserMessage) {
      this.messageForm.setValue({ message: lastUserMessage.content });
      this.focusMessageInput();
    }
  }

  copyToClipboard(message: ChatMessage): void {
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        this.addSystemMessage("Message copied to clipboard.");
      })
      .catch((err) => {
        console.error("Failed to copy message:", err);
        this.addSystemMessage("Failed to copy message.", true);
      });
  }
}
