# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name = "healing"
  spec.version = "0.6.3"
  spec.summary = "The Healing Earth Design website, as a CMS theme"
  spec.authors = ["Martin Business Consultants"]
  spec.files = Dir["{app,config,lib}/**/*"]
  spec.required_ruby_version = ">= 3.3"
  spec.add_dependency "rails", ">= 8.1"
end
