module.exports = {
  plugins: [
    require("tailwindcss"),
    require("autoprefixer"),
    require("postcss-import"),
    require("postcss-preset-env")({
      browsers: "last 2 versions",
      stage: 3,
      features: {
        "nesting-rules": true,
      },
    }),
    ...(process.env.NODE_ENV === "production"
      ? [
          require("cssnano")({
            preset: [
              "default",
              {
                discardComments: {
                  removeAll: true,
                },
                normalizeWhitespace: false,
              },
            ],
          }),
        ]
      : []),
  ],
};
