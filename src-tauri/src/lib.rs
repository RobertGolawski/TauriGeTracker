// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use chrono::{DateTime, Utc};
use reqwest;
use serde::{Deserialize, Serialize};
use std::fmt::write;
use std::fs;
use std::intrinsics::needs_drop;
use std::path::PathBuf;
use std::{collections::HashMap, sync::Mutex};
use tauri::http::response;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ItemData {
    pub examine: String,
    pub members: bool,
    pub name: String,
    pub id: u32,
    pub lowalch: Option<u32>,
    pub highalch: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ItemPriceData {
    pub high: f64,
    pub low: f64,
    #[serde(rename = "highTime")] // Match JSON key if different from field name
    pub high_time: DateTime<Utc>,
    #[serde(rename = "lowTime")] // Match JSON key if different from field name
    pub low_time: DateTime<Utc>,
}

pub struct AppState {
    tracked_ids: Mutex<Vec<u32>>,

    all_items_cache: Mutex<HashMap<u32, ItemData>>,

    live_item_data: Mutex<HashMap<u32, ItemPriceData>>,
}

impl AppState {
    fn new() -> Self {
        AppState {
            tracked_ids: Mutex::new(Vec::new()),
            all_items_cache: Mutex::new(HashMap::new()),
            live_item_data: Mutex::new(HashMap::new()),
        }
    }
}

const ITEMS_CACHE_FILENAME: &str = "items_cache.json";
const TRACKED_IDS_FILENAME: &str = "tracked_ids.json";

#[tauri::command]
async fn load_initial_data(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ItemData>, String> {
    println!("Rust: Attempting to read files...");

    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get application data directory: {}", e))?;
    // .ok_or_else(|| "Failed to get application data directory".to_string())?;

    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data directory: {}", e))?;

    let items_path = data_dir.join(ITEMS_CACHE_FILENAME);

    let mut items_map: HashMap<u32, ItemData> = HashMap::new();

    let mut items_vec: Vec<ItemData>;
    let mut needs_fetch = false;

    match std::fs::read_to_string(&items_path) {
        Ok(content) => {
            match serde_json::from_str::<Vec<ItemData>>(&content) {
                // Ok(items_vec) => {
                //     println!("Rust: Deserialized {} items from file.", items_vec.len());
                //     items_map = items_vec.into_iter().map(|item| (item.id, item)).collect();
                //     *state.all_items_cache.lock().unwrap() = items_map.clone();
                //     println!("Rust: Successfully loaded items cache into HashMap.");
                // }
                Ok(parsed_items) => {
                    items_vec = parsed_items;
                    println!("Rust: Successfully parsed items");
                }
                Err(e) => {
                    eprintln!(
                        "Warning: Failed to parse items cache file, will refetch: {}",
                        e
                    );

                    items_vec = Vec::new();
                    needs_fetch = true;
                }
            }
        }
        Err(e) => {
            if e.kind() != std::io::ErrorKind::NotFound {
                needs_fetch = true;
                items_vec = Vec::new();
            } else {
                return Err(format!("Failed to read items cache: {}", e));
            }
        }
    }
    if needs_fetch {
        let user_agent = format!(
            "{}/{} ({})",
            "OsrsGeTracker",                            // Your app name
            env!("CARGO_PKG_VERSION"),                  // Get version from Cargo.toml
            "github.com/RobertGolawski/TauriGeTracker"  // Optional: contact/repo URL
        );
        println!("Rust: Using User-Agent: {}", user_agent);

        let client = reqwest::Client::builder()
            .user_agent(user_agent) // Set the User-Agent for the client
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;
        println!("Rust: File not found. Fetching data and writing file.");
        let api_url = "https://prices.runescape.wiki/api/v1/osrs/mapping";

        let response = client
            .get(api_url)
            .send()
            .await
            .map_err(|e| format!("Failed to send request to API: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "API request failed with status: {}",
                response.status()
            ));
        }

        let body_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read body as text {}", e))?;

        println!("---- API RESP BODY----");
        // println!("{}", body_text);
        let max_len = 1000;
        println!("{}", body_text.chars().take(max_len).collect::<String>());
        if body_text.len() > max_len {
            println!("... (truncated)");
        }
        println!("---- API END BODY ----");

        let fetched_items_vec = serde_json::from_str::<Vec<ItemData>>(&body_text)
            .map_err(|e| format!("Failed to parse text to json: {}", e))?;
        // let items_vec = response
        //     .json::<Vec<ItemData>>()
        //     .await
        //     .map_err(|e| format!("Failed to parse JSON response from API: {}", e))?;
        //
        println!("Rust: Successfully fetched and parsed items from API.");

        let json_string = serde_json::to_string_pretty(&fetched_items_vec)
            .map_err(|e| format!("Failed to serialize fetched items: {}", e))?;

        fs::write(&items_path, json_string)
            .map_err(|e| format!("Failed to write items cache file: {}", e))?;

        items_vec = fetched_items_vec;
    }

    let items_map: HashMap<u32, ItemData> =
        items_vec.into_iter().map(|item| (item.id, item)).collect();
    *state.all_items_cache.lock().unwrap() = items_map.clone();
    println!(
        "Rust: Updated AppState with {} items.",
        state.all_items_cache.lock().unwrap().len()
    );

    let tracked_ids_path = data_dir.join(TRACKED_IDS_FILENAME);
    println!("Rust: Looking for tracked IDs at: {:?}", tracked_ids_path);
    let mut tracked_ids: Vec<u32> = Vec::new();

    match fs::read_to_string(&tracked_ids_path) {
        Ok(content) => match serde_json::from_str::<Vec<u32>>(&content) {
            Ok(ids) => {
                println!("Rust: Successfully loaded {} tracked IDs.", ids.len());
                tracked_ids = ids.clone();
                *state.tracked_ids.lock().unwrap() = ids;
            }
            Err(e) => {
                return Err(format!("Failed to load tracked ids {}", e));
            }
        },
        Err(e) => {
            if e.kind() != std::io::ErrorKind::NotFound {
                *state.tracked_ids.lock().unwrap() = Vec::new();
            }
        }
    }

    let mut initial_tracked_data: Vec<ItemData> = Vec::new();

    for id in &tracked_ids {
        if let Some(item_data) = items_map.get(id) {
            initial_tracked_data.push(item_data.clone());
        } else {
            eprint!("Warning: Tracked item ID {} not found in items cache!", id);
        }
    }
    println!(
        "Rust: Initial data loading complete. Returning {} tracked items.",
        initial_tracked_data.len()
    );
    Ok(initial_tracked_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_initial_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
