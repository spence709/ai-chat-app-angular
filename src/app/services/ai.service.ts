import { Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from "@angular/common/http";
import { BehaviorSubject, Observable, Subject, throwError } from "rxjs";
import { catchError, finalize, map, retry, timeout } from "rxjs/operators";
import { environment } from "../../environments/environment";
import {
  ChatMessage,
  MessageSender,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatMessage,
  LoadingState,
  ErrorState,
} from "../models/chat.interface";
import { v4 as uuidv4 } from "uuid";

@Injectable({
  providedIn: "root",
})
export class AiService {
  private loadingState = new BehaviorSubject<LoadingState>({
    isLoading: false,
  });
  private errorState = new BehaviorSubject<ErrorState>({ hasError: false });
  private tokenUsage = new BehaviorSubject<number>(0);

  public loading$ = this.loadingState.asObservable();
  public error$ = this.errorState.asObservable();
  public tokenUsage$ = this.tokenUsage.asObservable();

  private apiUrl = `${environment.openai.apiUrl}/${environment.openai.apiVersion}`;
  private defaultModel = environment.openai.model;
  private defaultParams = environment.openai.defaultParams;
  private apiKey = environment.openai.apiKey;
  private timeout = environment.openai.timeout;
  private retryConfig = environment.openai.retry;

  constructor(private http: HttpClient) {
    if (!environment.production && environment.debug?.enabled) {
      console.log("AI Service initialized with config:", {
        apiUrl: this.apiUrl,
        model: this.defaultModel,
        timeout: this.timeout,
        retry: this.retryConfig,
      });
    }
  }

  public sendMessage(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    streamResponse: boolean = false
  ): Observable<ChatMessage> {
    this.setLoading(true, "Generating AI response...");
    this.clearError();

    const messages = this.formatConversationForApi(
      conversationHistory,
      userMessage
    );

    const requestPayload: OpenAIChatRequest = {
      model: this.defaultModel,
      messages,
      stream: streamResponse,
      ...this.defaultParams,
    };

    const headers = this.createHeaders();

    if (streamResponse) {
      return this.streamChatCompletion(requestPayload, headers);
    } else {
      return this.getChatCompletion(requestPayload, headers);
    }
  }

  private getChatCompletion(
    requestPayload: OpenAIChatRequest,
    headers: HttpHeaders
  ): Observable<ChatMessage> {
    const startTime = Date.now();

    return this.http
      .post<OpenAIChatResponse>(
        `${this.apiUrl}${environment.openai.endpoints.chat}`,
        requestPayload,
        { headers }
      )
      .pipe(
        timeout(this.timeout),
        retry({
          count: this.retryConfig.attempts,
          delay: this.retryConfig.delay,
          resetOnSuccess: true,
        }),
        map((response) => {
          if (response.usage) {
            this.updateTokenUsage(response.usage.total_tokens);
          }
          const processingTime = Date.now() - startTime;
          return this.formatApiResponseToMessage(response, processingTime);
        }),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  private streamChatCompletion(
    requestPayload: OpenAIChatRequest,
    headers: HttpHeaders
  ): Observable<ChatMessage> {
    const responseSubject = new Subject<ChatMessage>();
    const startTime = Date.now();

    let accumulatedMessage: ChatMessage = {
      id: uuidv4(),
      sender: MessageSender.AI,
      content: "",
      timestamp: Date.now(),
      isPending: true,
    };

    this.setupStreamingRequest(
      requestPayload,
      headers,
      accumulatedMessage,
      responseSubject,
      startTime
    );

    return responseSubject.asObservable();
  }

  private setupStreamingRequest(
    requestPayload: OpenAIChatRequest,
    headers: HttpHeaders,
    accumulatedMessage: ChatMessage,
    responseSubject: Subject<ChatMessage>,
    startTime: number
  ): void {
    fetch(`${this.apiUrl}${environment.openai.endpoints.chat}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        if (!response.body) throw new Error("Response body is null");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        const readStream = () => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                accumulatedMessage.isPending = false;
                accumulatedMessage.metadata = {
                  ...accumulatedMessage.metadata,
                  processingTime: Date.now() - startTime,
                  model: this.defaultModel,
                };
                responseSubject.next({ ...accumulatedMessage });
                responseSubject.complete();
                this.setLoading(false);
                return;
              }

              const chunk = decoder.decode(value);
              const lines = chunk
                .split("\n")
                .filter(
                  (line) => line.trim() !== "" && line.trim() !== "data: [DONE]"
                );

              for (const line of lines) {
                try {
                  const jsonStr = line.replace(/^data: /, "").trim();
                  if (jsonStr) {
                    const json = JSON.parse(jsonStr);

                    if (json.choices && json.choices[0]?.delta?.content) {
                      accumulatedMessage.content +=
                        json.choices[0].delta.content;
                      responseSubject.next({ ...accumulatedMessage });
                    }

                    if (json.usage) {
                      this.updateTokenUsage(json.usage.total_tokens);
                      accumulatedMessage.metadata = {
                        ...accumulatedMessage.metadata,
                        totalTokens: json.usage.total_tokens,
                        promptTokens: json.usage.prompt_tokens,
                        completionTokens: json.usage.completion_tokens,
                      };
                    }

                    if (json.choices && json.choices[0]?.finish_reason) {
                      accumulatedMessage.metadata = {
                        ...accumulatedMessage.metadata,
                        finishReason: json.choices[0].finish_reason,
                      };
                    }
                  }
                } catch (e) {
                  console.error("Error parsing streaming response:", e);
                }
              }

              readStream();
            })
            .catch((error) => {
              console.error("Error reading stream:", error);
              this.handleStreamingError(error, responseSubject);
              this.setLoading(false);
            });
        };

        readStream();
      })
      .catch((error) => {
        console.error("Error fetching stream:", error);
        this.handleStreamingError(error, responseSubject);
        this.setLoading(false);
      });
  }

  private handleStreamingError(
    error: any,
    subject: Subject<ChatMessage>
  ): void {
    const errorMessage: ChatMessage = {
      id: uuidv4(),
      sender: MessageSender.SYSTEM,
      content: `Error: ${this.getErrorMessage(error)}`,
      timestamp: Date.now(),
      isError: true,
    };

    this.setError(true, this.getErrorMessage(error), error);
    subject.next(errorMessage);
    subject.complete();
  }

  private formatConversationForApi(
    history: ChatMessage[],
    newUserMessage: string
  ): OpenAIChatMessage[] {
    const formattedMessages: OpenAIChatMessage[] = [
      {
        role: "system",
        content:
          "You are a helpful AI assistant. Provide concise, accurate, and helpful responses.",
      },
    ];

    for (const message of history) {
      if (message.sender === MessageSender.SYSTEM || message.isError) continue;
      const role = message.sender === MessageSender.USER ? "user" : "assistant";
      formattedMessages.push({ role, content: message.content });
    }

    formattedMessages.push({ role: "user", content: newUserMessage });

    return formattedMessages;
  }

  private formatApiResponseToMessage(
    response: OpenAIChatResponse,
    processingTime: number
  ): ChatMessage {
    const content =
      response.choices[0]?.message?.content || "No response content";

    return {
      id: uuidv4(),
      sender: MessageSender.AI,
      content,
      timestamp: Date.now(),
      metadata: {
        model: response.model,
        processingTime,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        finishReason: response.choices[0]?.finish_reason,
      },
    };
  }

  private createHeaders(): HttpHeaders {
    return new HttpHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    });
  }

  private updateTokenUsage(tokens: number): void {
    const currentUsage = this.tokenUsage.getValue();
    this.tokenUsage.next(currentUsage + tokens);

    if (!environment.production && environment.debug?.enabled) {
      console.log(
        `Token usage updated: +${tokens} (Total: ${currentUsage + tokens})`
      );
    }
  }

  private setLoading(
    isLoading: boolean,
    message?: string,
    progress?: number
  ): void {
    this.loadingState.next({
      isLoading,
      loadingMessage: message,
      progress,
      cancelable: false,
    });
  }

  private setError(
    hasError: boolean,
    message?: string,
    details?: any,
    code?: string
  ): void {
    this.errorState.next({
      hasError,
      errorMessage: message,
      errorDetails: details,
      errorCode: code,
      retryable: true,
    });

    if (!environment.production && environment.debug?.enabled && hasError) {
      console.error("AI Service Error:", { message, details, code });
    }
  }

  private clearError(): void {
    this.errorState.next({ hasError: false });
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = this.getErrorMessage(error);
    this.setError(true, errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }

  private getErrorMessage(error: any): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0)
        return "Network error. Please check your internet connection.";
      if (error.status === 401)
        return "Authentication error. Please check your API key.";
      if (error.status === 429)
        return "Rate limit exceeded. Please try again later.";
      if (error.status === 500) return "Server error. Please try again later.";
      return `HTTP error ${error.status}: ${error.message}`;
    } else if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return "Request timed out. Please try again.";
      } else {
        return error.message;
      }
    } else {
      return "An unknown error occurred.";
    }
  }

  public reset(): void {
    this.setLoading(false);
    this.clearError();
    this.tokenUsage.next(0);
  }

  public getCurrentModel(): string {
    return this.defaultModel;
  }

  public setModel(model: string): void {
    this.defaultModel = model;
  }

  public getCurrentTokenUsage(): number {
    return this.tokenUsage.getValue();
  }

  public estimateCost(): number {
    const tokens = this.tokenUsage.getValue();
    if (this.defaultModel.includes("gpt-4")) {
      return (tokens / 1000) * 0.06;
    } else {
      return (tokens / 1000) * 0.002;
    }
  }
}
