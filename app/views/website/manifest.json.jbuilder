# frozen_string_literal: true

# The site as an app on a home screen.
json.name website_settings["title"].presence || "Healing Earth Design"
json.short_name "HED"
json.start_url "/"
json.display "standalone"
json.theme_color "#4a7c59"
json.background_color "#ffffff"
json.icons [192, 512] do |size|
  json.src asset_path("healing/favicons/web-app-manifest-#{size}x#{size}.png")
  json.sizes "#{size}x#{size}"
  json.type "image/png"
  json.purpose "maskable"
end
