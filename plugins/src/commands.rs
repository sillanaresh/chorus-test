use tauri::{command, AppHandle, Runtime};

use crate::BackgroundTaskExt;
use crate::Result;

#[command]
pub(crate) async fn begin_task<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.background_task().begin_task()
}

#[command]
pub(crate) async fn end_task<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.background_task().end_task()
}
