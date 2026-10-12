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

  def healing_industries = website_entries(:industries)

  def healing_commercial_services = website_entries(:commercial)

  def healing_service_areas = website_entries(:"service-areas")

  # Each county on the service area map, to the page of the area it's in.
  def healing_area_links
    healing_service_areas.each_with_object({}) do |area, links|
      website_fields(area).counties.each { links[it] ||= website_path(area) }
    end
  end

  # Where the business is based (Settings › General), e.g. "Richland, MI": the map's pin.
  def healing_base = website_settings.values_at("city", "state").compact_blank.join(", ").presence

  # The business's phone (Settings › General), as shown and as a tel: link; nil without one.
  def healing_phone
    digits = website_settings["phone"].to_s.gsub(/\D/, "").delete_prefix("1")
    {text: "(#{digits[0, 3]}) #{digits[3, 3]}-#{digits[6, 4]}", href: "tel:+1#{digits}"} if digits.size == 10
  end

  # A nav menu column's links ({label, href, description, icon}): a
  # collection's published entries when it has a Source, else its own links.
  # Services and commercial services keep their summaries; the longer lists
  # (industries, areas, case studies) are names alone.
  def healing_menu_links(group)
    source = group.source.to_s
    return group.links.map { {label: it.label, href: website_href(it.link) || "/", description: it.description.presence} } if source.in?(["", "none"])

    website_entries(source.to_sym).map do |entry|
      fields = website_fields(entry).to_h
      {label: entry.title, href: website_path(entry), icon: fields["icon"].presence,
       description: (fields["summary"].to_s.truncate(70, separator: " ") if source.in?(%w[services commercial]))}
    end
  end

  # Every town the service areas name, for the business's areaServed.
  def healing_towns = healing_service_areas.flat_map { website_fields(it).towns }.uniq

  # A percentage typed into a string field ("1.5", "2%"), as a number.
  def healing_percent(value) = value.to_s.delete("%").strip.to_f

  # Questions and answers ({question, answer} rows) as schema.org's FAQPage,
  # for search engines and AI assistants; nil when there are none.
  def healing_faq_json_ld(items)
    items = Array(items).select { it.question.present? && it.answer.present? }
    return if items.empty?

    website_json_ld({"@context" => "https://schema.org", "@type" => "FAQPage", "mainEntity" => items.map do |item|
      {"@type" => "Question", "name" => item.question, "acceptedAnswer" => {"@type" => "Answer", "text" => website_plain_text(item.answer)}}
    end})
  end

  # A service the business offers, as schema.org's Service (#service on its
  # page, so a Service written in the SEO panel merges with it), provided by
  # the organization the CMS describes (WebsiteHelper's #organization) where
  # the service areas reach (or `towns`).
  def healing_service_json_ld(name:, description:, type: nil, audience: nil, image: nil, towns: healing_towns)
    home = website_url("/")
    url = website_url(request.path)
    image = website_image(image)
    website_json_ld({"@context" => "https://schema.org", "@type" => "Service", "@id" => "#{url}#service", "name" => name, "description" => description,
      "serviceType" => type || name, "url" => url, "provider" => {"@id" => "#{home}#organization"}, "image" => (website_url(image[:src]) if image),
      "audience" => ({"@type" => "BusinessAudience", "name" => audience} if audience),
      "areaServed" => towns.map { {"@type" => "City", "name" => it} }.presence, "mainEntityOfPage" => {"@id" => "#{url}#main"}}.compact)
  end

  # Records a section lists (industries, services, areas), as schema.org's
  # ItemList, in their order, each linking to its page.
  def healing_item_list_json_ld(name, entries)
    return if entries.empty?

    website_json_ld({"@context" => "https://schema.org", "@type" => "ItemList", "name" => name, "itemListElement" =>
      entries.each_with_index.map { |entry, index| {"@type" => "ListItem", "position" => index + 1, "name" => entry.title, "url" => website_url(website_path(entry))} }})
  end

  # The two planners (shared/planner_form): a CMS form drawn in steps, each
  # service choice explained by an entry of `services` (by its
  # "planner_choice"), and `icon_field`'s choices as cards with icons (by a
  # word in the choice). Steps name the form's fields; one they don't name
  # joins the last step.
  PLANNERS = {
    commercial: {form: "commercial", id: "planner", services: :commercial, source: "commercial planner", icon_field: "property_type",
      icons: {"retail" => "building-store", "office" => "building", "apartment" => "buildings", "hotel" => "bed", "healthcare" => "heart-handshake",
              "school" => "school", "municipal" => "building-community"},
      steps: [
        ["Your property", "Tell me what kind of place it is and where.", %w[property_type company location]],
        ["What you'd like", "Pick everything that interests you. Each one shows what's included.", %w[interest_design_install interest_seasonal_displays interest_native_rain_gardens interest_garden_care priority]],
        ["Scope & timing", "Rough answers are fine; they help me come prepared.", %w[scope timeline budget]],
        ["How to reach you", "I reply within 1–2 business days.", %w[name role email phone message]]
      ]},
    garden: {form: "garden", id: "garden-planner", services: :services, source: "garden planner", icon_field: "sun",
      icons: {"mostly sun" => "sun", "part" => "plant-2", "shade" => "trees", "not sure" => "leaf"},
      steps: [
        ["Your yard", "Where it is and what it's like now.", %w[location sun soil current]],
        ["What you'd like", "Pick everything that interests you. Each one shows what's included.", %w[interest_consultation interest_planting_plan interest_design interest_installation interest_shopping interest_displays interest_herbs priority]],
        ["Size & timing", "Rough answers are fine; they help me come prepared.", %w[size timeline budget]],
        ["How to reach you", "I reply within 1–2 business days.", %w[name email phone message]]
      ]}
  }.freeze

  # A planner and its published form, or nil when the CMS has no such form.
  def healing_planner(kind)
    @healing_planners ||= {}
    return @healing_planners[kind] if @healing_planners.key?(kind)

    config = PLANNERS.fetch(kind)
    form = Form.find_by(slug: config[:form], status: "published")
    @healing_planners[kind] = (config.merge(form:) if form)
  end

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
  def healing_form_control(field, id:, compact: false, selected: nil)
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
