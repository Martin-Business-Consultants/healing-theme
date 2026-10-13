// healingearthdesignbysarah.com at Cloudflare's edge, ahead of the CMS:
// - www.healingearthdesignbysarah.com redirects (301) to the address
//   without www, keeping the path and query, so the site has one home;
// - /robots.txt is fetched from the CMS on every request, past Cloudflare's
//   cache (which holds an old copy for a year) and the CMS's own. The CMS generates it from
//   Settings › Search (AI crawlers, extra lines, the sitemap), so that's
//   where robots.txt is managed.
// Everything else passes straight through to the site.
const HOST = "healingearthdesignbysarah.com"

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.hostname === `www.${HOST}`) {
      url.hostname = HOST
      url.protocol = "https:"
      return Response.redirect(url.toString(), 301)
    }
    if (url.pathname === "/robots.txt") {
      // A fresh query each time also skips the CMS's own hour-long cache, so a
      // change in Settings › Search shows at once.
      const fresh = new URL(url)
      fresh.searchParams.set("fresh", Date.now())
      const origin = await fetch(new Request(fresh, request), { cache: "no-store" })
      const response = new Response(origin.body, origin)
      response.headers.set("cache-control", "public, max-age=300")
      return response
    }
    return fetch(request)
  },
}
