// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use chrono::{DateTime, TimeZone, Utc};
use reqwest;
use serde::{Deserialize, Serialize};
use std::fs;
// use std::path::PathBuf;
use std::collections::HashMap;
use std::time::Duration;
// use tauri::http::response;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tokio::time::interval;

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
    pub high: Option<f64>,
    pub low: Option<f64>,
    #[serde(rename = "highTime", with = "chrono::serde::ts_seconds_option")]
    pub high_time: Option<DateTime<Utc>>,
    #[serde(rename = "lowTime", with = "chrono::serde::ts_seconds_option")]
    pub low_time: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
struct PriceApiResponse {
    pub data: HashMap<u32, ItemPriceData>,
}

#[derive(Clone, Serialize)]
struct PriceUpdatePayload {
    pub prices: HashMap<u32, ItemPriceData>,
}

pub struct AppState {
    tracked_ids: Mutex<Vec<u32>>,

    all_items_cache: Mutex<HashMap<u32, ItemData>>,

    last_fetch: Mutex<DateTime<Utc>>,

    http_client: reqwest::Client,
}

impl AppState {
    fn new() -> Self {
        let user_agent = format!(
            "{}/{} (Discord: {}, GitHub Repo: {}, Comment: {})",
            "OsrsGeTracker",
            env!("CARGO_PKG_VERSION"),
            "g_dev_",
            "github.com/RobertGolawski/TauriGeTracker",
            "This is project I'm using for learning, so please feel free to contact me in case I do stuff wrong",
        );
        println!("Rust: Using User-Agent: {}", user_agent);

        let client = reqwest::Client::builder()
            .user_agent(user_agent) // Set the User-Agent for the client
            .build()
            .expect("Failed to build reqwest client");

        AppState {
            tracked_ids: Mutex::new(Vec::new()),
            all_items_cache: Mutex::new(HashMap::new()),
            last_fetch: Mutex::new(Utc::now()),
            http_client: client,
        }
    }
}

