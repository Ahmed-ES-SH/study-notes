mod db;

use std::sync::Mutex;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let conn = db::init()?;
            app.manage(Mutex::new(conn));
            log::info!("Database initialized successfully");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::commands::list_main_sections,
            db::commands::create_main_section,
            db::commands::update_main_section,
            db::commands::delete_main_section,
            db::commands::get_main_section_cascade_info,
            db::commands::list_subsections,
            db::commands::create_subsection,
            db::commands::update_subsection,
            db::commands::delete_subsection,
            db::commands::get_subsection_cascade_info,
            db::commands::list_notes,
            db::commands::create_note,
            db::commands::update_note,
            db::commands::delete_note,
            db::commands::get_note_cascade_info,
            db::commands::list_assets,
            db::commands::attach_note_asset,
            db::commands::delete_asset,
            db::commands::read_asset_data_url,
            db::commands::get_note,
            db::commands::get_note_context,
            db::commands::check_db_integrity,
            db::commands::search_notes,
            db::commands::reorder_entities,
            db::commands::get_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
