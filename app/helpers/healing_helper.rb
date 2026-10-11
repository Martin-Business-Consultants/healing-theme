# frozen_string_literal: true

# The theme's own vocabulary on top of WebsiteHelper: its icons, its
# buttons, and the collections and globals the site is built around.
module HealingHelper
  ICONS = Healing::Engine.root.join("app/assets/images/healing/icons")

  # Site settings (the "site_settings" global): the words around the content.
  def healing_settings = website_global(:site_settings)

  def healing_services = website_entries(:services)

  def healing_case_studies = website_entries(:portfolio)

  def healing_testimonials = website_entries(:testimonials)

  # Cloudflare Turnstile ({site_key:, theme:}; theme is auto, light or dark)
  # when Settings › Forms has it set up (the Forms plugin then refuses a
  # submission without its token), else nil.
  def healing_turnstile
    captcha = Forms.public_captcha if defined?(Forms) && Forms.respond_to?(:public_captcha)
    {site_key: captcha[:site_key], theme: captcha[:theme] || "auto"} if captcha && captcha[:provider] == "turnstile"
  end

  # The "contact" form (the Forms plugin), drawn by contact_form.
  def healing_contact_form
    @healing_contact_form ||= Form.find_by!(slug: "contact", status: "published")
  end

  # An icon (app/assets/images/healing/icons), inline so it takes the
  # text's color and costs no request. Decorative unless given a `label`.
  def healing_icon(name, label: nil, **options)
    svg = (HEALING_ICON_CACHE[name.to_s] ||= ICONS.join("#{name}.svg").read
      .sub(/<svg\b[^>]*>/) { it.gsub(/\s(?:width|height|class)="[^"]*"/, "") }
      .gsub(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/, ""))
    attributes = {class: ["icon", options.delete(:class)].compact.join(" "), focusable: "false"}
    attributes.merge!(label ? {role: "img", "aria-label": label} : {"aria-hidden": "true"})
    svg.sub("<svg", "<svg #{tag.attributes(attributes)}").html_safe # rubocop:disable Rails/OutputSafety -- the theme's own files
  end
  HEALING_ICON_CACHE = {} # rubocop:disable Style/MutableConstant

  # A contact form field's input, drawn by its type as the form defines it.
  # A select's choices are the form's (the Forms plugin works out those taken
  # from a collection, the services say); `selected` picks the one for an
  # entry (a service page preselects its service). A name ending in "date"
  # is a date picker.
  def healing_form_control(field, id:, compact:, selected: nil)
    name = field["name"]
    attributes = {class: "field__input", id:, name:, required: field["required"].present?}
    case field["type"]
    when "select"
      options = FormChoices.for(field).map { tag.option(it["label"], value: it["value"], data: {slug: it["slug"]}, selected: selected.present? && it["slug"] == selected) }
      tag.select(safe_join(options), **attributes)
    when "textarea"
      tag.textarea("", rows: compact ? 3 : 5, placeholder: field["placeholder"], **attributes)
    else
      autocomplete = {"email" => "email", "name" => "name", "phone" => "tel"}[field["type"] == "email" ? "email" : name]
      tag.input(type: name.end_with?("date") ? "date" : field["type"], placeholder: field["placeholder"], autocomplete:, **attributes)
    end
  end

  # A button: a link with `href:`, else a <button>. Variants: primary,
  # secondary (light, over photos), outline, ghost.
  def healing_button(label = nil, href: nil, variant: :primary, arrow: false, type: :button, **options, &block)
    label = capture(&block) if block
    options[:class] = ["button", "button--#{variant}", options[:class]].compact.join(" ")
    content = safe_join([tag.span(label), (healing_icon("arrow-long-right", class: "button__arrow") if arrow)].compact)
    href ? link_to(content, href, **options) : button_tag(content, type:, **options)
  end

  # Over a photo, a light underlined link beside a button.
  def healing_photo_link(label, href) = link_to(label, href, class: "photo-link")

  # Whether an href is the page being shown ("/about#team" is /about).
  def healing_current?(href)
    path = href.to_s.split(/[?#]/).first.to_s
    !path.empty? && (path.chomp("/").presence || "/") == (request.path.chomp("/").presence || "/")
  end

  # The year in the footer's copyright line.
  def healing_copyright(text) = text.to_s.gsub("{year}", Date.current.year.to_s)
end
