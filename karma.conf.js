module.exports = function (config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine", "@angular-devkit/build-angular"],
    plugins: [
      require("karma-jasmine"),
      require("karma-chrome-launcher"),
      require("karma-jasmine-html-reporter"),
      require("karma-coverage"),
      require("@angular-devkit/build-angular/plugins/karma"),
    ],
    client: {
      jasmine: {
        random: true,
        timeoutInterval: 10000,
      },
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: require("path").join(__dirname, "./coverage/ai-chat-app"),
      subdir: ".",
      reporters: [{ type: "html" }, { type: "text-summary" }, { type: "lcov" }],
      check: {
        global: {
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 70,
        },
      },
      fixWebpackSourcePaths: true,
    },
    reporters: ["progress", "kjhtml", "coverage"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ["Chrome", "ChromeHeadless"],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: "ChromeHeadless",
        flags: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      },
    },
    singleRun: false,
    restartOnFileChange: true,
    failOnEmptyTestSuite: false,
    captureTimeout: 210000,
    browserDisconnectTolerance: 3,
    browserDisconnectTimeout: 210000,
    browserNoActivityTimeout: 210000,
    files: [{ pattern: "./src/**/*.spec.ts", watched: false }],
    preprocessors: {
      "./src/**/*.spec.ts": ["@angular-devkit/build-angular"],
    },
    angularCli: {
      environment: "dev",
    },
  });
};
