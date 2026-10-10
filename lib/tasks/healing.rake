# frozen_string_literal: true

namespace :healing do
  # The theme's spec draws every page from spec/fixtures/cms/snapshot.json.
  # This refreshes it from the CMS the site runs on, through the cms CLI
  # (CMS_PROFILE picks which), so a change to the content model there shows
  # up as a failing spec here before it shows up as a broken page.
  desc "Refresh spec/fixtures/cms/snapshot.json from the CMS (the cms CLI; CMS_PROFILE)"
  task :snapshot do
    cms = ->(*args) { JSON.parse(IO.popen(["cms", *args, "--raw"], &:read).presence || abort("cms #{args.join(" ")} failed")) }
    keep = ->(record, *keys) { record.slice(*keys) }

    content = cms.("get", "/api/v1/content")["data"]
    snapshot = {
      "block_types" => cms.("blocks")["block_types"].map { keep.(it, "slug", "label", "category", "version", "fields", "defaults") },
      "collections" => cms.("collections")["collections"].map { keep.(it, "slug", "name", "enable_blocks", "schema") },
      "globals" => cms.("globals")["globals"].map { keep.(it, "slug", "name", "data", "fields") },
      "pages" => content["pages"].map { keep.(it, "path", "slug", "title", "locale", "blocks", "frontmatter", "seo") },
      "entries" => content["entries"].map { keep.(it, "collection", "slug", "title", "locale", "frontmatter", "body_markdown", "seo") },
      "forms" => cms.("forms")["forms"].map { keep.(it, "slug", "title", "fields", "submit_label", "success_message") },
      "site" => keep.(cms.("get", "/api/v1/site")["data"], "name", "description")
    }
    path = Healing::Engine.root.join("spec/fixtures/cms/snapshot.json")
    path.write(JSON.pretty_generate(snapshot))
    puts "#{path}: #{snapshot.transform_values(&:size).to_h}"
  end
end
