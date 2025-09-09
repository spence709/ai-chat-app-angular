import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { AppModule } from "./app/app.module";
import { environment } from "./environments/environment";

if (environment.production) {
  enableProdMode();

  if (window.console) {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = function () {};

    console.error = function (...args) {
      originalConsoleError.apply(console, args);
    };

    console.warn = function (...args) {
      originalConsoleWarn.apply(console, args);
    };
  }
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => {
    console.error("Application initialization failed", err);

    const rootElement = document.getElementsByTagName("app-root")[0];
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="font-family: sans-serif; padding: 20px; text-align: center; background-color: #f8d7da; color: #721c24; border-radius: 4px; margin: 20px;">
          <h2>Application Failed to Start</h2>
          <p>We're sorry, but the application could not be initialized. Please try refreshing the page.</p>
          <p>If the problem persists, please contact support.</p>
          <button onclick="location.reload()" style="background-color: #721c24; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      `;
    }
  });
