#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[allow(dead_code)]

use std::{error::Error, sync::Mutex};

use stockfish::StockfishEval;

pub mod stockfish;

struct App {
    stockfish: Mutex<stockfish::Stockfish>,
}

impl App {
    fn new() -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            stockfish: Mutex::new(stockfish::Stockfish::new("stockfish")?),
        })
    }

    fn start_evaluating(&self, fen: &str) -> Result<(), Box<dyn Error>> {
        let mut stockfish = self.stockfish.lock().unwrap();
        stockfish.restart_evaluation(fen)
    }

    fn get_evaluation(&self) -> Result<Option<StockfishEval>, Box<dyn Error>> {
        let mut stockfish = self.stockfish.lock().unwrap();
        stockfish.get_current_evaluation()
    }
}

#[tauri::command]
fn start_evaluation(state: tauri::State<App>, fen: String) -> Result<(), String> {
    match state.start_evaluating(&fen) {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn get_evaluation(state: tauri::State<App>) -> Result<StockfishEval, String> {
    match state.get_evaluation() {
        Ok(Some(eval)) => Ok(eval),
        Ok(None) => Err("No evaluation available".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    tauri::Builder::default()
        .manage(App::new()?)
        .invoke_handler(tauri::generate_handler![get_evaluation, start_evaluation])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
