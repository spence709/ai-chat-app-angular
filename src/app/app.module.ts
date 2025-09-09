import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { HttpClientModule } from "@angular/common/http";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { CommonModule } from "@angular/common";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { AppComponent } from "./app.component";
import { ChatInterfaceComponent } from "./components/chat-interface.component";

import { AiService } from "./services/ai.service";
import { ChatStorageService } from "./services/chat-storage.service";

const routes: Routes = [
  { path: "", component: ChatInterfaceComponent },
  { path: "**", redirectTo: "" },
];

@NgModule({
  declarations: [AppComponent, ChatInterfaceComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: "enabled",
      anchorScrolling: "enabled",
      initialNavigation: "enabledBlocking",
    }),
  ],
  providers: [
    AiService,
    ChatStorageService,
    {
      provide: "ENVIRONMENT",
      useValue: {
        production: true,
        apiUrl: "https://api.openai.com",
        apiVersion: "v1",
      },
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
