/**
 * Sets up Swagger UI for the given router and default prefix.
 * @param {Object} router - The Koa router object.
 * @param {string} defaultPrefix - The default prefix for the Swagger UI.
 */
const setupSwaggerUI = (router, defaultPrefix) => {
  const fs = require('fs')
  const swaggerUiAssetPath = require("swagger-ui-dist").getAbsoluteFSPath();
  // Mount in your favourite path eg. '/swagger'
  router.get('/swagger', ctx => {
    ctx.type = 'html';
    let fileAsString = fs.readFileSync(`${swaggerUiAssetPath}/index.html`);//
    ctx.body = String(fileAsString).replace(/url\: \"https.*/m, `url: "${defaultPrefix}/openapi.json",`);
  });
  // Following static assets do not recognize relative paths.
  router.get('/swagger/swagger-ui.css', ctx => {
    ctx.type = "text/css";
    ctx.body = fs.readFileSync(require.resolve("swagger-ui-dist/swagger-ui.css")); // fs.createReadStream(`${swaggerUiAssetPath}\\swagger-ui.css`);
  });
  router.get('/swagger/swagger-ui-bundle.js', ctx => {
    ctx.type = "application/javascript"
    ctx.body = fs.readFileSync(require.resolve("swagger-ui-dist/swagger-ui-bundle.js")); // fs.createReadStream(`${swaggerUiAssetPath}\\swagger-ui-bundle.js`);
  });
  router.get('/swagger/swagger-ui-standalone-preset.js', ctx => {
    ctx.type = "application/javascript"
    ctx.body = fs.readFileSync(require.resolve("swagger-ui-dist/swagger-ui-standalone-preset.js")); //  fs.createReadStream(`${swaggerUiAssetPath}\\swagger-ui-standalone-preset.js`);
  });
  router.get('/swagger/swagger-initializer.js', ctx => {
    ctx.type = "application/javascript"
    ctx.body =  //fs.readFileSync(require.resolve("swagger-ui-dist/swagger-initializer.js")); //  fs.createReadStream(`${swaggerUiAssetPath}\\swagger-ui-standalone-preset.js`);
    `window.ui = SwaggerUIBundle({
      url: "${defaultPrefix}/openapi.json",
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset
      ],
      plugins: [
        SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: "StandaloneLayout"
    });`;
  });
};

module.exports = setupSwaggerUI;
