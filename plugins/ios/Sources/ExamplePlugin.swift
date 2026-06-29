import SwiftRs
import Tauri
import UIKit
import WebKit

class BackgroundTaskPlugin: Plugin {
  private var taskId: UIBackgroundTaskIdentifier = .invalid

  private func endIfNeeded() {
    if self.taskId != .invalid {
      UIApplication.shared.endBackgroundTask(self.taskId)
      self.taskId = .invalid
    }
  }

  // Ask iOS for a background execution window so an in-flight streaming
  // request keeps running if the user backgrounds the app mid-generation.
  @objc public func beginTask(_ invoke: Invoke) {
    DispatchQueue.main.async {
      self.endIfNeeded()
      self.taskId = UIApplication.shared.beginBackgroundTask(withName: "chorus-stream") {
        // Expiration handler: iOS reclaimed the time; release the assertion.
        self.endIfNeeded()
      }
    }
    invoke.resolve()
  }

  @objc public func endTask(_ invoke: Invoke) {
    DispatchQueue.main.async {
      self.endIfNeeded()
    }
    invoke.resolve()
  }
}

@_cdecl("init_plugin_background_task")
func initPlugin() -> Plugin {
  return BackgroundTaskPlugin()
}
