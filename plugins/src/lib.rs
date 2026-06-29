use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::BackgroundTask;
#[cfg(mobile)]
use mobile::BackgroundTask;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the background-task APIs.
pub trait BackgroundTaskExt<R: Runtime> {
  fn background_task(&self) -> &BackgroundTask<R>;
}

impl<R: Runtime, T: Manager<R>> crate::BackgroundTaskExt<R> for T {
  fn background_task(&self) -> &BackgroundTask<R> {
    self.state::<BackgroundTask<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("background-task")
    .invoke_handler(tauri::generate_handler![
      commands::begin_task,
      commands::end_task
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let background_task = mobile::init(app, api)?;
      #[cfg(desktop)]
      let background_task = desktop::init(app, api)?;
      app.manage(background_task);
      Ok(())
    })
    .build()
}
