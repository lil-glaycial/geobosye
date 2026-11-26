const helmet = require("helmet");

const analyticsOrigin = "https://hm.baidu.com";
const loaderTag = '<script src="/assets/baidu-analytics.js" defer></script>';

function contentSecurityPolicy(publicPage = false) {
  return {
    directives: {
      defaultSrc: ["'self'"],
      // Baidu IM's Banti bootstrap requires Function() during initialization.
      // Browser verification confirms that blocking eval prevents the IM widget.
      scriptSrc: publicPage
        ? [
            "'self'",
            "'unsafe-eval'",
            analyticsOrigin,
            "https://goutong.baidu.com",
            "https://aff-im.cdn.bcebos.com",
            "https://aiff.cdn.bcebos.com",
            "https://banti-static.cdn.bcebos.com",
            "https://safe.cdn.bcebos.com",
            "https://passport.baidu.com",
            "https://affimvip.baidu.com",
          ]
        : ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: publicPage
        ? [
            "'self'",
            "data:",
            analyticsOrigin,
            "https://affimvip.baidu.com",
            "https://aff-im.bj.bcebos.com",
            "https://aff-im.cdn.bcebos.com",
            "https://sofire.baidu.com",
          ]
        : ["'self'", "data:"],
      connectSrc: publicPage
        ? [
            "'self'",
            analyticsOrigin,
            "https://affimvip.baidu.com",
            "https://sofire.baidu.com",
            "https://sfp.safe.baidu.com",
            "https://banti.baidu.com",
          ]
        : ["'self'"],
      ...(publicPage
        ? {
            frameSrc: ["'self'", "https://affimvip.baidu.com"],
            mediaSrc: ["'self'", "https://aifanfan.baidu.com"],
          }
        : {}),
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests:
        process.env.NODE_ENV === "production" ? [] : null,
    },
  };
}

function sendPublicPage(req, res, html) {
  helmet.contentSecurityPolicy(contentSecurityPolicy(true))(req, res, () => {
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.type("html").send(html.replace("</head>", loaderTag + "</head>"));
  });
}

module.exports = { contentSecurityPolicy, sendPublicPage };
