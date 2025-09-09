import {
  Component,
  OnInit,
  ErrorHandler,
  Injectable,
  Injector,
  OnDestroy,
} from "@angular/core";
import { Router, NavigationEnd, NavigationError } from "@angular/router";
import { Subscription, filter } from "rxjs";
import { environment } from "../environments/environment";

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: any): void {
    const router = this.injector.get(Router);

    console.error("Application Error:", error);

    if (environment.production) {
      if (error.status === 401) {
        alert("Authentication error. Please check your API key.");
      } else if (error.status === 429) {
        alert("Rate limit exceeded. Please try again later.");
      } else {
        alert("An unexpected error occurred. Please try refreshing the page.");
      }
    }
  }
}

@Component({
  selector: "app-root",
  template: `
    <div class="app-container min-h-screen flex flex-col">
      <div
        *ngIf="hasError"
        class="bg-error-light dark:bg-error-dark text-error dark:text-error-light p-4 text-center"
      >
        {{ errorMessage }}
        <button
          (click)="dismissError()"
          class="ml-4 px-2 py-1 bg-white dark:bg-gray-800 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Dismiss
        </button>
      </div>

      <router-outlet></router-outlet>
    </div>
  `,
  styles: [
    `
      .app-container {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background-color: var(--app-bg-color, #f9fafb);
        color: var(--app-text-color, #111827);
        transition: background-color 0.2s ease, color 0.2s ease;
      }

      :host-context(.dark) .app-container {
        --app-bg-color: #111827;
        --app-text-color: #f9fafb;
      }
    `,
  ],
  providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }],
})
export class AppComponent implements OnInit, OnDestroy {
  title = "AI Chat App";
  hasError = false;
  errorMessage = "";
  private subscriptions: Subscription[] = [];

  constructor(private router: Router, private errorHandler: ErrorHandler) {}

  ngOnInit(): void {
    this.initializeApp();

    this.monitorRouteChanges();

    this.checkDarkModePreference();

    if (!environment.production) {
      console.log(`${this.title} initialized in development mode`);
      console.log("Environment:", environment);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private initializeApp(): void {
    this.checkBrowserCompatibility();

    this.setupErrorListeners();

    document.title = this.title;
  }

  private monitorRouteChanges(): void {
    const navEndSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (!environment.production && environment.debug?.enabled) {
          console.log("Navigation complete:", event.url);
        }
      });

    const navErrorSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationError))
      .subscribe((event: any) => {
        this.showError(`Navigation error: ${event.error.message}`);

        if (!environment.production) {
          console.error("Navigation error:", event.error);
        }
      });

    this.subscriptions.push(navEndSub, navErrorSub);
  }

  private checkBrowserCompatibility(): void {
    if (!this.isLocalStorageAvailable()) {
      this.showError(
        "Your browser does not support localStorage, which is required for this application."
      );
    }

    if (!window.fetch) {
      this.showError(
        "Your browser does not support fetch API, which is required for this application."
      );
    }
  }

  private setupErrorListeners(): void {
    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);

      if (environment.production) {
        this.showError(
          "An unexpected error occurred. Please try refreshing the page."
        );
      }
    });
  }

  private isLocalStorageAvailable(): boolean {
    try {
      const test = "test";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  private checkDarkModePreference(): void {
    const savedPreference = localStorage.getItem("darkMode");

    if (savedPreference === "true") {
      document.documentElement.classList.add("dark");
    } else if (savedPreference === "false") {
      document.documentElement.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      }
    }

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (localStorage.getItem("darkMode") === null) {
          if (e.matches) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
      });
  }

  private showError(message: string): void {
    this.hasError = true;
    this.errorMessage = message;
  }

  dismissError(): void {
    this.hasError = false;
    this.errorMessage = "";
  }
}
