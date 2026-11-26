const helmet = require("helmet");

const analyticsOrigin = "https://hm.baidu.com";
const loaderTag = '<script src="/assets/baidu-analytics.js" defer></script>';

function contentSecurityPolicy(publicPage = false) {
  const sources = publicPage ? ["'self'", analyticsOrigin] : ["'self'"];
  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: sources,
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: publicPage
        ? ["'self'", "data:", analyticsOrigin]
        : ["'self'", "data:"],
      connectSrc: sources,
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests:
        process.env.NODE_ENV === "production" ? [] : null,
    },
  };
}

function sendPublicPage(req, res, html) {
  helmet.contentSecurityPolicy(contentSecurityPolicy(true))(req, res, () => {
    res.type("html").send(html.replace("</head>", loaderTag + "</head>"));
  });
}

module.exports = { contentSecurityPolicy, sendPublicPage };
