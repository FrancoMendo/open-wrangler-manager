use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use toml::Value;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkerInfo {
    pub name: String,
    pub path: String,
    /// Path relative to the scanned base directory, for folder-tree grouping
    pub relative_path: String,
    pub environments: Vec<String>,
}

/// Check if a filename matches the wrangler config naming convention.
/// Matches: wrangler.toml, wrangler-api0.toml, wrangler-cupos.toml,
///          wrangler.jsonc, wrangler-login.jsonc, etc.
fn is_wrangler_config(file_name: &str) -> bool {
    let lower = file_name.to_lowercase();
    // Must start with "wrangler" and end with .toml or .jsonc
    if !lower.starts_with("wrangler") {
        return false;
    }
    if lower.ends_with(".toml") || lower.ends_with(".jsonc") {
        // After "wrangler", the next char must be '.', '-', or end of stem
        let after_wrangler = &lower["wrangler".len()..];
        return after_wrangler.starts_with('.')
            || after_wrangler.starts_with('-')
            || after_wrangler.is_empty();
    }
    false
}

/// Extract environment names from a parsed TOML Value.
/// Environments are defined as `[env.NAME]` or `[[env.NAME.xxx]]` sections.
fn extract_envs_from_toml(value: &Value) -> Vec<String> {
    let mut envs = HashSet::new();

    if let Some(env_table) = value.get("env").and_then(|e| e.as_table()) {
        for env_name in env_table.keys() {
            envs.insert(env_name.clone());
        }
    }

    let mut sorted: Vec<String> = envs.into_iter().collect();
    sorted.sort();
    sorted
}

/// Extract environment names from a parsed JSON Value.
fn extract_envs_from_json(value: &serde_json::Value) -> Vec<String> {
    let mut envs = HashSet::new();

    if let Some(env_obj) = value.get("env").and_then(|e| e.as_object()) {
        for env_name in env_obj.keys() {
            envs.insert(env_name.clone());
        }
    }

    let mut sorted: Vec<String> = envs.into_iter().collect();
    sorted.sort();
    sorted
}

#[tauri::command]
fn scan_workers(base_path: String) -> Result<Vec<WorkerInfo>, String> {
    let mut workers = Vec::new();
    let base = Path::new(&base_path);

    for entry in WalkDir::new(&base_path).into_iter().filter_map(|e| {
        match e {
            Ok(ent) => {
                let name = ent.file_name().to_string_lossy();
                // Skip common heavy/irrelevant directories
                if ent.file_type().is_dir()
                    && (name == "node_modules" || name == ".git" || name == "target")
                {
                    return None;
                }
                Some(ent)
            }
            Err(e) => {
                println!("Error walking directory: {}", e);
                None
            }
        }
    }) {
        let path = entry.path();
        println!("Checking path: {:?}", path);

        if !path.is_file() {
            continue;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name,
            None => continue,
        };

        if !is_wrangler_config(file_name) {
            continue;
        }

        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) => {
                println!("Error reading file {:?}: {}", path, e);
                continue;
            }
        };

        let clean_content = content.trim();

        let extension = file_name.rsplit('.').next().unwrap_or("").to_lowercase();

        let (name, environments) = if extension == "toml" {
            let value: toml::Value = match toml::from_str(clean_content) {
                Ok(v) => v,
                Err(e) => {
                    // Imprime el error exacto y la línea
                    println!("Error en el archivo {:?}:", path);
                    println!("Mensaje: {}", e);
                    continue;
                }
            };

            let n = value
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            if n.is_none() {
                println!("Skipping {:?}: No 'name' field found in TOML", path);
                continue;
            }

            let envs = extract_envs_from_toml(&value);
            (n, envs)
        } else {
            // JSONC
            let value: serde_json::Value = match json5::from_str(&content) {
                Ok(v) => v,
                Err(e) => {
                    println!("Error parsing JSONC {:?}: {}", path, e);
                    continue;
                }
            };
            let n = value
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            if n.is_none() {
                println!("Skipping {:?}: No 'name' field found in JSONC", path);
                continue;
            }

            let envs = extract_envs_from_json(&value);
            (n, envs)
        };

        let final_name = name.unwrap();
        println!("Found worker: {} at {:?}", final_name, path);

        // Compute relative path from the base directory
        let relative_path = path
            .strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());

        workers.push(WorkerInfo {
            name: final_name,
            path: path.to_string_lossy().to_string(),
            relative_path,
            environments,
        });
    }

    // Sort workers by relative path for consistent ordering
    workers.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    Ok(workers)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![scan_workers])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
