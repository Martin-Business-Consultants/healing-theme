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

  it "posts the contact form to the Forms plugin, with every field it draws" do
    get "/contact"
    form = Nokogiri::HTML5(response.body).at_css("form[data-contact-form]")
    names = form.css("input, select, textarea").map { it["name"] }.compact - [Form::HONEYPOT_FIELD]

    expect(names - Form.find_by!(slug: "contact").fields.map { it["name"] }).to be_empty

    services = form.css("select[name=service] option").map(&:text)
    expect(services).to eq(SNAPSHOT["entries"].select { it["collection"] == "services" }.sort_by { it.dig("frontmatter", "order") }.map { it["title"] } + ["Not sure yet"])

    post form["action"], params: {name: "Ann", email: "ann@example.com", message: "A shady yard", service: services.first, source: "contact"}, as: :json
    expect(response).to have_http_status(:created)
    expect(FormSubmission.last.data).to include("name" => "Ann", "service" => services.first, "source" => "contact")

    post form["action"], params: {name: "Ann", email: "ann@example.com", message: "A shady yard", service: "Hardscaping"}, as: :json
    expect(response).to have_http_status(:unprocessable_content)
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

  it "loads its own scripts and stylesheet, none of the admin's" do
    get "/"

    importmap = JSON.parse(Nokogiri::HTML5(response.body).at_css("script[type=importmap]").text)["imports"]
    expect(importmap.keys).to all(start_with("healing"))
    expect(response.body).to include("/assets/healing/site-")
    expect(response.body).not_to include("litewind", "/assets/application-")
  end
end
