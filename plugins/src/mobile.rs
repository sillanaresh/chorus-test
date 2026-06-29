use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_background_task);

pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<BackgroundTask<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("", "BackgroundTaskPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_background_task)?;
  Ok(BackgroundTask(handle))
}

/// Access to the background-task APIs.
pub struct BackgroundTask<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> BackgroundTask<R> {
  pub fn begin_task(&self) -> crate::Result<()> {
    self.0.run_mobile_plugin::<serde_json::Value>("beginTask", ()).map(|_| ()).map_err(Into::into)
  }

  pub fn end_task(&self) -> crate::Result<()> {
    self.0.run_mobile_plugin::<serde_json::Value>("endTask", ()).map(|_| ()).map_err(Into::into)
  }
}
