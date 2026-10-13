# Healing Earth Design theme

healingearthdesignbysarah.com, drawn by Libre Publish: the site's layout,
a partial per block type, the service and case study pages, its form
emails, and its stylesheet and scripts. Plain ERB and CSS and an importmap;
nothing is built. How themes work: Libre Publish's docs/themes.md.

## Working on it

Clone it into a Libre Publish checkout as `themes/healing`, then
`bin/dev`. With the site's content in the CMS (or the snapshot below
loaded), the site is at `/` and the admin at `/sign_in`.

    bin/rspec themes/healing/spec                          # every page, from the snapshot
    bundle exec herb lint themes --fail-level warning      # templates, accessibility included
    CMS_PROFILE=healing bin/rails healing:snapshot         # refresh the snapshot from the CMS

The site's motion is Motion (motion.dev), vendored as one module in
`app/javascript/healing/vendor/motion.js` (its header says how to rebuild
it). The service area map, `app/views/website/shared/_area_map.html.erb`, is
drawn from US Census county outlines by `script/area_map.py` (its docstring
says where to get them); run it again to change the towns or the frame.

The commercial pages read their numbers from the CMS: each industry's
research figures and ROI assumptions are on the industry (Industries), and
the calculator's maturity ramps, lawn savings and starting figures are in
Site settings › ROI calculator. The planner is the "commercial" form, drawn
in steps by `shared/_planner`.

`spec/fixtures/cms/snapshot.json` is the CMS's content model and content.
The spec draws every page and entry from it, so a template reading a field
the CMS doesn't declare fails here before it breaks a page.

## At Cloudflare's edge

`cloudflare/edge-worker` runs ahead of the site: it redirects
`www.healingearthdesignbysarah.com` to the address without www, and answers
`/robots.txt` as the CMS would, because a static robots.txt left on the
server shadows the CMS's own. Deploy it with `npx wrangler deploy` from that
folder (logged in to the Healing Earth Design Cloudflare account). If
Settings › Search changes what robots.txt should say, change it there too, or
delete the server's `public/robots.txt` and drop the Worker's robots route.

## Installing it

In the site's Libre Publish admin: Settings › Plugins › Add a plugin, and
give `Martin-Business-Consultants/healing-theme`. It installs the latest
release and restarts; the site is at `/` while the theme is switched on.
Publish a release here (a tag, `v0.2.0`, and a GitHub release) and the
theme's Update button takes it.

Proprietary. Copyright Martin Business Consultants.
