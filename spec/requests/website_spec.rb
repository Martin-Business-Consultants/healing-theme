# frozen_string_literal: true

require "rails_helper"

# The theme against the CMS it draws: spec/fixtures/cms/snapshot.json is the
# content model and content of healingearthdesignbysarah.com (block types,
# collections, globals and the contact form, with their fields, and the
# pages and entries). Every page and entry is drawn from it, so a template
# that reads a field the CMS doesn't declare (Website::Fields) or a form
# field the form doesn't have fails here. Refresh the snapshot from the CMS
# with bin/rails healing:snapshot when its content model changes.
RSpec.describe "The Healing Earth Design website", type: :request, website: true do
  SNAPSHOT = JSON.parse(Healing::Engine.root.join("spec/fixtures/cms/snapshot.json").read)
  PARTIALS = Healing::Engine.root.glob("app/views/website/blocks/_*.html.erb").map { it.basename.to_s[/\A_(\w+)\./, 1] }

  before do
    switch_plugin :forms, on: true
    SNAPSHOT["block_types"].each { BlockType.create!(it) }
    SNAPSHOT["collections"].each { Collection.create!(it) }
    SNAPSHOT["globals"].each { |global| Global.create!(global.except("fields").merge("schema" => {"fields" => global["fields"]})) }
    SNAPSHOT["forms"].each { Form.create!(it.merge("status" => "published")) }
    SNAPSHOT["pages"].each { Page.create!(it.merge("status" => "published")) }
    SNAPSHOT["entries"].each do |entry|
      Collection.find_by!(slug: entry["collection"]).entries.create!(entry.except("collection").merge("status" => "published"))
    end
    Setting.set("general", {"title" => SNAPSHOT.dig("site", "name"), "description" => SNAPSHOT.dig("site", "description")})
  end

  SNAPSHOT["pages"].each do |page|
    path = page["path"] == "home" ? "/" : "/#{page["path"]}"

    it "draws #{path}, every one of its blocks" do
      get path

      expect(response).to have_http_status(:ok)
      expect(response.body).to include("<title>#{ERB::Util.h(page.dig("seo", "meta_title").presence || page["title"])}</title>")
      page["blocks"].each { expect(PARTIALS).to include(it["type"]) }
    end
  end

  SNAPSHOT["entries"].group_by { it["collection"] }.each do |collection, entries|
    drawn = Healing::Engine.root.join("app/views/website/entries/#{collection}.html.erb").exist?

    it "#{drawn ? "draws" : "has no pages for"} every #{collection} entry" do
      entries.each do |entry|
        get "/#{collection}/#{entry["slug"]}"

        expect(response).to have_http_status(drawn ? :ok : :not_found)
        expect(response.body).to include(ERB::Util.h(entry["title"])) if drawn
      end
    end
  end

  it "has a partial only for block types the CMS has" do
    expect(PARTIALS - SNAPSHOT["block_types"].map { it["slug"] }).to be_empty
  end

  it "draws its 404 from Site settings" do
    get "/no-such-page"

    expect(response).to have_http_status(:not_found)
    expect(response.body).to include(SNAPSHOT["globals"].find { it["slug"] == "site_settings" }.dig("data", "not_found", "heading"))
  end

  it "posts the quick contact form to the Forms plugin, with every field it draws" do
    get "/"
    form = Nokogiri::HTML5(response.body).at_css("form#contact-form-compact")
    names = form.css("input, select, textarea").map { it["name"] }.compact - [Form::HONEYPOT_FIELD]

    expect(names - Form.find_by!(slug: "contact").fields.map { it["name"] }).to be_empty

    post form["action"], params: {name: "Ann", email: "ann@example.com", message: "A shady yard", source: "contact"}, as: :json
    expect(response).to have_http_status(:created)
    expect(FormSubmission.last.data).to include("name" => "Ann", "source" => "contact")

    post form["action"], params: {name: "Ann", email: "ann@example.com"}, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "draws the garden planner in the contact section, every field the garden form has, and ticks a service's own choice on its page" do
    get "/contact"
    form = Nokogiri::HTML5(response.body).at_css("#contact form[data-planner]")
    garden = Form.find_by!(slug: "garden")
    names = form.css("input, select, textarea").map { it["name"] }.compact.uniq - [Form::HONEYPOT_FIELD]

    expect(names).to match_array(garden.fields.map { it["name"] })
    expect(form["action"]).to end_with("/garden/submissions")
    expect(form.css(".choice--service .choice__text").size).to eq(SNAPSHOT["entries"].count { it["collection"] == "services" && it.dig("frontmatter", "planner_choice").present? })

    post form["action"], params: {location: "Richland", sun: "Part sun, part shade", interest_herbs: "Yes", name: "Ann", email: "ann@example.com", source: "contact"}, as: :json
    expect(response).to have_http_status(:created)
    expect(FormSubmission.last.data).to include("sun" => "Part sun, part shade", "interest_herbs" => "Yes")

    service = SNAPSHOT["entries"].find { it["collection"] == "services" && it.dig("frontmatter", "planner_choice").present? }
    get "/services/#{service["slug"]}"
    expect(Nokogiri::HTML5(response.body).css("#contact form[data-planner] input[type=checkbox][checked]").map { it["name"] }).to eq([service.dig("frontmatter", "planner_choice")])
  end

  it "sends the contact form on to the thank-you page once Site settings has one, and keeps the thank-you on the form until then" do
    settings = Global.find_by!(slug: "site_settings")
    settings.update!(data: settings.data.merge("contact" => settings.data["contact"].except("thank_you_page")))
    get "/contact"
    expect(Nokogiri::HTML5(response.body).css("form[data-contact-form]").map { it["data-redirect"] }).to all(be_nil)

    settings.update!(data: settings.data.deep_merge("contact" => {"thank_you_page" => {"kind" => "page", "value" => "thank-you"}}))
    Page.find_or_create_by!(slug: "thank-you") do |page|
      page.assign_attributes(title: "Thank You", status: "published", locale: "en", blocks: [{"type" => "page_title", "version" => 1, "data" => {"heading" => "Thank you"}}])
    end

    get "/"
    expect(Nokogiri::HTML5(response.body).css("form[data-contact-form]").map { it["data-redirect"] }).to all(eq("/thank-you"))
    get "/thank-you"
    expect(response).to have_http_status(:ok)
  end

  it "shows Cloudflare Turnstile on its forms when Settings › Forms has the keys, and loads it only then" do
    get "/contact"
    expect(response.body).not_to include("cf-turnstile", "challenges.cloudflare.com")

    Setting.set(Forms::SETTING_KEY, {"captcha_provider" => "turnstile", "turnstile_site_key" => "0x4AAA-site", "turnstile_secret_key" => "0x4AAA-secret"})
    get "/contact"

    form = Nokogiri::HTML5(response.body).at_css("form[data-contact-form]")
    widget = form.at_css(".cf-turnstile")
    expect(widget["data-sitekey"]).to eq("0x4AAA-site")
    expect(widget["data-size"]).to eq("flexible")
    expect(widget["data-theme"]).to eq("auto")
    expect(response.body.scan("challenges.cloudflare.com/turnstile/v0/api.js").size).to eq(1)

    Setting.set(Forms::SETTING_KEY, {"captcha_theme" => "dark"})
    get "/contact"
    expect(Nokogiri::HTML5(response.body).at_css("form[data-contact-form] .cf-turnstile")["data-theme"]).to eq("dark")
  end

  it "designs the form's emails, filled in per submission" do
    form = Form.find_by!(slug: "contact")
    email = form.emails.find_or_initialize_by(kind: "confirmation")
    email.update!(subject: "Thanks, {{name}}", enabled: true, blocks: [
      {"type" => "email_heading", "version" => 1, "data" => {"text" => "Thank you, {{name}}", "level" => "h1"}},
      {"type" => "email_submission", "version" => 1, "data" => {"title" => "What you sent", "skip_empty" => true}}
    ])
    submission = form.submissions.create!(data: {"name" => "Ann", "email" => "ann@example.com", "message" => "Clay <b>soil</b>"}, meta: {}, ip: "127.0.0.1")

    mail = FormSubmissionMailer.with(form_email: email, submission:, recipients: ["ann@example.com"]).deliver.message
    html = (mail.html_part || mail).body.decoded

    expect(email.site_template_status).to eq(:theme)
    expect(mail.subject).to eq("Thanks, Ann")
    expect(html).to include("Thank you, Ann", SNAPSHOT.dig("site", "name"), "Clay &lt;b&gt;soil&lt;/b&gt;")
    expect(html.scan("data-cms-repeat").size + html.scan("{{").size).to eq(0)
    # No Branding logo: no empty image where it would go.
    expect(html).not_to include("<img", "data-cms-logo")

    logo = Asset.create!(folder: "/branding", file: {io: StringIO.new("PNG"), filename: "logo.png", content_type: "image/png"})
    Setting.set("branding", {"logo_id" => logo.id.to_s})
    mail = FormSubmissionMailer.with(form_email: email, submission:, recipients: ["ann@example.com"]).deliver.message
    expect(mail.html_part.body.decoded).to include(%(src="cid:logo@cms"))
    expect(mail.attachments.sole).to be_inline
  end

  it "posts the commercial planner to the Forms plugin, with every field it draws, in steps" do
    get "/commercial"
    page = Nokogiri::HTML5(response.body)
    form = page.at_css("form[data-planner]")
    commercial = Form.find_by!(slug: "commercial")
    names = form.css("input, select, textarea").map { it["name"] }.compact.uniq - [Form::HONEYPOT_FIELD]

    expect(names).to match_array(commercial.fields.map { it["name"] })
    expect(form.css("[data-planner-step]").size).to eq(5)
    expect(form.css('input[name="property_type"]').map { it["value"] }).to eq(commercial.fields.find { it["name"] == "property_type" }["options"].map { it["value"] })
    # Each service choice shows what that service includes.
    expect(form.css(".choice--service .choice__text").size).to eq(4)

    post form["action"], params: {property_type: "Office or corporate campus", location: "Portage", interest_garden_care: "Yes",
      name: "Ann", email: "ann@example.com", estimate: "Offices; 10 years", source: "commercial"}, as: :json
    expect(response).to have_http_status(:created)
    expect(FormSubmission.last.data).to include("property_type" => "Office or corporate campus", "interest_garden_care" => "Yes", "estimate" => "Offices; 10 years")

    post form["action"], params: {property_type: "Hardscaping", location: "Portage", name: "Ann", email: "ann@example.com"}, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "picks the planner's kind of property on an industry's page, and ticks the service on a service's page" do
    industry = SNAPSHOT["entries"].find { it["collection"] == "industries" }
    get "/industries/#{industry["slug"]}"
    expect(Nokogiri::HTML5(response.body).at_css('form[data-planner] input[name="property_type"][checked]')["value"]).to eq(industry.dig("frontmatter", "planner_choice"))

    service = SNAPSHOT["entries"].find { it["collection"] == "commercial" }
    get "/commercial/#{service["slug"]}"
    expect(Nokogiri::HTML5(response.body).css("form[data-planner] input[type=checkbox][checked]").map { it["name"] }).to eq([service.dig("frontmatter", "planner_choice")])
  end

  it "gives the ROI calculator every industry's assumptions, and an industry's page its own alone" do
    get "/commercial"
    config = JSON.parse(Nokogiri::HTML5(response.body).at_css("[data-roi]")["data-roi"])
    industries = SNAPSHOT["entries"].select { it["collection"] == "industries" }.sort_by { it.dig("frontmatter", "order") }

    expect(config["industries"].map { it["slug"] }).to eq(industries.map { it["slug"] })
    expect(config["industries"].first).to include("basis" => industries.first.dig("frontmatter", "calc_basis"),
      "low" => industries.first.dig("frontmatter", "calc_uplift_low").to_f, "high" => industries.first.dig("frontmatter", "calc_uplift_high").to_f)
    expect(config["ramp"]).to all(be_between(0, 1))
    expect(config["lawn"].size).to eq(2)

    get "/industries/#{industries.last["slug"]}"
    expect(JSON.parse(Nokogiri::HTML5(response.body).at_css("[data-roi]")["data-roi"])["industries"].map { it["slug"] }).to eq([industries.last["slug"]])
  end

  it "starts an industry's calculator from its own investment, care and lawn, else Site settings'" do
    calc = SNAPSHOT["globals"].find { it["slug"] == "site_settings" }.dig("data", "calculator")
    SNAPSHOT["entries"].select { it["collection"] == "industries" }.each do |industry|
      get "/industries/#{industry["slug"]}"
      form = Nokogiri::HTML5(response.body).at_css("[data-roi-form]")
      own = industry["frontmatter"]
      # Shown with commas: 15,000.
      value = ->(id) { form.at_css(id)["value"].delete(",").to_i }
      expect(value.("#roi-investment")).to eq(own["calc_investment_default"] || calc["default_investment"])
      expect(value.("#roi-care")).to eq(own["calc_care_default"] || calc["default_care"])
      expect(value.("#roi-lawn")).to eq(own["calc_lawn_default"] || calc["default_lawn_sqft"])
      expect(form.at_css("#roi-amount")["value"]).to eq(own["calc_basis_default"].to_fs(:delimited))
    end
  end

  it "tells search engines and AI assistants what the business is, where it works and what it answers" do
    json_ld = ->(body) { Nokogiri::HTML5(body).css('script[type="application/ld+json"]').map { JSON.parse(it.text) } }

    Setting.set("general", Setting.get("general").merge("city" => "Richland", "state" => "MI"))
    get "/"
    business = json_ld.(response.body).find { it["@type"] == "LocalBusiness" }
    expect(business["@id"]).to end_with("/#organization")
    expect(business["address"]).to include("addressLocality" => "Richland", "addressRegion" => "MI")
    expect(business["areaServed"].map { it["name"] }).to include("Kalamazoo", "Battle Creek")
    expect(business.dig("hasOfferCatalog", "itemListElement").map { it["name"] }).to eq(["Home gardens", "Commercial"])

    area = SNAPSHOT["entries"].find { it["collection"] == "service-areas" }
    get "/service-areas/#{area["slug"]}"
    data = json_ld.(response.body)
    expect(data.find { it["@type"] == "Service" }["areaServed"].map { it["name"] }).to eq(area.dig("frontmatter", "towns"))
    expect(data.find { it["@type"] == "FAQPage" }["mainEntity"].size).to eq(area.dig("frontmatter", "faqs").size)

    get "/commercial"
    expect(json_ld.(response.body).map { it["@type"] }).to include("FAQPage")
  end

  it "maps the service areas, each county linking to its area, and lists them in the footer" do
    get "/service-areas"
    page = Nokogiri::HTML5(response.body)
    areas = SNAPSHOT["entries"].select { it["collection"] == "service-areas" }

    areas.each do |area|
      area.dig("frontmatter", "counties").each { expect(page.at_css(%(.area-map a[href="/service-areas/#{area["slug"]}"] [data-county="#{it}"]))).to be_present }
    end
    expect(page.css(".footer__areas a").map { it["href"] }).to match_array(areas.map { "/service-areas/#{it["slug"]}" })
  end

  it "opens a menu for every nav item with columns, filled from its collections, with the phone to call" do
    Setting.set("general", Setting.get("general").merge("phone" => "2692541769"))
    get "/"
    page = Nokogiri::HTML5(response.body)
    nav = SNAPSHOT["globals"].find { it["slug"] == "nav" }["data"]["items"]
    menus = nav.select { it["groups"].present? }

    expect(page.css("[data-menu-button]").map { it.text.strip }).to eq(menus.map { it["label"] })
    commercial = page.css("[data-menu-panel]")[menus.index { it["label"] == "Commercial" }]
    industries = SNAPSHOT["entries"].select { it["collection"] == "industries" }
    expect(commercial.css(".mega__link").map { it["href"] }).to include(*industries.map { "/industries/#{it["slug"]}" })
    expect(page.at_css(".nav__phone")["href"]).to eq("tel:+12692541769")
    expect(page.at_css(".nav__phone").text).to include("(269) 254-1769")
    expect(page.css(".mobile-menu__group").size).to eq(menus.size)
  end

  it "draws an illustration on every service's and commercial service's page" do
    SNAPSHOT["entries"].select { it["collection"].in?(%w[services commercial]) }.each do |entry|
      get "/#{entry["collection"]}/#{entry["slug"]}"
      graphic = entry.dig("frontmatter", "graphic")
      next if graphic.blank? || graphic == "none"

      expect(Nokogiri::HTML5(response.body).at_css("figure.graphic, .area-map")).to be_present, "#{entry["slug"]} has no #{graphic}"
    end
  end

  it "gives the home garden calculator its assumptions, and the contact form a hidden place for its estimate" do
    get "/garden-value"
    page = Nokogiri::HTML5(response.body)
    config = JSON.parse(page.at_css("[data-garden-value]")["data-garden-value"])
    calc = SNAPSHOT["globals"].find { it["slug"] == "site_settings" }.dig("data", "home_calculator")

    expect(config).to include("met" => calc["met"].to_f, "homeCap" => calc["home_value_cap"].to_f, "activeShare" => calc["active_share"].to_f, "precip" => calc["precip_inches"].to_f)
    expect(config["produce"]).to eq([calc["produce_low"].to_f, calc["produce_high"].to_f])
    expect(page.css("[data-garden-tab]").map { it["data-garden-tab"] }).to eq(%w[money health mind earth])
    estimate = page.at_css("#contact form[data-contact-form] input[name=estimate]")
    expect(estimate["type"]).to eq("hidden")
  end

  it "describes every service and case study in structured data" do
    json_ld = ->(body) { Nokogiri::HTML5(body).css('script[type="application/ld+json"]').map { JSON.parse(it.text) }.flat_map { it["@graph"] || [it] } }
    service = SNAPSHOT["entries"].find { it["collection"] == "services" }
    get "/services/#{service["slug"]}"
    # Nodes with one @id are one thing (an SEO panel's Service merges with the theme's).
    node = json_ld.(response.body).select { it["@type"] == "Service" }.reduce({}) { |merged, part| merged.merge(part) { |_, a, b| a.presence || b } }
    expect(node["@id"]).to end_with("/services/#{service["slug"]}#service")
    expect(node["areaServed"].map { it["name"] }).to include("Grand Rapids", "Kalamazoo")

    study = SNAPSHOT["entries"].find { it["collection"] == "portfolio" && it.dig("frontmatter", "location").present? }
    get "/portfolio/#{study["slug"]}"
    node = json_ld.(response.body).find { it["@type"] == "CreativeWork" }
    expect(node.dig("contentLocation", "name")).to eq(study.dig("frontmatter", "location"))
    expect(node["name"]).to eq(study["title"])

    get "/commercial"
    expect(json_ld.(response.body).select { it["@type"] == "ItemList" }.map { it["name"] }).to include("Industries", "Commercial services", "Service areas")
  end

  it "shows Navigation › Logo in place of the business name, and the name without one" do
    get "/"
    expect(Nokogiri::HTML5(response.body).at_css("#nav .logo").text.strip).to eq(SNAPSHOT.dig("site", "name"))

    png = Base64.decode64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
    logo = Asset.create!(folder: "/branding", file: {io: StringIO.new(png), filename: "logo.png", content_type: "image/png"})
    nav = Global.find_by!(slug: "nav")
    nav.update!(data: nav.data.merge("logo" => logo.id.to_s))
    get "/"
    page = Nokogiri::HTML5(response.body)
    expect(page.css(".logo img.logo__image").map { it["alt"] }.uniq).to eq([SNAPSHOT.dig("site", "name")])
    expect(page.css(".logo img.logo__image").size).to eq(4) # the bar, the phone menu, the footer (small and wide)
  end

  it "opens every photo in a case study's gallery in the lightbox, and tells its story in numbered cards" do
    study = SNAPSHOT["entries"].find { it["collection"] == "portfolio" && it.dig("frontmatter", "gallery").present? }
    photos = study.dig("frontmatter", "gallery").sum { it["images"].size }
    get "/portfolio/#{study["slug"]}"
    page = Nokogiri::HTML5(response.body)

    expect(page.at_css(".gallery[data-controller=lightbox] dialog[data-lightbox-target=dialog]")).to be_present
    expect(page.css(".gallery__open[data-action='lightbox#open']").map { it["data-lightbox-index-param"].to_i }).to eq((0...photos).to_a)
    expect(page.css(".study-card__num").map(&:text)).to eq(%w[01 02 03 04].first(page.css(".study-card").size))
  end

  it "shows the testimonial picked for a page in the quote band, and Site settings' featured quote without one" do
    service = Collection.find_by!(slug: "services").entries.first
    featured = SNAPSHOT["globals"].find { it["slug"] == "site_settings" }.dig("data", "quote")
    get "/services/#{service.slug}"
    expect(Nokogiri::HTML5(response.body).at_css(".pull-quote blockquote").text).to include(featured["text"].strip.first(40))

    testimonial = SNAPSHOT["entries"].find { it["collection"] == "testimonials" }
    service.update!(frontmatter: service.frontmatter.merge("testimonial" => testimonial["slug"]))
    get "/services/#{service.slug}"
    band = Nokogiri::HTML5(response.body).at_css(".pull-quote")
    expect(band.at_css("blockquote").text).to include(testimonial.dig("frontmatter", "quote").first(40))
    expect(band.at_css("figcaption").text).to eq(testimonial["title"])
  end

  it "carries the ad click on a landing page's planner, and draws its illustration" do
    get "/business-seasonal-displays"
    page = Nokogiri::HTML5(response.body)
    tracking = page.at_css("form[data-planner] input[name=tracking]")

    expect(tracking["type"]).to eq("hidden")
    expect(tracking).to have_attribute("data-tracking")
    expect(page.at_css(".illustration figure.graphic")).to be_present
    expect(page.at_css('meta[name="robots"]')["content"]).to start_with("noindex")
  end

  it "loads its own scripts and stylesheet, none of the admin's" do
    get "/"

    importmap = JSON.parse(Nokogiri::HTML5(response.body).at_css("script[type=importmap]").text)["imports"]
    expect(importmap.keys).to all(start_with("healing"))
    expect(response.body).to include("/assets/healing/site-")
    expect(response.body).not_to include("litewind", "/assets/application-")
  end
end
