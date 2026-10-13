// healingearthdesignbysarah.com at Cloudflare's edge, ahead of the CMS:
// - www.healingearthdesignbysarah.com redirects (301) to the address
//   without www, keeping the path and query, so the site has one home;
// - /robots.txt is answered here, as the CMS would generate it
//   (Website::Robots, with Settings › Search: AI search and training
//   allowed), because a static robots.txt left on the server shadows the
//   CMS's own. Once that file is deleted, this route can go.
// Everything else passes straight through to the site.
const HOST = "healingearthdesignbysarah.com"
const ROBOTS = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /cms/",
  "Disallow: /api/",
  "",
  `Sitemap: https://${HOST}/sitemap.xml`,
  "",
].join("\n")

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.hostname === `www.${HOST}`) {
      url.hostname = HOST
      url.protocol = "https:"
      return Response.redirect(url.toString(), 301)
    }
    if (url.pathname === "/robots.txt") {
      return new Response(ROBOTS, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } })
    }
    return fetch(request)
  },
}
