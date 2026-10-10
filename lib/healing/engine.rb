# frozen_string_literal: true

module Healing
  # A theme is an engine like a plugin: its views and helpers join the app's,
  # its assets join Propshaft's load path (app/assets/*/healing, so they
  # never collide with the admin's), and it registers with Website, which
  # turns the public site on. Its scripts get an importmap of their own
  # (config/importmap.rb), so the admin's never reach a visitor.
  class Engine < ::Rails::Engine
    initializer "healing.importmap", before: "importmap" do |app|
      app.config.assets.paths << root.join("app/javascript")
    end

    config.to_prepare do
      Website.register :healing, name: "Healing Earth Design", version: Healing::VERSION,
        views: Healing::Engine.root.join("app/views"), importmap: Importmap::Map.new.draw(Healing::Engine.root.join("config/importmap.rb"))
    end
  end
end
