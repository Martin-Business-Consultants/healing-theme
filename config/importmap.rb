# frozen_string_literal: true

# The website's scripts (Website.theme.importmap), apart from the admin's.
pin "healing", to: "healing/site.js"
pin_all_from Healing::Engine.root.join("app/javascript/healing"), under: "healing", to: "healing"