const ITEMS_CACHE_FILENAME: &str = "items_cache.json";
const TRACKED_IDS_FILENAME: &str = "tracked_ids.json";
const MAPPINGS_API_URL: &str = "https://prices.runescape.wiki/api/v1/osrs/mapping";
const FETCH_ITEM_API_URL: &str = "https://prices.runescape.wiki/api/v1/osrs/latest";
const REFRESH_INTERVAL_SECONDS: u64 = 60;

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

    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data directory: {}", e))?;

    let items_path = data_dir.join(ITEMS_CACHE_FILENAME);

    let items_map: HashMap<u32, ItemData>;

    let mut items_vec: Vec<ItemData>;
    let mut needs_fetch = false;

    match std::fs::read_to_string(&items_path) {
        Ok(content) => match serde_json::from_str::<Vec<ItemData>>(&content) {
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
        },
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                needs_fetch = true;
                items_vec = Vec::new();
            } else {
                return Err(format!("Failed to read items cache: {}", e));
            }
        }
    }
    if needs_fetch {
        println!("Rust: File not found. Fetching data and writing file.");
        let api_url = MAPPINGS_API_URL;

        let response = state
            .http_client
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

        // println!("---- API RESP BODY----");
        // let max_len = 1000;
        // println!("{}", body_text.chars().take(max_len).collect::<String>());
        // if body_text.len() > max_len {
        //     println!("... (truncated)");
        // }
        // println!("---- API END BODY ----");

        let fetched_items_vec = serde_json::from_str::<Vec<ItemData>>(&body_text)
            .map_err(|e| format!("Failed to parse text to json: {}", e))?;
        println!("Rust: Successfully fetched and parsed items from API.");

        let json_string = serde_json::to_string_pretty(&fetched_items_vec)
            .map_err(|e| format!("Failed to serialize fetched items: {}", e))?;

        fs::write(&items_path, json_string)
            .map_err(|e| format!("Failed to write items cache file: {}", e))?;

        items_vec = fetched_items_vec;
    }

    items_map = items_vec.into_iter().map(|item| (item.id, item)).collect();
    *state.all_items_cache.lock().await = items_map.clone();
    println!(
        "Rust: Updated AppState with {} items.",
        state.all_items_cache.lock().await.len()
    );

    let tracked_ids_path = data_dir.join(TRACKED_IDS_FILENAME);
    println!("Rust: Looking for tracked IDs at: {:?}", tracked_ids_path);
    let mut tracked_ids: Vec<u32> = Vec::new();

    match fs::read_to_string(&tracked_ids_path) {
        Ok(content) => match serde_json::from_str::<Vec<u32>>(&content) {
            Ok(ids) => {
                println!("Rust: Successfully loaded {} tracked IDs.", ids.len());
                tracked_ids = ids.clone();
                *state.tracked_ids.lock().await = ids;
            }
            Err(e) => {
                return Err(format!("Failed to load tracked ids {}", e));
            }
        },
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                *state.tracked_ids.lock().await = Vec::new();
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

async fn fetch_tracked_prices(
    ids_to_fetch: &[u32],
    client: &reqwest::Client,
) -> Result<HashMap<u32, ItemPriceData>, String> {
    if ids_to_fetch.is_empty() {
        return Ok(HashMap::new());
    }

    let mut fetched_prices: HashMap<u32, ItemPriceData> = HashMap::new();

    let response = client.get(FETCH_ITEM_API_URL).send().await.map_err(|e| {
        format!(
            "Failed to send request to {}, got {}",
            FETCH_ITEM_API_URL, e
        )
    })?;

    if !response.status().is_success() {
        return Err(format!(
            "API request failed with status: {}",
            response.status()
        ));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read the latest fetch map {}", e))?;

    let full_price_data = serde_json::from_str::<PriceApiResponse>(&body_text)
        .map_err(|e| format!("Failed to parse price data from JSON {}", e))?;

    for item_id in ids_to_fetch {
        if let Some(price_data_ref) = full_price_data.data.get(item_id) {
            fetched_prices.insert(*item_id, price_data_ref.clone());
        } else {
            eprintln!(
                "Warning: Price data for tracked item ID {} not found",
                item_id
            );
        }
    }

    Ok(fetched_prices)
}

#[tauri::command]
async fn manual_price_refresh(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    println!("Manual price fetch triggered");

    let ids_to_fetch = {
        let tracked_ids_guard = state.tracked_ids.lock().await;
        if tracked_ids_guard.is_empty() {
            println!("Rust: No tracked items for manual refresh");
            return Ok(());
        }
        tracked_ids_guard.clone()
    };

    let client = &state.http_client;

    match fetch_tracked_prices(&ids_to_fetch, client).await {
        Ok(prices) => {
            if let Err(e) = app_handle.emit("prices-updated", PriceUpdatePayload { prices }) {
                eprint!("Error emitting price update: {}", e);
            }
            *state.last_fetch.lock().await = Utc::now();

            Ok(())
        }
        Err(e) => {
            eprintln!("Rust: Manual Trigger Price Fetch failed: {}", e);
            Err(e)
        }
    }
}

async fn timed_price_refresh(app_handle: tauri::AppHandle) {
    let state = match app_handle.try_state::<AppState>() {
        Some(state) => state,
        None => {
            eprintln!("Error: AppState not managed. Cannot perform timed refresh.");
            return;
        }
    };
    let should_fetch = {
        let last_fetch_guard = state.last_fetch.lock().await;
        Utc::now() >= (*last_fetch_guard + Duration::from_secs(REFRESH_INTERVAL_SECONDS))
    };
    if should_fetch {
        println!("Rust: Auto-refreshing tracked prices");

        let ids_to_fetch = {
            let tracked_ids_guard = state.tracked_ids.lock().await;
            if tracked_ids_guard.is_empty() {
                println!("Rust: No ids to refresh in auto-refresh");
                return;
            }
            tracked_ids_guard.clone()
        };

        let client = &state.http_client;

        match fetch_tracked_prices(&ids_to_fetch, client).await {
            Ok(prices) => {
                if let Err(e) = app_handle.emit("prices-updated", PriceUpdatePayload { prices }) {
                    eprintln!("Error emitting price update from auto-refresh: {}", e);
                }
                *state.last_fetch.lock().await = Utc::now();
            }
            Err(e) => {
                eprintln!("Rust: Auto-refresh fetch failed {}", e);
            }
        }
    }
}

#[tauri::command]
async fn add_tracked_item(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: u32,
) -> Result<(), String> {
    let mut tracked_item_guard = state.tracked_ids.lock().await;
    if !tracked_item_guard.contains(&id) {
        tracked_item_guard.push(id);
        println!("Rust: Added item with ID {}", id);

        let ids_to_save = tracked_item_guard.clone();

        drop(tracked_item_guard);

        let data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?;

        let tracked_ids_path = data_dir.join(TRACKED_IDS_FILENAME);

        let json_string = serde_json::to_string_pretty(&ids_to_save)
            .map_err(|e| format!("Failed to serialize tracked IDs: {}", e))?;

        fs::write(&tracked_ids_path, json_string)
            .map_err(|e| format!("Failed to write tracked IDs to file {}", e))?;
    } else {
        println!("Rust: Item with ID {} already in list", id);
        drop(tracked_item_guard);
    }
    Ok(())
}

#[tauri::command]
async fn del_tracked_item(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id_to_del: u32,
) -> Result<(), String> {
    let mut tracked_item_guard = state.tracked_ids.lock().await;
    if let Some(index) = tracked_item_guard.iter().position(|&id| id == id_to_del) {
        tracked_item_guard.remove(index);
        println!("Rust: Removed item with ID {}", id_to_del);

        let ids_to_save = tracked_item_guard.clone();

        drop(tracked_item_guard);

        let data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?;

        let tracked_ids_path = data_dir.join(TRACKED_IDS_FILENAME);

        let json_string = serde_json::to_string_pretty(&ids_to_save)
            .map_err(|e| format!("Failed to serialize tracked IDs: {}", e))?;

        fs::write(&tracked_ids_path, json_string)
            .map_err(|e| format!("Failed to write tracked IDs to file {}", e))?;
    } else {
        println!("Rust: Item with ID {} was never in the list", id_to_del);
        drop(tracked_item_guard);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            println!("Rust: setting up hook...");
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = interval(Duration::from_secs(REFRESH_INTERVAL_SECONDS));

                println!("Rust: Background timer started.");

                loop {
                    interval.tick().await;
                    timed_price_refresh(app_handle.clone()).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_initial_data,
            manual_price_refresh
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
