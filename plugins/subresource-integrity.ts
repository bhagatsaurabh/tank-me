import { createHash } from 'crypto';
import { Cheerio, Element, load } from 'cheerio';
import { Plugin, IndexHtmlTransformContext } from 'vite';
import { OutputAsset, OutputChunk } from 'rollup';

type AsyncForEachCB = (e: Element) => Promise<void>;
interface SRICheerioAPI extends Cheerio<Element> {
  asyncForEach: (callback: AsyncForEachCB) => Promise<void>;
}

const SRI: () => Plugin = () => ({
  name: 'vite-plugin-tankme-sri',
  enforce: 'post',
  apply: 'build',

  async transformIndexHtml(html: string, context: IndexHtmlTransformContext) {
    const bundle = context.bundle;
    if (!bundle) return;

    const calculateIntegrityHashes = async (element: Element) => {
      let source: string | Uint8Array;
      const attributeName = element.attribs.src ? 'src' : 'href';
      const resourcePath = element.attribs[attributeName];
      if (resourcePath.startsWith('http')) {
        source = await (await fetch(resourcePath)).text();
      } else {
        const resourcePathWithoutLeadingSlash = element.attribs[attributeName].slice(1);
        if (resourcePathWithoutLeadingSlash === 'registerSW.js') return;

        const bundleItem = bundle[resourcePathWithoutLeadingSlash];
        source = (bundleItem as OutputChunk).code || (bundleItem as OutputAsset).source;
        if (typeof source !== 'string') source = new TextDecoder().decode(source);
      }
      element.attribs.integrity = `sha512-${createHash('sha512')
        .update(source)
        .digest()
        .toString('base64')}`;
    };

    const $ = load(html);
    $.prototype.asyncForEach = async function (callback: (e: Element) => Promise<void>) {
      for (let idx = 0; idx < this.length; idx += 1) {
        await callback(this[idx]);
      }
    };

    const scripts = $('script').filter('[src]');
    const stylesheets = $('link[rel=stylesheet]').filter('[href]');

    await (scripts as SRICheerioAPI).asyncForEach(calculateIntegrityHashes);
    await (stylesheets as SRICheerioAPI).asyncForEach(calculateIntegrityHashes);

    return $.html();
  }
});

export default SRI;
