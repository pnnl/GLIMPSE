const path = require("path");

module.exports = {
   mode: "development",
   entry: "./renderer/src/index.js",
   devtool: "inline-source-map",
   target: "electron-renderer",
   module: {
      rules: [
         {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
               loader: "babel-loader",
               options: {
                  presets: [
                     [
                        "@babel/preset-env",
                        {
                           targets: {
                              esmodules: true,
                           },
                        },
                     ],
                     "@babel/preset-react",
                  ],
               },
            },
         },
         {
            test: [/\.css$/i],
            use: [
               // Creates `style` nodes from JS strings
               "style-loader",
               // Translates CSS into CommonJS
               "css-loader",
            ],
         },
      ],
   },
   resolve: {
      extensions: [".js"],
   },
   output: {
      filename: "renderer.js",
      path: path.resolve(__dirname, "renderer", "build"),
   },
};
