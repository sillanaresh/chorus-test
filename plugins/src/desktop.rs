use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<BackgroundTask<R>> {
  Ok(BackgroundTask(app.clone()))
}

/// Access to the background-task APIs (no-op on desktop).
pub struct BackgroundTask<R: Runtime>(AppHandle<R>);

impl<R: Runtime> BackgroundTask<R> {
  pub fn begin_task(&self) -> crate::Result<()> {
    Ok(())
  }

  pub fn end_task(&self) -> crate::Result<()> {
    Ok(())
  }
}
