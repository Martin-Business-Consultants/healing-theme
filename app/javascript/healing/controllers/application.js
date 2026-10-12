// Stimulus, for the parts of the site that are components with state of
// their own: each controller is registered here by its data-controller name.
import { Application } from "healing/vendor/stimulus"
import LightboxController from "healing/controllers/lightbox_controller"

const application = Application.start()
application.register("lightbox", LightboxController)
