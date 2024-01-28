import { createHash } from "crypto";
import cheerio from "cheerio";

const SRI = () => ({
  name: "vite-plugin-tankme-sri",
  enforce: "post",
  apply: "build",

  async transformIndexHtml(html, context) {
    const bundle = context.bundle;

    const calculateIntegrityHashes = async (element) => {
      let source;
      let attributeName = element.attribs.src ? "src" : "href";
      const resourcePath = element.attribs[attributeName];
      if (resourcePath.startsWith("http")) {
        source = await (await fetch(resourcePath)).text();
      } else {
        const resourcePathWithoutLeadingSlash =
          element.attribs[attributeName].slice(1);
        if (resourcePathWithoutLeadingSlash === "registerSW.js") return;

        const bundleItem = bundle[resourcePathWithoutLeadingSlash];
        source = bundleItem.code || bundleItem.source;
      }
      element.attribs.integrity = `sha512-${createHash("sha512")
        .update(source)
        .digest()
        .toString("base64")}`;
    };

    const $ = cheerio.load(html);
    $.prototype.asyncForEach = async function (callback) {
      for (let idx = 0; idx < this.length; idx += 1) {
        await callback(this[idx], idx, this);
      }
    };

    const scripts = $("script").filter("[src]");
    const stylesheets = $("link[rel=stylesheet]").filter("[href]");

    await scripts.asyncForEach(calculateIntegrityHashes);
    await stylesheets.asyncForEach(calculateIntegrityHashes);

    return $.html();
  },
});

export default SRI;
