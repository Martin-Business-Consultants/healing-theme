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

`spec/fixtures/cms/snapshot.json` is the CMS's content model and content.
The spec draws every page and entry from it, so a template reading a field
the CMS doesn't declare fails here before it breaks a page.

## Deploying

The site's Libre Publish install builds with it from the `CMS_THEME`
builder secret: this repository's URL with a token that can read it, and a
tag or commit.

    CMS_THEME="https://x-access-token:TOKEN@github.com/Martin-Business-Consultants/healing-theme#v0.1.0"

Proprietary. Copyright Martin Business Consultants.
